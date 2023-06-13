let firstRun = true;

export function optionTest () {
  if (firstRun) {
    firstRun = false;
    throw 'success';
  } else {
    return 'outer';
  }
}
