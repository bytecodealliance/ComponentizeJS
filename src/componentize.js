import { freemem } from "node:os";
import wizer from '@bytecodealliance/wizer';
import getWeval from '@bytecodealliance/weval';
import {
  componentNew,
  metadataAdd,
  preview1AdapterReactorPath,
} from '@bytecodealliance/jco';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  spliceBindings,
  stubWasi,
} from '../lib/spidermonkey-embedding-splicer.js';
import { fileURLToPath } from 'node:url';
import { cwd, stdout, platform } from 'node:process';
export const { version } = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const isWindows = platform === 'win32';

function maybeWindowsPath(path) {
  if (!path) return path;
  if (!isWindows) return resolve(path);
  return '//?/' + resolve(path).replace(/\\/g, '/');
}

/**
 * Clean up the given input string by removing the given patterns if
 * found as line prefixes.
 */
function stripLinesPrefixes(input, prefixPatterns) {
  return input.split('\n')
    .map(line => prefixPatterns.reduce((line, n) => line.replace(n, ''), line))
    .join('\n').trim();
}

const WizerErrorCause = `Error: the \`componentize.wizer\` function trapped

Caused by:`;

const WizerExitCode = "Exited with i32 exit status";

function parseWizerStderr(stderr) {
  let output = `${stderr}`;
  let causeStart = output.indexOf(WizerErrorCause);
  let exitCodeStart = output.indexOf(WizerExitCode);
  if (causeStart === -1 || exitCodeStart === -1) {
    return output;
  }

  let causeEnd = output.indexOf('\n', exitCodeStart + 1);
  return `${output.substring(0, causeStart)}${output.substring(causeEnd)}`.trim();
}

/**
 * Check whether a value is numeric (including BigInt)
 *
 * @param {any} n
 * @returns {boolean} whether the value is numeric
 */
function isNumeric(n) {
  switch (typeof n) {
    case 'bigint':
    case 'number':
      return true;
    case 'object':
      return n.constructor == BigInt || n.constructor == Number;
    default:
      return false;
  }
}

