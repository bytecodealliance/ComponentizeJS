import { strictEqual, ok } from 'node:assert';

export const source = `
  export async function run () {
    const res = await fetch('https://httpbin.org/anything');
    const source = await res.json();
    console.log(source.url);
  }
  export function ready () {
    return true;
  }
`;

export const enableFeatures = ['http'];

export async function test(run) {
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  strictEqual(stdout.trim(), 'https://httpbin.org/anything');
}
