import { strictEqual } from 'node:assert';

import { NIGHTMONKEY_TEST_ENABLED } from '../util.js';

export const source = `
  export async function run () {
    await new Promise(resolve => setTimeout(resolve, 1));
    throw new Error('panic');
  }
`;

export async function test(run) {
  try {
    await run();
  } catch (e) {
    const err = e.stderr.split('\n');
    strictEqual(err[0], 'panic');
    strictEqual(err[1], 'Stack:');
    // Frames of NightMonkey-compiled functions are not in the stack.
    if (!NIGHTMONKEY_TEST_ENABLED) {
      strictEqual(err[2], '  run@error-async.js:4:11');
    }
  }
}
