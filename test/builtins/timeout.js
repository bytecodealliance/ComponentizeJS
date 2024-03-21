import { strictEqual, ok } from 'node:assert';

export const source = `
  let done = false;
  export function run () {
    console.log(Date.now());
    setTimeout(() => {
      console.log(Date.now());
      done = true;
    }, 100);
  }
  export function ready () {
    return done;
  }
`;

export async function test(run) {
  const { stdout, stderr } = await run();
  const [timestart, timeend] = stdout.split('\n');
  strictEqual(stderr, '');
  ok(Number(timeend) - Number(timestart) >= 100);
}
