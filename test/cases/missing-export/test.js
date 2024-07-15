import { strictEqual } from 'node:assert';

export function err(e) {
  strictEqual(e.message, 'Expected a JS export definition for \'expected\'');
}
