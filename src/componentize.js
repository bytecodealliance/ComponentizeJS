import wizer from "@jakechampion/wizer";
import { parse, componentNew, transpile } from "js-component-tools";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { splice } from "../dist/spidermonkey-embedding-splicer.js";
import { fileURLToPath } from "node:url";

export async function componentize(
  jsSources,
  witWorld,
  {
    engine = fileURLToPath(
      new URL('../dist/spidermonkey_embedding.wasm', import.meta.url)
    ),
    preview2Adapter = fileURLToPath(
      new URL('../deps/wasi_snapshot_preview1.wasm', import.meta.url)
    ),
  } = {}
) {
  if (typeof jsSources === 'string')
    jsSources = { 'source.js': jsSources };
  
  // TODO, fully derive the following:
  const imports = [
    {
      name: 'get-num',
      specifier: 'get-num',
      args: ['u32', 'u32'],
      ret: 'u32',
    },
  ];

  const expts = [
    {
      name: 'hello',
      args: [],
      ret: 'u32',
    },
  ];

  const importedWorld = `
interface hello {
  hello: func() -> string
}

world hello-world {
  import hello: hello

  default export interface {
    get-num: func(text: string) -> u32
  }
}
`;

  const importedWorldDummy = `(component
  (type (;0;)
    (instance
      (type (;0;) (func (result string)))
      (export (;0;) "hello" (func (type 0)))
    )
  )
  (import "hello" (instance (;0;) (type 0)))
  (core module (;0;)
    (type (;0;) (func (param i32)))
    (type (;1;) (func (param i32 i32) (result i32)))
    (type (;2;) (func (param i32 i32 i32 i32) (result i32)))
    (import "hello" "hello" (func (;0;) (type 0)))
    (func (;1;) (type 1) (param i32 i32) (result i32)
      unreachable
    )
    (func (;2;) (type 2) (param i32 i32 i32 i32) (result i32)
      unreachable
    )
    (memory (;0;) 0)
    (export "get-num" (func 1))
    (export "memory" (memory 0))
    (export "cabi_realloc" (func 2))
  )
  (core module (;1;)
    (type (;0;) (func (param i32)))
    (func $indirect-hello-hello (;0;) (type 0) (param i32)
      local.get 0
      i32.const 0
      call_indirect (type 0)
    )
    (table (;0;) 1 1 funcref)
    (export "0" (func $indirect-hello-hello))
    (export "$imports" (table 0))
  )
  (core module (;2;)
    (type (;0;) (func (param i32)))
    (import "" "0" (func (;0;) (type 0)))
    (import "" "$imports" (table (;0;) 1 1 funcref))
    (elem (;0;) (i32.const 0) func 0)
  )
  (core instance (;0;) (instantiate 1))
  (alias core export 0 "0" (core func (;0;)))
  (core instance (;1;)
    (export "hello" (func 0))
  )
  (core instance (;2;) (instantiate 0
      (with "hello" (instance 1))
    )
  )
  (alias core export 2 "memory" (core memory (;0;)))
  (alias core export 2 "cabi_realloc" (core func (;1;)))
  (alias core export 0 "$imports" (core table (;0;)))
  (alias export 0 "hello" (func (;0;)))
  (core func (;2;) (canon lower (func 0) (memory 0) (realloc 1) string-encoding=utf8))
  (core instance (;3;)
    (export "$imports" (table 0))
    (export "0" (func 2))
  )
  (core instance (;4;) (instantiate 2
      (with "" (instance 3))
    )
  )
  (alias core export 2 "get-num" (core func (;3;)))
  (type (;1;) (func (param "text" string) (result u32)))
  (func (;1;) (type 1) (canon lift (core func 3) (memory 0) (realloc 1) string-encoding=utf8))
  (export (;2;) "get-num" (func 1))
)`;

  {
    const { files } = await transpile(parse(importedWorldDummy));
    // console.log(new TextDecoder().decode(files['component.js']));
  }

  // js_bindgen::function(name, lift | lower)

  const sourceWithBindings = `
${jsSources[Object.keys(jsSources)[0]]}

// Custom Binding Setup
var memory0, realloc0, exports1, postReturn0, imports, lowering0Callee;
export function initBindings (_memory0, _realloc0, ${imports.map((_, i) => `import${i}`).join(', ')}) {
  memory0 = _memory0;
  realloc0 = _realloc0;
  exports1 = {
    'get-num': import0
  };
  postReturn0 = function () {}
  lowering0Callee = hello;
  imports = {
    'get-num': {
      getNum
    }
  };
}

// Intrinsics

var dv = new DataView(new ArrayBuffer());
var dataView = mem => dv.buffer === mem.buffer ? dv : dv = new DataView(mem.buffer);

var utf8Decoder = new TextDecoder();
var utf8Encoder = new TextEncoder();

var utf8EncodedLen = 0;
function utf8Encode(s, realloc, memory) {
  const buf = utf8Encoder.encode(s);
  const ptr = realloc(0, 0, 1, buf.byteLength);
  const out = new Uint8Array(memory.buffer, ptr, buf.byteLength);
  for (let i = 0; i < buf.byteLength; i++) {
    out[i] = buf[i];
  }
  utf8EncodedLen = buf.byteLength;
  return ptr;
}

// Standard Binding Generation (inverted)

function getNum(arg0) {
  const ptr0 = utf8Encode(arg0, realloc0, memory0);
  const len0 = utf8EncodedLen;
  const ret = exports1['get-num'](ptr0, len0);
  return ret >>> 0;
}

export function lowering0(arg0) {
  const ret = lowering0Callee();
  const ptr0 = utf8Encode(ret, realloc0, memory0);
  const len0 = utf8EncodedLen;
  dataView(memory0).setInt32(arg0 + 0, ptr0, true);
  dataView(memory0).setInt32(arg0 + 4, len0, true);
}
`;

  const input = join(tmpdir(), "in.wasm");
  const output = join(tmpdir(), "out.wasm");

  const spliced = splice(await readFile(engine), imports, expts);

  await writeFile(input, Buffer.from(spliced));

  const env = {
    SOURCE_LEN: new TextEncoder()
      .encode(sourceWithBindings)
      .byteLength.toString(),
    SOURCE_NAME: Object.keys(jsSources)[0],
    EXPORT_CNT: expts.length.toString(),
    IMPORT_CNT: imports.length.toString(),
  };

  for (let i = 0; i < expts.length; i++) {
    env['EXPORT' + i] = `lowering${i}`;
  }

  for (const [i, impt] of imports.entries()) {
    env['IMPORT' + i] = impt.name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
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
        stdio: [null, process.stdout, process.stderr],
        env,
        input: sourceWithBindings,
        shell: true,
        encoding: 'utf-8',
      }
    );
    if (wizerProcess.status !== 0)
      throw new Error('Wizering failed to complete');
  } catch (error) {
    console.error(
      `Error: Failed to compile JavaScript to Wasm\n`,
      error.message
    );
    await unlink(input);
    process.exit(1);
  }

  const unlinkPromises = Promise.all([unlink(input), unlink(output)]).catch(() => {});

  const bin = await readFile(output);

  // Check for initialization errors
  // By actually executing the binary in a mini sandbox to get back
  // the initialization state
  const { exports, getStderr } = await initWasm(bin);
  async function initWasm(bin) {
    const eep = (name) => () => {
      throw new Error(
        `Internal error: unexpected call to "${name}" during Wasm verification`
      );
    };

    let stderr = '';
    const module = await WebAssembly.compile(bin);

    const mockImports = {
      'wasi-logging2': {
        log: eep('log'),
      },
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

    for (const impt of imports) {
      mockImports[impt.specifier] = mockImports[impt.specifier] || {};
      mockImports[impt.specifier][impt.name] = eep(impt.name);
    }

    const { exports } = await WebAssembly.instantiate(module, mockImports);
    return {
      exports,
      getStderr() {
        return stderr;
      },
    };
  }

  const status = exports.check_init();
  switch (status) {
    case 1:
      throw new Error(
        `Error building JS: JS environment could not be initialized`
      );
    case 2:
      throw new Error(`Error building JS: JS intrinsics could not be defined`);
    case 3:
      throw new Error(
        `Error building JS: Platform intrinsics could not be defined`
      );
    case 4:
      throw new Error(
        `Error building JS: Unable to populate source code into Wasm`
      );
    case 5:
      console.error(`Error: Unable to compile JS source code\n`);
      // with some luck this _should_ be a lovely error stack
      console.error(getStderr());
      process.exit(1);
    case 6:
      throw new Error(
        `Error building JS: Unable to link the compiled source code`
      );
    case 7:
      console.error(getStderr());
      throw new Error(
        `Error building JS: Unable to execute the JS source code`
      );
    case 8:
      throw new Error(
        `Error building JS: Unable to extract expected function list`
      );
    case 9:
      throw new Error(
        `Error building JS: Unable to initialize JS binding memory buffer`
      );
    case 10:
      throw new Error(
        `Error building JS: Unable to create JS binding realloc function`
      );
    case 11:
      console.error(`Error: Unable to setup JS bindings\n`);
      console.error(getStderr());
      process.exit(1);
  }

  const component = componentNew(bin, {
    wit: witWorld,
    adapters: [['wasi_snapshot_preview1', await readFile(preview2Adapter)]],
  });

  return component;
}
