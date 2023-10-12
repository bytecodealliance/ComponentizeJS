import { Y } from 'imports';

class X {
  constructor (a) {
    this.a = a;
  }
  getA () {
    return this.a;
  }
  setA (a) {
    this.a = a;
  }
  static add (x, a) {
    x.setA(x.getA() + a);
    return x;
  }
}

class Z {
    constructor (a) {
    this.a = a;
  }
  getA () {
    return this.a;
  }
}

const my_zeds = [];

for (let i = 0; i < 100; i++) {
  my_zeds.push(new Z(i));
}

export const exports = {
  X,
  Z,
  add (a, b) {
    return new Z(a.getA() + b.getA());
  },
  testImports () {
    let y = new Y(3);
    const sum1 = Y.add(y, 4).getA();
    if (sum1 != 7) {
      return { tag: 'err', value: `expected 7; got ${sum1}` };
    }

    y.setA(5);
    const sum2 = Y.add(y, 4).getA();
    if (sum2 != 9) {
      return { tag: 'err', value: `expected 9; got ${sum2}` };
    }

    return { tag: 'ok' };
  }
};
