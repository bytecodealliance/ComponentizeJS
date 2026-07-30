let disposeCount = 0;
const disposeSymbol = Symbol.dispose || Symbol.for('dispose');

class Example {
  constructor(id) {
    this.id = id;
  }

  getId() {
    return this.id;
  }

  [disposeSymbol]() {
    disposeCount += 1;
  }
}

export const resources = {
  Example,
  disposeCount() {
    return disposeCount;
  },
};
