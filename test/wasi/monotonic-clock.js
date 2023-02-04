import { hrtime } from 'node:process';

export function resolution(clock) {
  console.log(`Monotonic clock resolution ${clock}`);
}

let hrStart = hrtime.bigint();

export function now (clock) {
  if (clock === 0) {
    // console.log(`clock ${clock} ${hrtime.bigint() - hrStart}`);
    return hrtime.bigint() - hrStart;
  }
  console.log('UNKNOWN CLOCK');
}
