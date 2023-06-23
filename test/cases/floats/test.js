import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.floats.float32Param(1.5), undefined);
  strictEqual(instance.floats.float64Param(1.51111111111111), undefined);
  strictEqual(instance.floats.float32Result(), 1.5);
  strictEqual(instance.floats.float64Result(), 1.51111111111111);
}
