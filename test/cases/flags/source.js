import {
  roundtripFlag1,
  roundtripFlag2,
  roundtripFlag4,
  roundtripFlag8,
  roundtripFlag16,
  roundtripFlag32,
  roundtripFlag64
} from 'local:flags/flags';

export const flags = {
  roundtripFlag1 (f) {
    return roundtripFlag1(f);
  },
  roundtripFlag2 (f) {
    return roundtripFlag2(f);
  },
  roundtripFlag4 (f) {
    return roundtripFlag4(f);
  },
  roundtripFlag8 (f) {
    return roundtripFlag8(f);
  },
  roundtripFlag16 (f) {
    return roundtripFlag16(f);
  },
  roundtripFlag32 (f) {
    return roundtripFlag32(f);
  },
  roundtripFlag64 (f) {
    return roundtripFlag64(f);
  }
};
