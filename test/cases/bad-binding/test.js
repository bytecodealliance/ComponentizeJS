import { match } from 'node:assert';

export function err (error) {
  match(error.message, /ReferenceError: Error loading module "not:world-defined"/);
}
