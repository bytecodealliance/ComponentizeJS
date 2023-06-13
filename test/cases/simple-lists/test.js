import { strictEqual, deepStrictEqual } from "node:assert";

export function test(instance) {
  strictEqual(
    instance.simpleLists.simpleList1(new Uint32Array([1, 2, 3])),
    undefined
  );
  deepStrictEqual(instance.simpleLists.simpleList2(), new Uint32Array([1, 2, 3]));
  deepStrictEqual(
    instance.simpleLists.simpleList4([
      new Uint32Array([1, 2, 3]),
      new Uint32Array([2, 3, 4]),
    ]),
    [new Uint32Array([0]), new Uint32Array([2, 3, 4])]
  );
}
