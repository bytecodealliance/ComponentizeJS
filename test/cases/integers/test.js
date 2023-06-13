import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.integers.a1(5), undefined);
  strictEqual(instance.integers.r1(), 5);

  strictEqual(instance.integers.a2(-5), undefined);
  strictEqual(instance.integers.r2(), -5);

  strictEqual(instance.integers.a3(100), undefined);
  strictEqual(instance.integers.r3(), 100);

  strictEqual(instance.integers.a4(-100), undefined);
  strictEqual(instance.integers.r4(), -100);

  strictEqual(instance.integers.a5(5000), undefined);
  strictEqual(instance.integers.r5(), 5000);

  strictEqual(instance.integers.a6(-5000), undefined);
  strictEqual(instance.integers.r6(), -5000);

  strictEqual(instance.integers.a7(500000n), undefined);
  strictEqual(instance.integers.r7(), 500000n);

  // TODO: negative bigints
  // strictEqual(instance.integers.a8(-500000n), undefined);
  // strictEqual(instance.integers.r8(), -500000n);

  // deepStrictEqual(instance.integers.pairRet(), [-999, 1]);
}
