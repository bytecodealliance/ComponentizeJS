import { strictEqual, ok } from 'node:assert';

const FETCH_URL = 'https://httpbin.org/anything';

export const source = `
  export async function run () {
    const res = await fetch('${FETCH_URL}');
    const source = await res.json();
    console.log(source.url);
  }
  export function ready () {
    return true;
  }
`;

export const enableFeatures = ['http'];

export async function test(run) {
  let retries = 3;
  let stdout, stderr;
  while (retries > 0) {
    try {
      const result = await run();
      stdout = result.stdout;
      stderr = result.stderr;
      break;
    } catch (err) {
      console.error('failed to fetch URL', err);
    }
    retries -= 1;
  }
  strictEqual(stderr, '');
  strictEqual(stdout.trim(), FETCH_URL);
}
