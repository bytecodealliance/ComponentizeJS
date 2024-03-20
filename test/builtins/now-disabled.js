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

export const disableFeatures = ['clocks'];

export async function test(run) {
  const curNow = Date.now();
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  const times = stdout.split('\n');

  // verify now was taken at build time (within than 5 seconds ago)
  ok(Number(times[0]) < curNow);
  ok(Number(times[0]) > curNow - 5000);

  // verify disabled time doesn't progress
  strictEqual(times[1], times[0]);
}
