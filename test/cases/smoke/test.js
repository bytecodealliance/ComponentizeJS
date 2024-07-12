import { ok, strictEqual } from 'node:assert';

export function test (instance, { imports, exports }) {
  strictEqual(imports.length, 0);
  strictEqual(exports.length, 0);
  ok(instance);
}
