import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.f1(), undefined);
  strictEqual(instance.exports.f2(1), undefined);
  strictEqual(instance.exports.f3(2, 3), undefined);
  strictEqual(instance.exports.f4(), 11);
  deepStrictEqual(instance.exports.f5(), [11, 13]);
  deepStrictEqual(instance.exports.f6(1, 2, 3), [12, 13, 14]);
}
