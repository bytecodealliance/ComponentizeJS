import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.y(), undefined);
}
