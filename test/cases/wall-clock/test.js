import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.test().slice(0, 10), `NOW: ${Date.now()}`.slice(0, 10));
}
