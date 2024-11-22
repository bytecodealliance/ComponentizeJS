export default class Thing {
  constructor(v) {
    this.v = v;
  }
  get() {
    return this.v;
  }
  set(v) {
    this.v = v;
  }
}
