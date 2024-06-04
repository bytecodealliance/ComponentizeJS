import { strictEqual, ok } from 'node:assert';

export const source = `
  let val, err, done = false;
  export function run () {
    (async () => {
      const res = await fetch('https://www.google.com');
      return res.text();
    })().then(text => {
      console.log(text);
      done = true;
    }, err => {
      console.error(err);
      done = true;
    });
  }
  export function ready () {
    return done;
  }
`;

export async function test(run) {
  const curNow = Date.now();
  const { stdout, stderr } = await run();
  console.log(stdout);
  ok(stdout.includes('google'));
  strictEqual(stderr, '');
}
