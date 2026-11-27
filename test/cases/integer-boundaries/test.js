import { strictEqual, deepStrictEqual } from 'node:assert';
export function test({ integers }) {
  for (const x of [0, 1, 2147483647, 2147483648, 4294967295]) {
    strictEqual(integers.u32(x), x);
  }
  for (const x of [-2147483648, -1, 0, 2147483647]) {
    strictEqual(integers.s32(x), x);
  }
  for (const x of [
    0n,
    1n,
    9223372036854775807n,
    9223372036854775808n,
    18446744073709551615n,
  ]) {
    strictEqual(integers.u64(x), x);
  }
  for (const x of [-9223372036854775808n, -1n, 0n, 9223372036854775807n]) {
    strictEqual(integers.s64(x), x);
  }
  strictEqual(integers.directU32(), 4294967295);
  strictEqual(integers.directS64(), -9223372036854775808n);
  deepStrictEqual(integers.pair(-9223372036854775808n, 4294967295), [
    -9223372036854775808n,
    4294967295,
  ]);
}
