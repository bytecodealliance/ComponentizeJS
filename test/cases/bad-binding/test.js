import { strictEqual } from 'node:assert';

export function err (error) {
  strictEqual(error.message, "Import 'not:world-defined' is not defined by the WIT world. Make sure to use a bundler for JS dependencies such as esbuild or RollupJS. Future ComponentizeJS versions may include Node.js builtins and bundling.");
}
