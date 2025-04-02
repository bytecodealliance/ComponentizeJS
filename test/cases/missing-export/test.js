import { match } from 'node:assert';

// use match instead of strictEqual to enable testing between linux and windows
// Windows errors prefix the error with file path
export function err(e) {
  match(e.message, /Error: "missing-export.js" does not export a "expected" function/);
  match(e.message, /Try defining it:/);
  match(e.message, /export function expected\(\) {};/);
}
