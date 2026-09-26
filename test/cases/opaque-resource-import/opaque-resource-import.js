export let drops = 0;

export class Item {
  constructor(value) {
    this.value = value;
  }

  [Symbol.dispose]() {
    drops += 1;
  }
}

export const make = value => new Item(value);
export const value = item => item.value;
