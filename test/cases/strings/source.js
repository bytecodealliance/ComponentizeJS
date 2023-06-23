import { a, b, c } from 'local:strings/strings';

export const strings = {
  a (x) {
    return a(x);
  },
  b () {
    return b();
  },
  c (a, b) {
    return c(a, b);
  }
};
