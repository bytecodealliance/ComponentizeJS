import wizer from '@bytecodealliance/wizer';
import {
  componentNew,
  metadataAdd,
  preview1AdapterReactorPath,
} from '@bytecodealliance/jco';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  spliceBindings,
  stubWasi,
} from '../lib/spidermonkey-embedding-splicer.js';
import { fileURLToPath } from 'node:url';
import { stdout, stderr, exit, platform } from 'node:process';
import { init as lexerInit, parse } from 'es-module-lexer';
const { version } = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
const isWindows = platform === 'win32';
const DEBUG_BINDINGS = false;
const DEBUG_CALLS = false;

function maybeWindowsPath (path) {
  if (!path) return path;
  if (!isWindows) return resolve(path);
  return '//?/' + resolve(path).replace(/\\/g, '/');
}

export async function componentize(jsSource, witWorld, opts) {
  if (typeof witWorld === 'object') {
    opts = witWorld;
    witWorld = opts?.witWorld;
  }
  const {
    sourceName = 'source.js',
    engine = fileURLToPath(
      new URL(`../lib/starlingmonkey_embedding.wasm`, import.meta.url)
    ),
    preview2Adapter = preview1AdapterReactorPath(),
    witPath,
    worldName,
    disableFeatures = [],
    enableFeatures = [],
  } = opts || {};

  let { wasm, jsBindings, importWrappers, exports, imports } = spliceBindings(
    sourceName,
    await readFile(engine),
    witWorld,
    maybeWindowsPath(witPath),
    worldName,
    false
  );

  // we never disable a feature that is already in the target world usage
  const features = [];
  if (!disableFeatures.includes('stdio')) {
    features.push('stdio');
  } else if (imports.some(([module]) => module.startsWith('wasi:cli/std') || module.startsWith('wasi:cli/terminal'))) {
    throw new Error(
      'Cannot disable "stdio" as it is already an import in the target world.'
    );
  }
  if (!disableFeatures.includes('random')) {
    features.push('random');
  } else if (imports.some(([module]) => module.startsWith('wasi:random/'))) {
    throw new Error(
      'Cannot disable "random" as it is already an import in the target world.'
    );
  }
  if (!disableFeatures.includes('clocks')) {
    features.push('clocks');
  } else if (imports.some(([module]) => module.startsWith('wasi:clocks/'))) {
    throw new Error(
      'Cannot disable "clocks" as it is already an import in the target world.'
    );
  }
  if (
    enableFeatures.includes('http') ||
    imports.some(([module]) => module.startsWith('wasi:http/'))
  ) {
    features.push('http');
  }

  if (DEBUG_BINDINGS) {
    console.log('--- JS Source ---');
    console.log(jsSource);
    console.log('--- JS Bindings ---');
    console.log(
      jsBindings
        .split('\n')
        .map((ln, idx) => `${(idx + 1).toString().padStart(4, ' ')} | ${ln}`)
        .join('\n')
    );
    console.log('--- JS Imports ---');
    console.log(imports);
    console.log(importWrappers);
    console.log('--- JS Exports ---');
    console.log(exports);
  }

  const tmpDir = join(
    tmpdir(),
    createHash('sha256')
      .update(Math.random().toString())
      .digest('hex')
      .slice(0, 12)
  );
  await mkdir(tmpDir);

  const input = join(tmpDir, 'in.wasm');
  const output = join(tmpDir, 'out.wasm');

  await writeFile(input, Buffer.from(wasm));

  // rewrite the JS source import specifiers to reference import wrappers
  await lexerInit;
  let jsImports = [];
  try {
    [jsImports] = parse(jsSource);
  } catch {
    // ignore parser errors - will show up as engine parse errors shortly
  }
  let source = '',
    curIdx = 0;
  for (const jsImpt of jsImports) {
    const specifier = jsSource.slice(jsImpt.s, jsImpt.e);
    source += jsSource.slice(curIdx, jsImpt.s);
    source += `./${specifier.replace(':', '__').replace('/', '$')}.js`;
    curIdx = jsImpt.e;
  }
  source += jsSource.slice(curIdx);

  // write the source files into the source dir
  const sourceDir = join(tmpDir, 'sources');

  if (DEBUG_BINDINGS) {
    console.log(`> Writing sources to ${tmpDir}/sources`);
  }

  await mkdir(sourceDir);
  await Promise.all(
    [
      [sourceName, source],
      [sourceName.slice(0, -3) + '.bindings.js', jsBindings],
      ...importWrappers.map(([sourceName, source]) => [
        `./${sourceName.replace(':', '__').replace('/', '$')}.js`,
        source,
      ]),
    ].map(async ([sourceName, source]) =>
      writeFile(join(sourceDir, sourceName), source)
    )
  );

  const env = {
    DEBUG: DEBUG_CALLS ? '1' : '',
    SOURCE_NAME: sourceName,
    IMPORT_WRAPPER_CNT: Object.keys(importWrappers).length.toString(),
    EXPORT_CNT: exports.length.toString(),
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

  if (DEBUG_BINDINGS) {
    console.log('--- Wizer Env ---');
    console.log(env);
  }

  try {
    let wizerProcess = spawnSync(
      wizer,
      [
        '--allow-wasi',
        '--init-func',
        'componentize.wizer',
        `--dir=${sourceDir}`,
        `--wasm-bulk-memory=true`,
        '--inherit-env=true',
        `-o=${output}`,
        input,
      ],
      {
        stdio: [null, stdout, stderr],
        env,
        input: maybeWindowsPath(join(sourceDir, sourceName.slice(0, -3) + '.bindings.js')),
        shell: true,
        encoding: 'utf-8',
      }
    );
    if (wizerProcess.status !== 0)
      throw new Error('Wizering failed to complete');
  } catch (error) {
    let err =
      `Failed to initialize the compiled Wasm binary with Wizer:\n` +
      error.message;
    if (DEBUG_BINDINGS) {
      err += `\nBinary and sources available for debugging at ${tmpDir}\n`;
    } else {
      rmSync(tmpDir, { recursive: true });
    }
    throw new Error(err);
  }

  const bin = await readFile(output);

  const tmpdirRemovePromise = DEBUG_BINDINGS
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
        `Internal error: unexpected call to "${name}" during Wasm verification`
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
              new Uint8Array(exports.memory.buffer, bufPtr, bufLen)
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

  // convert CABI import conventiosn to ESM import conventions
  imports = imports.map(([specifier, impt]) =>
    specifier === '$root' ? [impt, 'default'] : [specifier, impt]
  );

  const INIT_OK = 0;
  const INIT_FN_LIST = 11;
  const INIT_TYPE_PARSE = 17;

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
      err = `Unknown error - ${status}`;
  }

  if (err) {
    console.error(err);
    const stderr = getStderr();
    if (stderr) {
      console.error(stderr);
    }
    exit(1);
  }

  // after wizering, stub out the wasi imports depending on what features are enabled
  const finalBin = stubWasi(bin, features);

  const component = await metadataAdd(
    await componentNew(
      finalBin,
      Object.entries({
        wasi_snapshot_preview1: await readFile(preview2Adapter),
      }),
      false
    ),
    Object.entries({
      language: [['JavaScript', '']],
      'processed-by': [['ComponentizeJS', version]],
    })
  );

  return {
    component,
    imports,
  };
}
