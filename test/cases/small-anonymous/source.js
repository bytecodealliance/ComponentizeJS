import { optionTest } from 'local:small-anonymous/anon';

let run = 0;

export const anon = {
  optionTest () {
    switch (++run) {
      case 1: throw 'failure';
      case 2: return optionTest();
      case 3: return optionTest();
      case 4: return 'yay';
    }
  }
};
