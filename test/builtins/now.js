import { strictEqual, ok } from 'node:assert';

export const source = `
  export function run () {
    console.log(Date.now());
    globalThis.stuff = [];
    for (let i = 0; i < 1000; i++)
      globalThis.stuff.push(i);
    console.log(Date.now());
  }
  export function ready () {
    return true;
  }
`;

export async function test(run) {
  const curNow = Date.now();
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  const times = stdout.split('\n');
  ok(Number(times[0]) > curNow);
  ok(times[1] - times[0] > 0);
}