export async function componentize(opts,
                                   _deprecatedWitWorldOrOpts = undefined,
                                   _deprecatedOpts = undefined) {
  let useOriginalSourceFile = true;
  let jsSource;

  // Handle the two old signatures
  // (jsSource, witWorld, opts?)
  // (jsSource, opts)
  if (typeof opts === 'string') {
    jsSource = opts;
    useOriginalSourceFile = false;
    if (typeof _deprecatedWitWorldOrOpts === 'string') {
      opts = _deprecatedOpts || {};
      opts.witWorld = _deprecatedWitWorldOrOpts;
    } else {
      if (typeof _deprecatedWitWorldOrOpts !== 'object') {
        throw new Error(
          `componentize: second argument must be an object or a string, but is ${typeof _deprecatedWitWorldOrOpts}`
        );
      }
      opts = _deprecatedWitWorldOrOpts;
    }
  }

  const tmpDir = join(
    tmpdir(),
    createHash('sha256')
      .update(Math.random().toString())
      .digest('hex')
      .slice(0, 12)
  );
  await mkdir(tmpDir);
  const sourceDir = join(tmpDir, 'sources');
  await mkdir(sourceDir);

  let {
    sourceName = 'source.js',
    sourcePath = join(sourceDir, sourceName),
    preview2Adapter = preview1AdapterReactorPath(),
    witPath,
    witWorld,
    worldName,
    disableFeatures = [],
    enableFeatures = [],
    debugBuild = false,
    runtimeArgs,
    debugBindings = false,
    enableWizerLogging = false,
    aotCache = fileURLToPath(
      new URL(`../lib/starlingmonkey_ics.wevalcache`, import.meta.url),
    ),
  } = opts;

  const engine =
    opts.engine ||
    fileURLToPath(
      new URL(
        opts.enableAot
          ? `../lib/starlingmonkey_embedding_weval.wasm`
          : `../lib/starlingmonkey_embedding${debugBuild ? '.debug' : ''}.wasm`,
        import.meta.url,
      ),
    );

  let { wasm, jsBindings, exports, imports } = spliceBindings(
    await readFile(engine),
    witWorld,
    maybeWindowsPath(witPath),
    worldName,
    false
  );

  const input = join(tmpDir, 'in.wasm');
  const output = join(tmpDir, 'out.wasm');

  await writeFile(input, Buffer.from(wasm));
  await writeFile(join(sourceDir, "initializer.js"), jsBindings);

  if (debugBindings) {
    console.log('--- JS Bindings ---');
    console.log(
      jsBindings
        .split('\n')
        .map((ln, idx) => `${(idx + 1).toString().padStart(4, ' ')} | ${ln}`)
        .join('\n')
    );
    console.log('--- JS Imports ---');
    console.log(imports);
    console.log('--- JS Exports ---');
    console.log(exports);
  }

  if (!useOriginalSourceFile) {
    if (debugBindings) {
      console.log(`> Writing JS source to ${tmpDir}/sources`);
    }
    await writeFile(sourcePath, jsSource);
  }

  // we never disable a feature that is already in the target world usage
  const features = [];
  if (!disableFeatures.includes('stdio')) {
    features.push('stdio');
  }
  if (!disableFeatures.includes('random')) {
    features.push('random');
  }
  if (!disableFeatures.includes('clocks')) {
    features.push('clocks');
  }
  if (!disableFeatures.includes('http')) {
    features.push('http');
  }

  let hostenv = {};

  if (opts.env) {
    hostenv = typeof opts.env === 'object' ? opts.env : process.env;
  }

  const env = {
    ...hostenv,
    DEBUG: enableWizerLogging ? '1' : '',
    SOURCE_NAME: sourceName,
    EXPORT_CNT: exports.length.toString(),
    FEATURE_CLOCKS: features.includes('clocks') ? '1' : '',
  };

  for (const [idx, [export_name, expt]] of exports.entries()) {
    env[`EXPORT${idx}_NAME`] = export_name;
    env[`EXPORT${idx}_ARGS`] =
      (expt.paramptr ? '*' : '') + expt.params.join(',');
    env[`EXPORT${idx}_RET`] = (expt.retptr ? '*' : '') + (expt.ret || '');
    env[`EXPORT${idx}_RETSIZE`] = String(expt.retsize);
  }

  for (let i = 0; i < imports.length; i++) {
    env[`IMPORT${i}_NAME`] = imports[i][1];
    env[`IMPORT${i}_ARGCNT`] = String(imports[i][2]);
  }
  env['IMPORT_CNT'] = imports.length;

  if (debugBindings) {
    console.log('--- Wizer Env ---');
    console.log(env);
  }

  let initializerPath = join(sourceDir, 'initializer.js');
  sourcePath = maybeWindowsPath(sourcePath);
  let workspacePrefix = dirname(sourcePath);

  // If the source path is within the current working directory, strip the
  // cwd as a prefix from the source path, and remap the paths seen by the
  // component to be relative to the current working directory.
  // This only works in wizer, not in weval, because the latter doesn't
  // support --mapdir.
  if (!opts.enableAot) {
    if (!useOriginalSourceFile) {
      workspacePrefix = sourceDir;
      sourcePath = sourceName;
    }
    if (workspacePrefix.startsWith(cwd())) {
      workspacePrefix = cwd();
      sourcePath = sourcePath.slice(workspacePrefix.length + 1);
    }
  }
  let args = `--initializer-script-path ${initializerPath} --strip-path-prefix ${workspacePrefix}/ ${sourcePath}`;
  runtimeArgs = runtimeArgs ? `${runtimeArgs} ${args}` : args;
  let preopens = [`--dir ${sourceDir}`];
  if (opts.enableAot) {
    preopens.push(`--dir ${workspacePrefix}`);
  } else {
    preopens.push(`--mapdir /::${workspacePrefix}`);
  }

  let wizerProcess;

  if (opts.enableAot) {
    // Determine the weval bin path, possibly using a pre-downloaded version
    let wevalBin;
    if (opts.wevalBin && existsSync(opts.wevalBin)) {
      wevalBin = opts.wevalBin;
    } else {
      wevalBin = await getWeval();
    }

    // Set the min stack size, if one was provided
    if (opts.aotMinStackSizeBytes) {
      if (!isNumeric(opts.aotMinStackSizeBytes)) {
        throw new TypeError(
          `aotMinStackSizeBytes must be a numeric value, received [${opts.aotMinStackSizeBytes}] (type ${typeof opts.aotMinStackSizeBytes})`,
        );
      }
      env.RUST_MIN_STACK = opts.aotMinStackSizeBytes;
    } else {
      env.RUST_MIN_STACK = defaultMinStackSize();
    }

    wizerProcess = spawnSync(
      wevalBin,
      [
        'weval',
        `--cache-ro ${aotCache}`,
        ...preopens,
        '-w',
        '--init-func',
        'componentize.wizer',
        `-i ${input}`,
        `-o ${output}`,
      ],
      {
        stdio: [null, stdout, "pipe"],
        env,
        input: runtimeArgs,
        shell: true,
        encoding: 'utf-8',
      }
    );
  } else {
    wizerProcess = spawnSync(
      wizer,
      [
        '--allow-wasi',
        '--init-func',
        'componentize.wizer',
        ...preopens,
        `--wasm-bulk-memory=true`,
        '--inherit-env=true',
        `-o=${output}`,
        input,
      ],
      {
        stdio: [null, stdout, "pipe"],
        env,
        input: runtimeArgs,
        shell: true,
        encoding: 'utf-8',
      }
    );
  }

  if (wizerProcess.status !== 0) {
    let wizerErr = parseWizerStderr(wizerProcess.stderr);
    let err = `Failed to initialize component:\n${wizerErr}`;
    if (debugBindings) {
      err += `\n\nBinary and sources available for debugging at ${tmpDir}\n`;
    } else {
      rmSync(tmpDir, { recursive: true });
    }
    throw new Error(err);
  }

  const bin = await readFile(output);

  const tmpdirRemovePromise = debugBindings
    ? Promise.resolve()
    : rm(tmpDir, { recursive: true });

  // Check for initialization errors
  // By actually executing the binary in a mini sandbox to get back
  // the initialization state
  const {
    exports: { check_init },
    getStderr,
  } = await initWasm(bin);

  await tmpdirRemovePromise;

  async function initWasm(bin) {
    const eep = (name) => () => {
      throw new Error(
        `Internal error: unexpected call to "${name}" during Wasm verification`,
      );
    };

    let stderr = '';
    const wasmModule = await WebAssembly.compile(bin);

    const mockImports = {
      // "wasi-logging2": {
      //   log: eep("log"),
      // },
      wasi_snapshot_preview1: {
        fd_write: function (fd, iovs, iovs_len, nwritten) {
          if (fd !== 2) return 0;
          const mem = new DataView(exports.memory.buffer);
          let written = 0;
          for (let i = 0; i < iovs_len; i++) {
            const bufPtr = mem.getUint32(iovs + i * 8, true);
            const bufLen = mem.getUint32(iovs + 4 + i * 8, true);
            stderr += new TextDecoder().decode(
              new Uint8Array(exports.memory.buffer, bufPtr, bufLen),
            );
            written += bufLen;
          }
          mem.setUint32(nwritten, written, true);
          return 1;
        },
      },
    };

    for (const { module, name } of WebAssembly.Module.imports(wasmModule)) {
      mockImports[module] = mockImports[module] || {};
      if (!mockImports[module][name]) mockImports[module][name] = eep(name);
    }

    const { exports } = await WebAssembly.instantiate(wasmModule, mockImports);
    return {
      exports,
      getStderr() {
        return stderr;
      },
    };
  }

  const INIT_OK = 0;
  const INIT_FN_LIST = 1;
  const INIT_TYPE_PARSE = 2;

  const status = check_init();
  let err = null;
  switch (status) {
    case INIT_OK:
      break;
    case INIT_FN_LIST:
      err = `Unable to extract expected exports list`;
      break;
    case INIT_TYPE_PARSE:
      err = `Unable to parse the core ABI export types`;
      break;
    default:
      err = `Unknown error during initialization: ${status}`;
  }

  if (err) {
    let msg = err;
    const stderr = getStderr();
    if (stderr) {
      msg += `\n${stripLinesPrefixes(stderr, [new RegExp(`${initializerPath}[:\\d]* ?`)], tmpDir)}`;
    }
    throw new Error(msg);
  }

  // after wizening, stub out the wasi imports depending on what features are enabled
  const finalBin = stubWasi(
    bin,
    features,
    witWorld,
    maybeWindowsPath(witPath),
    worldName,
  );

  if (debugBindings) {
    await writeFile('binary.wasm', finalBin);
  }

  const component = await metadataAdd(
    await componentNew(
      finalBin,
      Object.entries({
        wasi_snapshot_preview1: await readFile(preview2Adapter),
      }),
      false,
    ),
    Object.entries({
      language: [['JavaScript', '']],
      'processed-by': [['ComponentizeJS', version]],
    }),
  );

  // convert CABI import conventions to ESM import conventions
  imports = imports.map(([specifier, impt]) =>
    specifier === '$root' ? [impt, 'default'] : [specifier, impt]
  );

  return {
    component,
    imports,
  };
}

/**
 * Calculate the min stack size depending on free memory
 *
 * @param {number} freeMemoryBytes - Amount of free memory in the system, in bytes  (if not provided, os.freemem() is used)
 * @returns {number} The minimum stack size that should be used as a default.
 */
function defaultMinStackSize(freeMemoryBytes) {
  freeMemoryBytes = freeMemoryBytes ?? freemem();
  return Math.max(8 * 1024 * 1024, Math.floor(freeMemoryBytes * 0.1));
}
