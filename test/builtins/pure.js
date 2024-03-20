import { strictEqual } from 'node:assert';

export const source = `
  let done = false;
  export function run () {
    console.log('no logging');
    done = true;
  }
  export function ready () {
    return done;
  }
`;

export const disableFeatures = ['stdio', 'random', 'clocks'];

export async function test(run) {
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  strictEqual(stdout, '');
}
