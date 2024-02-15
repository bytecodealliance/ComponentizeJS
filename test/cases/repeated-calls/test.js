import { strictEqual } from 'node:assert';

export function test (instance) {
  for (let i = 0; i < 2000; i++) {
    try {
      strictEqual(instance.exports.hello(), "hello");
    } catch (error) {
      error.message = `failed on attempt [${i}]: ` + error.message
      throw error;
    }
  }
}
