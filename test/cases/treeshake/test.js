import { strictEqual, deepStrictEqual } from 'node:assert';

export function test(instance, { imports }) {
  deepStrictEqual(imports, [['imports', 'y']]);
  instance.hello();
  strictEqual(globalThis.y, true);
}
