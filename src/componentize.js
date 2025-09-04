import { freemem } from 'node:os';
import { TextDecoder } from 'node:util';
import { Buffer } from 'node:buffer';
import { fileURLToPath, URL } from 'node:url';
import { cwd, stdout, platform } from 'node:process';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

import oxc from 'oxc-parser';
import wizer from '@bytecodealliance/wizer';
import {
  componentNew,
  metadataAdd,
  preview1AdapterReactorPath,
} from '@bytecodealliance/jco';

import { splicer } from '../lib/spidermonkey-embedding-splicer.js';

import { maybeWindowsPath } from './platform.js';

export const { version } = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

/** Prefix into wizer error output that indicates a error/trap */
const WIZER_ERROR_CAUSE_PREFIX = `Error: the \`componentize.wizer\` function trapped

Caused by:`;

/** Prefix into wizer error output that indicates exit status */
const WIZER_EXIT_CODE_PREFIX = 'Exited with i32 exit status';

/** Response code from check_init() that denotes success */
const CHECK_INIT_RETURN_OK = 0;

/** Response code from check_init() that denotes being unable to extract exports list */
const CHECK_INIT_RETURN_FN_LIST = 1;

/** Response code from check_init() that denotes being unable to parse core ABI export types */
const CHECK_INIT_RETURN_TYPE_PARSE = 2;

/** Default settings for debug options */
const DEFAULT_DEBUG_SETTINGS = {
  bindings: false,
  bindingsDir: null,

  binary: false,
  binaryPath: null,

  wizerLogging: false,
};

/** Features that are used by default if not explicitly disabled */
export const DEFAULT_FEATURES = ['stdio', 'random', 'clocks', 'http', 'fetch-event'];

