import wizer from '@bytecodealliance/wizer';
import {
  componentNew,
  metadataAdd,
  preview1AdapterReactorPath,
} from '@bytecodealliance/jco';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import {
  spliceBindings,
  stubWasi,
} from '../lib/spidermonkey-embedding-splicer.js';
import { fileURLToPath } from 'node:url';
import { stdout, stderr, exit, platform } from 'node:process';
const { version } = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
const isWindows = platform === 'win32';

export async function componentize(jsSource, witWorld, opts) {
  if (typeof witWorld === 'object') {
    opts = witWorld;
    witWorld = opts?.witWorld;
  }
  const {
    debug = false,
    sourceName = 'source.js',
    engine = fileURLToPath(
      new URL('../lib/spidermonkey_embedding.wasm', import.meta.url)
    ),
    preview2Adapter = preview1AdapterReactorPath(),
    witPath,
    worldName,
    enableStdout = false,
  } = opts || {};

  let { wasm, jsBindings, importWrappers, exports, imports } = spliceBindings(
    sourceName,
    await readFile(engine),
    witWorld,
    witPath ? (isWindows ? '//?/' : '') + resolve(witPath) : null,
    worldName
  );

  if (debug) {
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

  const input = join(tmpdir(), 'in.wasm');
  const output = join(tmpdir(), 'out.wasm');

  await writeFile(input, Buffer.from(wasm));

  // we concatenate the sources into stdin for wizering, communicating the offsets via env vars
  let wizerInput = jsSource + jsBindings;

  const env = {
    DEBUG: debug ? '1' : '',
    SOURCE_NAME: sourceName,
    SOURCE_LEN: new TextEncoder().encode(jsSource).byteLength.toString(),
    BINDINGS_LEN: new TextEncoder().encode(jsBindings).byteLength.toString(),
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

  for (const [idx, [name, importWrapper]] of importWrappers.entries()) {
    env[`IMPORT_WRAPPER${idx}_NAME`] = name;
    env[`IMPORT_WRAPPER${idx}_LEN`] = new TextEncoder()
      .encode(importWrapper)
      .byteLength.toString();
    wizerInput += importWrapper;
  }

  for (let i = 0; i < imports.length; i++) {
    env[`IMPORT${i}_NAME`] = imports[i][1];
    env[`IMPORT${i}_ARGCNT`] = String(imports[i][2]);
  }
  env['IMPORT_CNT'] = imports.length;

  if (debug) {
    console.log('--- Wizer Env ---');
    console.log(env);
  }

  try {
    let wizerProcess = spawnSync(
      wizer,
      [
        '--allow-wasi',
        `--dir=.`,
        `--wasm-bulk-memory=true`,
        '--inherit-env=true',
        `-o=${output}`,
        input,
      ],
      {
        stdio: [null, stdout, stderr],
        env,
        input: wizerInput,
        shell: true,
        encoding: 'utf-8',
      }
    );
    if (wizerProcess.status !== 0)
      throw new Error('Wizering failed to complete');
  } catch (error) {
    console.error(
      `Error: Failed to initialize the compiled Wasm binary with Wizer:\n`,
      error.message
    );
    if (debug) {
      console.error(`Binary available for debugging at ${input}`);
    } else {
      await unlink(input);
    }
    exit(1);
  }

  const bin = await readFile(output);

  const unlinkPromises = Promise.all([unlink(input), unlink(output)]).catch(
    () => {}
  );

  // Check for initialization errors
  // By actually executing the binary in a mini sandbox to get back
  // the initialization state
  const {
    exports: { check_init },
    getStderr,
  } = await initWasm(bin);

  await unlinkPromises;

  async function initWasm(bin) {
    const eep = (name) => () => {
      throw new Error(
        `Internal error: unexpected call to "${name}" during Wasm verification`
      );
    };

    let stderr = '';
    const module = await WebAssembly.compile(bin);

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
        environ_get: eep('environ_get'),
        environ_sizes_get: eep('environ_sizes_get'),
        clock_res_get: eep('clock_res_get'),
        clock_time_get: eep('clock_time_get'),
        fd_close: eep('fd_close'),
        fd_fdstat_get: eep('fd_fdstat_get'),
        fd_fdstat_set_flags: eep('fd_fdstat_set_flags'),
        fd_prestat_get: eep('fd_prestat_get'),
        fd_prestat_dir_name: eep('fd_prestat_dir_name'),
        fd_read: eep('fd_read'),
        fd_seek: eep('fd_seek'),
        path_open: eep('path_open'),
        path_remove_directory: eep('path_remove_directory'),
        path_unlink_file: eep('path_unlink_file'),
        proc_exit: eep('proc_exit'),
        random_get: eep('random_get'),
      },
    };

    for (const [importName, binding] of imports) {
      mockImports[importName] = mockImports[importName] || {};
      mockImports[importName][binding] = eep(binding);
    }

    const { exports } = await WebAssembly.instantiate(module, mockImports);
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
  const INIT_JSINIT = 1;
  const INIT_INTRINSICS = 2;
  const INIT_CUSTOM_INTRINSICS = 3;
  const INIT_SOURCE_STDIN = 4;
  const INIT_SOURCE_COMPILE = 5;
  const INIT_BINDINGS_COMPILE = 6;
  const INIT_IMPORT_WRAPPER_COMPILE = 7;
  const INIT_SOURCE_LINK = 8;
  const INIT_SOURCE_EXEC = 9;
  const INIT_BINDINGS_EXEC = 10;
  const INIT_FN_LIST = 11;
  const INIT_MEM_BUFFER = 12;
  const INIT_REALLOC_FN = 13;
  const INIT_MEM_BINDINGS = 14;
  const INIT_PROMISE_REJECTIONS = 15;
  const INIT_IMPORT_FN = 16;
  const INIT_TYPE_PARSE = 17;

  const status = check_init();
  let err = null;
  switch (status) {
    case INIT_OK:
      break;
    case INIT_JSINIT:
      err = `JS environment could not be initialized`;
      break;
    case INIT_INTRINSICS:
      err = `JS intrinsics could not be defined`;
      break;
    case INIT_CUSTOM_INTRINSICS:
      err = `Platform intrinsics could not be defined`;
      break;
    case INIT_SOURCE_STDIN:
      err = `Unable to populate source code into Wasm`;
      break;
    case INIT_SOURCE_COMPILE:
      err = `Unable to compile JS source code`;
      break;
    case INIT_BINDINGS_COMPILE:
      err = `Unable to compile JS bindings code`;
      break;
    case INIT_IMPORT_WRAPPER_COMPILE:
      err = `Unable to compile the dependency wrapper code`;
      break;
    case INIT_SOURCE_LINK:
      err = `Unable to link the source code. Imports should be:\n\n  ${Object.entries(
        imports.reduce((impts, [specifier, impt]) => {
          (impts[specifier] = impts[specifier] || []).push(
            impt
              .split('-')
              .map((x, i) =>
                i === 0
                  ? x === 'default'
                    ? 'default as $func'
                    : x
                  : x[0].toUpperCase() + x.slice(1)
              )
              .join('')
          );
          return impts;
        }, {})
      )
        .map(
          ([specifier, impts]) =>
            `import { ${impts.join(', ')} } from "${specifier}";`
        )
        .join('\n . ')}\n`;
      break;
    case INIT_SOURCE_EXEC:
      err = `Unable to execute the JS source code`;
      break;
    case INIT_BINDINGS_EXEC:
      err = `Unable to execute the JS bindings code`;
      break;
    case INIT_FN_LIST:
      err = `Unable to extract expected exports list`;
      break;
    case INIT_MEM_BUFFER:
      err = `Unable to initialize JS binding memory buffer`;
      break;
    case INIT_REALLOC_FN:
      err = `Unable to create JS binding realloc function`;
      break;
    case INIT_MEM_BINDINGS:
      err = `Unable to initialize JS bindings.`;
      break;
    case INIT_PROMISE_REJECTIONS:
      err = `Unable to initialize promise rejection handler`;
      break;
    case INIT_IMPORT_FN:
      err = `Unable to initialize imported bindings`;
      break;
    case INIT_TYPE_PARSE:
      err = `Unable to parse the core ABI export types`;
      break;
    default:
      err = `Unknown error - ${status}`;
  }

  // in debug mode, log the generated bindings for bindings errors
  if (
    debug &&
    (status === INIT_BINDINGS_COMPILE || status === INIT_MEM_BINDINGS)
  ) {
    err += `\n\nGenerated bindings:\n_____\n${jsBindings
      .split('\n')
      .map((ln, idx) => `${(idx + 1).toString().padStart(4, ' ')} | ${ln}`)
      .join('\n')}\n-----\n`;
  }

  if (err) {
    console.error(err);
    const stderr = getStderr();
    if (stderr) {
      console.error(stderr);
    }
    exit(1);
  }

  // after wizering, stub out the wasi imports
  const finalBin = stubWasi(bin, enableStdout);

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
