import { ok, strictEqual } from 'node:assert';

export const source = `
  export function run () {
    performance.now();
  };
`;

export const disableFeatures = ['clocks'];

export async function test (run) {
  try {
    const { stdout, stderr } = await run();
    ok(false);
  } catch {
    // performance builtin just panics
    // (yes we can and should do better...)
  }
}
