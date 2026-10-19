import { make, value } from 'test:test/opaque-resource-import';

export function test() {
  const item = make(42);
  try {
    return value(item);
  } finally {
    item[Symbol.dispose]();
  }
}