export async function componentize(
  opts,
  _deprecatedWitWorldOrOpts = undefined,
  _deprecatedOpts = undefined,
) {
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
          `componentize: second argument must be an object or a string, but is ${typeof _deprecatedWitWorldOrOpts}`,
        );
      }
      opts = _deprecatedWitWorldOrOpts;
    }
  }

  // Prepare a working directory for use during componentization
  const { sourcesDir, baseDir: workDir } = await prepWorkDir();

  let {
    sourceName = 'source.js',
    sourcePath = maybeWindowsPath(join(sourcesDir, sourceName)),
    preview2Adapter = preview1AdapterReactorPath(),
    witPath,
    witWorld,
    worldName,
    disableFeatures = [],
    enableFeatures = [],

    debug = { ...DEFAULT_DEBUG_SETTINGS },
    debugBuild = false,
    debugBindings = false,
    enableWizerLogging = false,

    runtimeArgs,

  } = opts;

  debugBindings = debugBindings || debug?.bindings;
  debugBuild = debugBuild || debug?.build;
  enableWizerLogging = enableWizerLogging || debug?.enableWizerLogging;

  // Determine the path to the StarlingMonkey binary
  const engine = getEnginePath(opts);

  // Determine the default features that should be included
  const features = new Set();
  for (let f of DEFAULT_FEATURES) {
    if (!disableFeatures.includes(f)) {
      features.add(f);
    }
  }

  if (!jsSource && sourcePath) {
    jsSource = await readFile(sourcePath, 'utf8');
  }
  const detectedExports = await detectKnownSourceExportNames(
    sourceName,
    jsSource,
  );

  // If there is an export of incomingHandler, there is likely to be a
  // manual implementation of wasi:http/incoming-handler, so we should
  // disable fetch-event
  if (features.has('http') && detectedExports.has('incomingHandler')) {
    if (debugBindings) {
      console.error(
        'Detected `incomingHandler` export, disabling fetch-event...',
      );
    }
    features.delete('fetch-event');
  }

  // Splice the bindigns for the given WIT world into the engine WASM
  let { wasm, jsBindings, exports, imports } = splicer.spliceBindings(
    await readFile(engine),
    [...features],
    witWorld,
    maybeWindowsPath(witPath),
    worldName,
    false,
  );

  const inputWasmPath = join(workDir, 'in.wasm');
  const outputWasmPath = join(workDir, 'out.wasm');

  await writeFile(inputWasmPath, Buffer.from(wasm));
  let initializerPath = maybeWindowsPath(join(sourcesDir, 'initializer.js'));
  await writeFile(initializerPath, jsBindings);

  if (debugBindings) {
    // If a bindings output directory was specified, output generated bindings to files
    if (debug?.bindingsDir) {
      console.error(`Storing debug files in "${debug?.bindingsDir}"\n`);
      // Ensure the debug bindings dir exists, and is a directory
      if (!(await stat(debug?.bindingsDir).then((s) => s.isDirectory()))) {
        throw new Error(
          `Missing/invalid debug bindings directory [${debug?.bindingsDir}]`,
        );
      }
      // Write debug to bindings debug directory
      await Promise.all([
        writeFile(join(debug?.bindingsDir, 'source.debug.js'), jsSource),
        writeFile(join(debug?.bindingsDir, 'bindings.debug.js'), jsBindings),
        writeFile(
          join(debug?.bindingsDir, 'imports.debug.json'),
          JSON.stringify(imports, null, 2),
        ),
        writeFile(
          join(debug?.bindingsDir, 'exports.debug.json'),
          JSON.stringify(exports, null, 2),
        ),
      ]);
    } else {
      // If a bindings output directory was not specified, output to stdout
      console.error('--- JS Bindings ---');
      console.error(
        jsBindings
          .split('\n')
          .map((ln, idx) => `${(idx + 1).toString().padStart(4, ' ')} | ${ln}`)
          .join('\n'),
      );
      console.error('--- JS Imports ---');
      console.error(imports);
      console.error('--- JS Exports ---');
      console.error(exports);
    }
  }

  if (!useOriginalSourceFile) {
    if (debugBindings) {
      console.error(`> Writing JS source to ${tmpDir}/sources`);
    }
    await writeFile(sourcePath, jsSource);
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
    FEATURE_CLOCKS: features.has('clocks') ? '1' : '',
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
    console.error('--- Wizer Env ---');
    console.error(env);
  }

  sourcePath = maybeWindowsPath(sourcePath);
  let workspacePrefix = dirname(sourcePath);

  // If the source path is within the current working directory, strip the
  // cwd as a prefix from the source path, and remap the paths seen by the
  // component to be relative to the current working directory.
  // This only works in wizer.
  if (!useOriginalSourceFile) {
    workspacePrefix = sourcesDir;
    sourcePath = sourceName;
  }
  let currentDir = maybeWindowsPath(cwd());
  if (workspacePrefix.startsWith(currentDir)) {
    workspacePrefix = currentDir;
    sourcePath = sourcePath.slice(workspacePrefix.length + 1);
  }

  let args = `--initializer-script-path ${initializerPath} --strip-path-prefix ${workspacePrefix}/ ${sourcePath}`;
  runtimeArgs = runtimeArgs ? `${runtimeArgs} ${args}` : args;

  let preopens = [`--dir ${sourcesDir}`];
  preopens.push(`--mapdir /::${workspacePrefix}`);

  let postProcess;

  const wizerBin = opts.wizerBin ?? wizer;
  postProcess = spawnSync(
    wizerBin,
    [
      '--allow-wasi',
      '--init-func',
      'componentize.wizer',
      ...preopens,
      `--wasm-bulk-memory=true`,
      '--inherit-env=true',
      `-o=${outputWasmPath}`,
      inputWasmPath,
    ],
    {
      stdio: [null, stdout, 'pipe'],
      env,
      input: runtimeArgs,
      shell: true,
      encoding: 'utf-8',
    },
  );

  // If the wizer process failed, parse the output and display to the user
  if (postProcess.status !== 0) {
    let wizerErr = parseWizerStderr(postProcess.stderr);
    let err = `Failed to initialize component:\n${wizerErr}`;
    if (debugBindings) {
      err += `\n\nBinary and sources available for debugging at ${workDir}\n`;
    } else {
      await rm(workDir, { recursive: true });
    }
    throw new Error(err);
  }

  // Read the generated WASM back into memory
  const bin = await readFile(outputWasmPath);

  // Check for initialization errors, by actually executing the binary in
  // a mini sandbox to get back the initialization state
  const {
    exports: { check_init },
    getStderr,
  } = await initWasm(bin);

  // If not in debug mode, clean up
  if (!debugBindings) {
    await rm(workDir, { recursive: true });
  }

  /// Process output of check init, throwing if necessary
  await handleCheckInitOutput(
    check_init(),
    initializerPath,
    workDir,
    getStderr,
  );

  // After wizening, stub out the wasi imports depending on what features are enabled
  const finalBin = splicer.stubWasi(
    bin,
    [...features],
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

  // Convert CABI import conventions to ESM import conventions
  imports = imports.map(([specifier, impt]) =>
    specifier === '$root' ? [impt, 'default'] : [specifier, impt],
  );

  // Build debug object to return
  let debugOutput;
  if (debugBindings) {
    debugOutput.bindings = debug.bindings;
    debugOutput.workDir = workDir;
  }
  if (debug?.binary) {
    debugOutput.binary = debug.binary;
    debugOutput.binaryPath = debug.binaryPath;
  }

  return {
    component,
    imports,
    debug: debugOutput,
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

/**
 * Clean up the given input string by removing the given patterns if
 * found as line prefixes.
 */
function stripLinesPrefixes(input, prefixPatterns) {
  return input
    .split('\n')
    .map((line) =>
      prefixPatterns.reduce((line, n) => line.replace(n, ''), line),
    )
    .join('\n')
    .trim();
}

/**
 * Parse output of post-processing Wizer step
 *
 * @param {Stream} stderr
 * @returns {string} String that can be printed to describe error output
 */
function parseWizerStderr(stderr) {
  let output = `${stderr}`;
  let causeStart = output.indexOf(WIZER_ERROR_CAUSE_PREFIX);
  let exitCodeStart = output.indexOf(WIZER_EXIT_CODE_PREFIX);
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

/** Determine the correct path for the engine */
function getEnginePath(opts) {
  if (opts.engine) {
    return opts.engine;
  }
  const debugSuffix = opts?.debugBuild ? '.debug' : '';
  let engineBinaryRelPath = `../lib/starlingmonkey_embedding${debugSuffix}.wasm`;

  return fileURLToPath(new URL(engineBinaryRelPath, import.meta.url));
}

/** Prepare a work directory for use with componentization */
async function prepWorkDir() {
  const baseDir = maybeWindowsPath(
    join(
      tmpdir(),
      createHash('sha256')
        .update(Math.random().toString())
        .digest('hex')
        .slice(0, 12),
    ),
  );
  await mkdir(baseDir);
  const sourcesDir = maybeWindowsPath(join(baseDir, 'sources'));
  await mkdir(sourcesDir);
  return { baseDir, sourcesDir };
}

/**
 * Initialize a WebAssembly binary, given the
 *
 * @param {Buffer} bin - WebAssembly binary bytes
 * @throws If a binary is invalid
 */
async function initWasm(bin) {
  const eep = (name) => () => {
    throw new Error(
      `Internal error: unexpected call to "${name}" during Wasm verification`,
    );
  };

  let stderr = '';
  const wasmModule = await WebAssembly.compile(bin);

  const mockImports = {
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

/**
 * Handle the output of `check_init()`
 *
 * @param {number} status - output of check_init
 * @param {string} initializerPath
 * @param {string} workDir
 * @param {() => string} getStderr - A function that resolves to the stderr output of check init
 */
async function handleCheckInitOutput(
  status,
  initializerPath,
  workDir,
  getStderr,
) {
  let err = null;
  switch (status) {
    case CHECK_INIT_RETURN_OK:
      break;
    case CHECK_INIT_RETURN_FN_LIST:
      err = `Unable to extract expected exports list`;
      break;
    case CHECK_INIT_RETURN_TYPE_PARSE:
      err = `Unable to parse the core ABI export types`;
      break;
    default:
      err = `Unknown error during initialization: ${status}`;
  }

  if (err) {
    let msg = err;
    const stderr = getStderr();
    if (stderr) {
      msg += `\n${stripLinesPrefixes(stderr, [new RegExp(`${initializerPath}[:\\d]* ?`)], workDir)}`;
    }
    throw new Error(msg);
  }
}

/**
 * Detect known exports that correspond to certain interfaces
 *
 * @param {string} filename - filename
 * @param {string} code - JS source code
 * @returns {Promise<string[]>} A Promise that resolves to a list of string that represent unversioned interfaces
 */
async function detectKnownSourceExportNames(filename, code) {
  if (!filename) {
    throw new Error('missing filename');
  }
  if (!code) {
    throw new Error('missing JS code');
  }

  const names = new Set();

  const results = await oxc.parseAsync(filename, code);
  if (results.errors.length > 0) {
    throw new Error(
      `failed to parse JS source, encountered [${results.errors.length}] errors`,
    );
  }

  for (const staticExport of results.module.staticExports) {
    for (const entry of staticExport.entries) {
      names.add(entry.exportName.name);
    }
  }

  return names;
}
