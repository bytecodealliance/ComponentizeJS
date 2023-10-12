import { strictEqual } from 'node:assert';

export function test (instance) {
  const { X, Z, add, testImports } = instance.exports;
  const one = new Z(1);
  const two = new Z(2);
  strictEqual(add(one, two).getA(), 3);

  let x = new X(3);
  strictEqual(X.add(x, 4).getA(), 7);

  let x2 = new X(3);
  x2.setA(5);
  strictEqual(X.add(x2, 4).getA(), 9);

  strictEqual(testImports(), undefined);
}
