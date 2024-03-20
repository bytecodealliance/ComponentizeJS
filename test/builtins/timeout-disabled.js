import { strictEqual, ok } from 'node:assert';

export const source = `
  let done = false;
  export function run () {
    console.log(Date.now());

    // causes a panic
    setTimeout(() => {
      console.log(Date.now());
      done = true;
    }, 100);
  }
  export function ready () {
    return done;
  }
`;

export const disableFeatures = ['clocks'];

export async function test(run) {
  try {
    await run();
  }
  catch (e) {
    const { stdout, stderr, err } = e;
    const [timestart, timeend] = stdout.split('\n');
    ok(stderr.includes('RuntimeError: unreachable'));
    ok(Number(timestart) > 0);
    strictEqual(timeend, '');
  }
}
