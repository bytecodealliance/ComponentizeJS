import { strictEqual } from 'node:assert';

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
    strictEqual(err[2], '  run@error-async.js:4:11');
  }
}
