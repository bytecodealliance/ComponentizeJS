import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { assert, test } from 'vitest';

import { splicer } from '../lib/spidermonkey-embedding-splicer.js';

import {
  DEBUG_TEST_ENABLED,
  NIGHTMONKEY_TEST_ENABLED,
  WEVAL_TEST_ENABLED,
} from './util.js';

test('frees an imported string and its return area after copying', async () => {
  const wit = `
package test:import-return-buffers;
interface host {
  read: func() -> string;
}
world test {
  import host;
}
`;
  const engineName = WEVAL_TEST_ENABLED
    ? 'starlingmonkey_embedding_weval.wasm'
    : NIGHTMONKEY_TEST_ENABLED
    ? 'starlingmonkey_embedding_nightmonkey.wasm'
    : `starlingmonkey_embedding${DEBUG_TEST_ENABLED ? '.debug' : ''}.wasm`;
  const engine = await readFile(new URL(`../lib/${engineName}`, import.meta.url));
  const { jsBindings } = splicer.spliceBindings(
    engine, [], wit, undefined, undefined, false,
  );
  const memory = new WebAssembly.Memory({ initial: 1 });
  const bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);
  const text = 'café 🦀';
  const encoded = new TextEncoder().encode(text);
  const returnPtr = 8;
  const dataPtr = 16;

  // The indirect return area is an 8-byte (data pointer, byte length) pair.
  view.setUint32(returnPtr, dataPtr, true);
  view.setUint32(returnPtr + 4, encoded.length, true);
  bytes.set(encoded, dataPtr);

  let host;
  const freed = [];
  new Script(jsBindings).runInNewContext({
    WebAssembly: undefined,
    contentGlobal: { TextEncoder, TextDecoder },
    defineBuiltinModule(name, exports) {
      assert.equal(name, 'test:import-return-buffers/host');
      host = exports;
    },
    $bindings: [
      memory,
      () => assert.fail('unexpected allocation for an import parameter'),
      (ptr, size = 8) => {
        freed.push(ptr);
        bytes.fill(0xdd, ptr, ptr + size);
      },
      () => returnPtr,
    ],
  });

  assert.equal(host.read(), text);
  assert.deepEqual(freed, [dataPtr, returnPtr]);
});
