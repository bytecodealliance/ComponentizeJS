import { simpleList1, simpleList2, simpleList4 } from 'local:simple-lists/simple-lists';

export const simpleLists = {
  simpleList1 (list) {
    simpleList1(list);
  },
  simpleList2 () {
    return simpleList2();
  },
  simpleList4 (list) {
    return simpleList4(list);
  }
};
