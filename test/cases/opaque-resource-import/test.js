import { strictEqual } from 'node:assert';
import { drops } from './opaque-resource-import.js';

export function test(instance) {
  strictEqual(instance.test(), 42);
  strictEqual(drops, 1);
}
