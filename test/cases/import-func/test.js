import { ok } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.hello(), "world (5)");
}

export function err (e) {
  ok(e.message.includes('failed to encode a component from module'));
}
