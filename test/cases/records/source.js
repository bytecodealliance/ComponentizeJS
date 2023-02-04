import {
  tupleArg,
  tupleResult,
  emptyArg,
  emptyResult,
  scalarArg,
  scalarResult,
  flagsArg,
  flagsResult,
  aggregateArg,
  aggregateResult,
  typedefInout,
} from "imports";

export const exports = {
  tupleArg(x) {
    tupleArg(x);
  },
  tupleResult() {
    return tupleResult();
  },
  emptyArg(x) {
    emptyArg(x);
  },
  emptyResult() {
    return emptyResult();
  },
  scalarArg(x) {
    scalarArg(x);
  },
  scalarResult() {
    return scalarResult();
  },
  flagsArg(x) {
    flagsArg(x);
  },
  flagsResult() {
    return flagsResult();
  },
  aggregateArg(x) {
    aggregateArg(x);
  },
  aggregateResult() {
    return aggregateResult();
  },
  typedefInout(x) {
    return typedefInout(x);
  },
};
