import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.hello('hmm'), "world hmm (5)");
}
