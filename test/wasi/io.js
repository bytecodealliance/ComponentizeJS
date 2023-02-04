export function dropInputStream (s) {
  console.log(`DROP INPUT STREAM ${s}`);
}

export function write (stream, buf) {
  switch (stream) {
    case 0:
      console.error(`TODO: write stdin`);
      throw new Error(`TODO: write stdin`);
    case 1:
      process.stdout.write(buf);
      return BigInt(buf.byteLength);
    case 2:
      process.stderr.write(buf);
      return BigInt(buf.byteLength);
    default:
      throw new Error(`TODO: write ${stream}`);
  }
}

export function read (s) {
  console.log(`READ INPUT STREAM ${s}`);
}

export function dropOutputStream (s) {
  console.log(`DROP INPUT STREAM ${s}`);
}
