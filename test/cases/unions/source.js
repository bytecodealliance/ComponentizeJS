import {
  addOneInteger,
  addOneFloat,
  replaceFirstChar,
  identifyInteger,
  identifyFloat,
  identifyText,
  addOneDuplicated,
  identifyDuplicated,
  addOneDistinguishableNum,
  identifyDistinguishableNum,
} from "import-unions";

export const exportUnions = {
  addOneInteger(num) {
    return addOneInteger(num);
  },
  addOneFloat(num) {
    return addOneFloat(num);
  },
  replaceFirstChar(text, letter) {
    return replaceFirstChar(text, letter);
  },
  identifyInteger(num) {
    return identifyInteger(num);
  },
  identifyFloat(num) {
    return identifyFloat(num);
  },
  identifyText(text) {
    return identifyText(text);
  },
  addOneDuplicated(num) {
    return addOneDuplicated(num);
  },
  identifyDuplicated(num) {
    return identifyDuplicated(num);
  },
  addOneDistinguishableNum(num) {
    return addOneDistinguishableNum(num);
  },
  identifyDistinguishableNum(num) {
    return identifyDistinguishableNum(num);
  },
};
