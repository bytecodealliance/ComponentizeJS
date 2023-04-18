import { strictEqual } from 'node:assert';

export const source = `
  export function run () {
    console.log('test');
  }
`;

export async function test (run) {
  const { stdout, stderr } = await run();
  strictEqual(stdout, 'test\n');
  strictEqual(stderr, '');
}
