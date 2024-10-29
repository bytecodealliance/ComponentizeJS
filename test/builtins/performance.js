import { ok, strictEqual } from 'node:assert';

export const source = `
  export function run () {
    const start = performance.now();
    let previous = 0, cur = 1;
    for (let i = 1; i < 1000; i++) {
      const tmp = cur;
      cur = previous + cur;
      previous = tmp;
    }
    const end = performance.now();
    console.log('Calculated fib 1000: ' + cur);
    console.error((end - start) + ' ms');
  };
`;

export async function test (run) {
  const { stdout, stderr } = await run();
  strictEqual(stdout, 'Calculated fib 1000: 4.346655768693743e+208\n');

  ok(stderr.includes(' ms'));
  const time = Number(stderr.split(' ms')[0]);
  if (time > 0.5) {
    throw new Error('took more than half a millisecond - ' + time + ' ms');
  }
}
