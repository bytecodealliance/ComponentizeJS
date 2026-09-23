import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';
import { assert, beforeAll, suite, test } from 'vitest';

import { DEBUG_TEST_ENABLED, WEVAL_TEST_ENABLED, NIGHTMONKEY_TEST_ENABLED, maybeLogging } from './util.js';

const source = `
let saved;
export function echo(value) { return value; }
export function remember(value) {
  saved = [value, new TextEncoder().encode('x'.repeat(value.length))];
}
export function snapshot() { return saved; }
`;
const wit = `
package test:export-buffers;
world test {
  export echo: func(value: list<u8>) -> list<u8>;
  export remember: func(value: list<u8>);
  export snapshot: func() -> tuple<list<u8>, list<u8>>;
}
`;

let instantiate;
let coreModules;

beforeAll(async () => {
  const { component } = await componentize(source, {
    sourceName: 'export-buffers.js',
    witWorld: wit,
    disableFeatures: maybeLogging([
      'stdio', 'random', 'clocks', 'http', 'fetch-event',
    ]),
    debugBuild: DEBUG_TEST_ENABLED,
    enableAot: WEVAL_TEST_ENABLED,
    enableNightmonkey: NIGHTMONKEY_TEST_ENABLED,
  });
  const { files } = await transpile(component, {
    name: 'export-buffers',
    instantiation: 'sync',
  });
  const encodedBindings = Buffer.from(files['export-buffers.js']).toString('base64');
  const modulePromise = import(`data:text/javascript;base64,${encodedBindings}`);
  ({ instantiate } = await modulePromise);
  coreModules = new Map(
    Object.entries(files)
      .filter(([name]) => name.endsWith('.wasm'))
      .map(([name, bytes]) => [name, new WebAssembly.Module(bytes)]),
  );
});

function createInstance() {
  const memories = new Set();
  let realloc;
  const exports = instantiate(
    name => coreModules.get(name),
    {},
    (module, imports) => {
      const instance = new WebAssembly.Instance(module, imports);
      for (const value of Object.values(instance.exports)) {
        if (value instanceof WebAssembly.Memory) memories.add(value);
      }
      if (instance.exports.cabi_realloc) realloc = instance.exports.cabi_realloc;
      return instance;
    },
  );
  assert.equal(memories.size, 1);
  assert.isFunction(realloc);
  return { exports, memory: [...memories][0], realloc };
}

suite('Export buffer ownership', () => {
  test('repeated exports do not accumulate canonical buffers', () => {
    const { exports, memory } = createInstance();
    const input = new Uint8Array(64 * 1024).fill(0xab);
    for (let i = 0; i < 3000; i++) exports.echo(input);
    const before = memory.buffer.byteLength;
    for (let i = 0; i < 2000; i++) {
      const result = exports.echo(input);
      assert.lengthOf(result, input.length);
      assert.equal(result[0], 0xab);
      assert.equal(result.at(-1), 0xab);
    }
    // One leaked payload per call would add 125 MiB; allow for GC high-water growth.
    const growth = memory.buffer.byteLength - before;
    assert.isBelow(growth, 64 * 1024 * 1024, `Wasm memory grew by ${growth} bytes`);
  });

  test('retains JS-owned buffers and handles empty allocations', () => {
    const { exports, realloc } = createInstance();
    const input = Uint8Array.from({ length: 4096 }, (_, i) => i & 0xff);
    const saved = [
      input.slice(),
      new TextEncoder().encode('x'.repeat(input.length)),
    ];
    exports.remember(input);
    for (let i = 0; i < 100; i++) {
      input.fill(i);
      assert.deepEqual(exports.echo(input), input);
    }
    assert.deepEqual(exports.snapshot(), saved);

    for (const align of [1, 2, 4, 8]) {
      assert.equal(realloc(0, 0, align, 0), 0);
      const ptr = realloc(align, 0, align, 16);
      assert.notEqual(ptr, 0);
      assert.equal(ptr % align, 0);
      assert.equal(realloc(ptr, 16, align, 0), 0);
    }
    const empty = new Uint8Array();
    exports.remember(empty);
    for (let i = 0; i < 100; i++) assert.deepEqual(exports.echo(empty), empty);
    assert.deepEqual(exports.snapshot(), [empty, empty]);
  });
});
