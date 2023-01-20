export function dropStream (f) {
  console.log(`Drop stream ${f}`);
}

export function setStdin (stdinBytes) {
  stdin = stdinBytes;
}

let stdin = new ArrayBuffer();
let stdinBytesRead = 0;

export function readStream (stream, len) {
  switch (stream) {
    case 0:
      if (stdin.byteLength <= stdinBytesRead) {
        return [new ArrayBuffer(), true];
      }
      const slice = stdin.slice(stdinBytesRead, len);
      stdinBytesRead += slice.byteLength;
      return [slice, stdinBytesRead === stdin.byteLength];
    default:
      throw new Error(`TODO: read ${stream}`);
  }
}

export function writeStream (stream, buf) {
  switch (stream) {
    case 0:
      console.error(`TODO: write stdin`);
      throw new Error(`TODO: write stdin`);
    case 1:
      process.stdout.write(buf);
      return buf.byteLength;
    case 2:
      process.stderr.write(buf);
      return buf.byteLength;
    default:
      throw new Error(`TODO: write ${stream}`);
  }
}