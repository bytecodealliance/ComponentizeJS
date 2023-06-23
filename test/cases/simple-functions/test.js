import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.simple.f1(), undefined);
  strictEqual(instance.simple.f2(1), undefined);
  strictEqual(instance.simple.f3(2, 3), undefined);
  strictEqual(instance.simple.f4(), 11);
  deepStrictEqual(instance.simple.f5(), [11, 13]);
  deepStrictEqual(instance.simple.f6(1, 2, 3), [12, 13, 14]);
}
