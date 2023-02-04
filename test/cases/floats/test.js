import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.float32Param(1.5), undefined);
  strictEqual(instance.exports.float64Param(1.51111111111111), undefined);
  strictEqual(instance.exports.float32Result(), 1.5);
  strictEqual(instance.exports.float64Result(), 1.51111111111111);
}
