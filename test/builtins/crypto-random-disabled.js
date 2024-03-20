import { strictEqual, ok } from 'node:assert';

export const source = `
  export function run () {
    const out = new Uint32Array(9);
    crypto.getRandomValues(out);
    console.log(out.join('\\n'));
  }
  export function ready () {
    return true;
  }
`;

export const disableFeatures = ['random'];

export async function test(run) {
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  const randoms = stdout.split('\n');
  for (let i = 0; i < 9; i++) {
    ok(Number(randoms[i]) > 0);
  }
  // NOT random
  strictEqual(Number(randoms[0]), 2078830796);
}
