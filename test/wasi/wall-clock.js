export function now (clock) {
  console.log('WALL CLOCK');
  if (clock === 1) {
    const seconds = BigInt(Math.floor(Date.now() / 1000));
    const nanoseconds = Date.now() % 1000 * 1000 * 1000;
    return { seconds, nanoseconds };
  }
  console.log('UNKNOWN CLOCK');
}

export function resolution (clock) {
  console.log(`Wall clock resolution ${clock}`);
}
