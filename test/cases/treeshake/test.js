import { ok, deepStrictEqual } from 'node:assert';

export function test (instance, { imports, exports }) {
  deepStrictEqual(imports, [['imports', 'y']]);
  deepStrictEqual(exports, ['usedHello']);
  ok(globalThis.y === false);
  instance.usedHello();
  ok(globalThis.y === true);
  ok(instance);
}
