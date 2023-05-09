export const exports = {
  countA (str) {
    let cnt = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === 'a')
        cnt++;
    }
    return cnt;
  }
};
