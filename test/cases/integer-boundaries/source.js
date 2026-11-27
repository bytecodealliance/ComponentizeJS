import * as host from 'local:integer-boundaries/integers';
export const integers = {
  u32: x => host.u32(x),
  s32: x => host.s32(x),
  u64: x => host.u64(x),
  s64: x => host.s64(x),
  pair: (x, y) => host.pair(x, y),
  directU32: () => 4294967295,
  directS64: () => -9223372036854775808n,
};
