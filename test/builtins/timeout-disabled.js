import { strictEqual, ok } from 'node:assert';

export const source = `
  export async function run () {
    console.log(Date.now());

    // causes a panic
    await new Promise(resolve => setTimeout(() => {
      console.log(Date.now());
      resolve();
    }, 100));
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
