import { ok } from 'node:assert';

export function test (instance) {
  ok(instance.getResult().includes('WebAssembly'));
}
