import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.mra(), undefined);
  deepStrictEqual(instance.exports.mrb(), undefined);
  strictEqual(instance.exports.mrc(), 23);
  deepStrictEqual(instance.exports.mrd(), 44);
  deepStrictEqual(instance.exports.mre(), [1, 1.5]);
}
