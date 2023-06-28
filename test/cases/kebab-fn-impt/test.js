import { strictEqual } from 'node:assert';
import { log } from './print.js';

export function test (instance) {
  instance.run('hi');
  strictEqual(log, 'hi');
}
