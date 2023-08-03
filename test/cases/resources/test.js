import { strictEqual } from 'node:assert';

export function test (instance) {
  const { X, Z, add } = instance.exports;
  const one = new Z(1);
  const two = new Z(2);
  strictEqual(add(one, two).getA(), 3);
}
