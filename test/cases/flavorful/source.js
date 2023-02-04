import {
  fListInRecord1,
  fListInRecord2,
  fListInRecord3,
  fListInRecord4,
  fListInVariant1,
  fListInVariant2,
  fListInVariant3,
  errnoResult,
  listTypedefs,
  listOfVariants,
} from "imports";

export const exports = {
  fListInRecord1(a) {
    fListInRecord1(a);
  },
  fListInRecord2() {
    return fListInRecord2();
  },
  fListInRecord3(a) {
    return fListInRecord3(a);
  },
  fListInRecord4(a) {
    return fListInRecord4(a);
  },
  fListInVariant1(a, b, c) {
    fListInVariant1(a, b, c);
  },
  fListInVariant2() {
    return fListInVariant2();
  },
  fListInVariant3(a) {
    return fListInVariant3(a);
  },
  errnoResult() {
    return errnoResult();
  },
  listTypedefs(a, c) {
    return listTypedefs(a, c);
  },
  listOfVariants(a, b, c) {
    return listOfVariants(a, b, c);
  },
};

export function testImports() {}
