import { strictEqual, ok } from 'node:assert';

export const source = `
  export function run () {
    const out = new Uint32Array(10);
    crypto.getRandomValues(out);
    console.log(out.join('\\n'));
  }
  export function ready () {
    return true;
  }
`;

export async function test(run) {
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  const randoms = stdout.split('\n');
  for (let i = 0; i < 10; i++) {
    ok(Number(randoms[i]) > 0);
  }
}
