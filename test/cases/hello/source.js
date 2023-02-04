import { getNum } from 'get-num';

export const exports = {
  hello (str) {
    return `world ${str} (${getNum('world')})`;
  }
};
