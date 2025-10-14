import { strictEqual, ok } from 'node:assert';

export const source = `
  export function run () {
    console.log(Date.now());
    globalThis.stuff = [];
    for (let i = 0; i < 1000; i++)
      globalThis.stuff.push(i);
    console.log(Date.now());
  }
`;

export const disableFeatures = ['clocks'];

export async function test(run) {
  const curNow = Date.now();
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  const times = stdout.split('\n');

  // verify now was taken at build time
  // NOTE: While build time is expected to be within 15 seconds,
  // we avoid ensuring a specific bound on build time due to the
  // unreliability of combinations of CI systems and specific OSes
  ok(Number(times[0]) < curNow);

  // verify disabled time doesn't progress
  strictEqual(times[1], times[0]);
}
