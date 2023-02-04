let localList;

export function simpleList1 (list) {
  localList = list;
}

export function simpleList2 () {
  return localList;
}

export function simpleList4 (list) {
  list[0] = [0];
  return list;
}
