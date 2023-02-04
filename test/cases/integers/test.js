import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.a1(5), undefined);
  strictEqual(instance.exports.r1(), 5);

  strictEqual(instance.exports.a2(-5), undefined);
  strictEqual(instance.exports.r2(), -5);

  strictEqual(instance.exports.a3(100), undefined);
  strictEqual(instance.exports.r3(), 100);

  strictEqual(instance.exports.a4(-100), undefined);
  strictEqual(instance.exports.r4(), -100);

  strictEqual(instance.exports.a5(5000), undefined);
  strictEqual(instance.exports.r5(), 5000);

  strictEqual(instance.exports.a6(-5000), undefined);
  strictEqual(instance.exports.r6(), -5000);

  strictEqual(instance.exports.a7(500000n), undefined);
  strictEqual(instance.exports.r7(), 500000n);

  // TODO: negative bigints
  // strictEqual(instance.exports.a8(-500000n), undefined);
  // strictEqual(instance.exports.r8(), -500000n);

  // deepStrictEqual(instance.exports.pairRet(), [-999, 1]);
}
