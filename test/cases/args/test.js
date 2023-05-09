import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.countA('how many a\'s are there in this string?'), 3);
}
