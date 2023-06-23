import { strictEqual, deepStrictEqual } from "node:assert";

export function test(instance) {
  const args = [
    1n,
    2n,
    3n,
    4n,
    5n,
    6n,
    7n,
    8n,
    9n,
    10n,
    11n,
    12n,
    13n,
    14n,
    15n,
    16n,
  ];
  strictEqual(instance.manyarg.manyArgs(...args), undefined);
  deepStrictEqual(globalThis.args, args);
  const struct = {
    a1: '1n',
    a2: '2n',
    a3: '3n',
    a4: '4n',
    a5: '5n',
    a6: '6n',
    a7: '7n',
    a8: '8n',
    a9: '9n',
    a10: '10n',
    a11: '11n',
    a12: '12n',
    a13: '13n',
    a14: '14n',
    a15: '15n',
    a16: '16n',
    a17: '17n',
    a18: '18n',
    a19: '19n',
    a20: '20n',
  };
  strictEqual(instance.manyarg.bigArgument(struct), undefined);
  deepStrictEqual(globalThis.struct, struct);
}
