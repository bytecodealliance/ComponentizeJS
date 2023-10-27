import { ok } from 'node:assert';

export function test (instance) {
  ok(instance.getResult().includes('"content-type":"text/html'));
  ok(instance.getResult().includes('WebAssembly'));
}
