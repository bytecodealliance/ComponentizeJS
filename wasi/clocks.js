import { hrtime } from 'node:process';

export function wallClockNow (clock) {
  console.log('WALL CLOCK');
  if (clock === 1) {
    const seconds = BigInt(Math.floor(Date.now() / 1000));
    const nanoseconds = Date.now() % 1000 * 1000 * 1000;
    return { seconds, nanoseconds };
  }
  console.log('UNKNOWN CLOCK');
}

export function monotonicClockResolution(clock) {
  console.log(`Monotonic clock resolution ${clock}`);
}

export function wallClockResolution(clock) {
  console.log(`Wall clock resolution ${clock}`);
}

let hrStart = hrtime.bigint();

export function monotonicClockNow (clock) {
  if (clock === 0) {
    // console.log(`clock ${clock} ${hrtime.bigint() - hrStart}`);
    return hrtime.bigint() - hrStart;
  }
  console.log('UNKNOWN CLOCK');
}
