import { deepStrictEqual } from "node:assert";

export function test(instance) {
  deepStrictEqual(instance.flags.roundtripFlag1({ b0: false }), {
    b0: true,
  });
  deepStrictEqual(instance.flags.roundtripFlag2({ b0: true }), {
    b0: true,
    b1: true,
  });
  deepStrictEqual(instance.flags.roundtripFlag4({ b0: true }), {
    b0: true,
    b1: false,
    b2: false,
    b3: true,
  });
  deepStrictEqual(instance.flags.roundtripFlag8({ b0: true }), {
    b0: true,
    b1: false,
    b2: false,
    b3: false,
    b4: false,
    b5: false,
    b6: false,
    b7: true,
  });
  deepStrictEqual(instance.flags.roundtripFlag16({ b0: true }), {
    b0: true,
    b1: false,
    b2: false,
    b3: false,
    b4: false,
    b5: false,
    b6: false,
    b7: false,
    b8: false,
    b9: false,
    b10: false,
    b11: false,
    b12: false,
    b13: false,
    b14: false,
    b15: true,
  });
  deepStrictEqual(instance.flags.roundtripFlag32({ b0: true }), {
    b0: true,
    b1: false,
    b2: false,
    b3: false,
    b4: false,
    b5: false,
    b6: false,
    b7: false,
    b8: false,
    b9: false,
    b10: false,
    b11: false,
    b12: false,
    b13: false,
    b14: false,
    b15: false,
    b16: false,
    b17: false,
    b18: false,
    b19: false,
    b20: false,
    b21: false,
    b22: false,
    b23: false,
    b24: false,
    b25: false,
    b26: false,
    b27: false,
    b28: false,
    b29: false,
    b30: false,
    b31: true,
  });
}
