// import { Y } from 'imports';

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
  }
};
