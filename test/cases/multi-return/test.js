import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.multiReturn.mra(), undefined);
  deepStrictEqual(instance.multiReturn.mrb(), undefined);
  strictEqual(instance.multiReturn.mrc(), 23);
  deepStrictEqual(instance.multiReturn.mrd(), 44);
  deepStrictEqual(instance.multiReturn.mre(), [1, 1.5]);
}
