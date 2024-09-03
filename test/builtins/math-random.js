import { strictEqual, ok } from 'node:assert';

export const source = `
  export function run () {
    console.log(Math.random());
  }
`;

export async function test(run) {
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  ok(Number(stdout) > 0 && Number(stdout) < 1);
}
