import { optionTest } from 'imports';

let run = 0;

export const exports = {
  optionTest () {
    switch (++run) {
      case 1: throw 'failure';
      case 2: return optionTest();
      case 3: return optionTest();
      case 4: return 'yay';
    }
  }
};
