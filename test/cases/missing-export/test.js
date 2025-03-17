import { strictEqual } from 'node:assert';

export function err(e) {
  strictEqual(e.message, `Unable to extract expected exports list
Error: "missing-export.js" does not export a "expected" function as expected by the world.
  Try defining it:
  export function expected() {};`);
}
