import { hello as hello1 } from 'local:hello/hello';
import { hello as hello2 } from 'local:hello-second/hello';

export const exports = {
  hello(str) {
    if (str === 'hello') {
      return `world ${str} (${hello1('world')})`;
    }
    if (str === 'hello-second') {
      return `world ${str} (${hello2('world')})`;
    }
    return `world unknown ${str}`;
  },
};
