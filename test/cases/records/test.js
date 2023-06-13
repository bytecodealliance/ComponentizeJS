import { deepStrictEqual, strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.records.tupleArg(['z', 23]), undefined);
  deepStrictEqual(instance.records.tupleResult(), ['z', 23]);
}
