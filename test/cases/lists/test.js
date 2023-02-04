import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exportLists.listU8Param(new Uint8Array([1,2,3])), undefined);
}
