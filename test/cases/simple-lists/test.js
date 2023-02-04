import { strictEqual, deepStrictEqual } from "node:assert";

export function test(instance) {
  strictEqual(
    instance.exports.simpleList1(new Uint32Array([1, 2, 3])),
    undefined
  );
  deepStrictEqual(instance.exports.simpleList2(), new Uint32Array([1, 2, 3]));
  deepStrictEqual(
    instance.exports.simpleList4([
      new Uint32Array([1, 2, 3]),
      new Uint32Array([2, 3, 4]),
    ]),
    [new Uint32Array([0]), new Uint32Array([2, 3, 4])]
  );
}
