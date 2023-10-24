import { environment, exit as exit$1, stderr, stdin, stdout, terminalInput, terminalOutput, terminalStderr, terminalStdin, terminalStdout } from '@bytecodealliance/preview2-shim/cli';
import { preopens, types } from '@bytecodealliance/preview2-shim/filesystem';
import { streams } from '@bytecodealliance/preview2-shim/io';
import { random } from '@bytecodealliance/preview2-shim/random';
const { getEnvironment } = environment;
const { exit } = exit$1;
const { getStderr } = stderr;
const { getStdin } = stdin;
const { getStdout } = stdout;
const { TerminalInput } = terminalInput;
const { TerminalOutput } = terminalOutput;
const { getTerminalStderr } = terminalStderr;
const { getTerminalStdin } = terminalStdin;
const { getTerminalStdout } = terminalStdout;
const { getDirectories } = preopens;
const { Descriptor,
  DirectoryEntryStream,
  filesystemErrorCode } = types;
const { Error: Error$1,
  InputStream,
  OutputStream } = streams;
const { getRandomBytes } = random;

const base64Compile = str => WebAssembly.compile(typeof Buffer !== 'undefined' ? Buffer.from(str, 'base64') : Uint8Array.from(atob(str), b => b.charCodeAt(0)));

class ComponentError extends Error {
  constructor (value) {
    const enumerable = typeof value !== 'string';
    super(enumerable ? `${String(value)} (see error.payload)` : value);
    Object.defineProperty(this, 'payload', { value, enumerable });
  }
}

let dv = new DataView(new ArrayBuffer());
const dataView = mem => dv.buffer === mem.buffer ? dv : dv = new DataView(mem.buffer);

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
let _fs;
async function fetchCompile (url) {
  if (isNode) {
    _fs = _fs || await import('fs/promises');
    return WebAssembly.compile(await _fs.readFile(url));
  }
  return fetch(url).then(WebAssembly.compileStreaming);
}

function getErrorPayload(e) {
  if (e && hasOwnProperty.call(e, 'payload')) return e.payload;
  return e;
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

const instantiateCore = WebAssembly.instantiate;

const resourceHandleSymbol = Symbol();

function throwInvalidBool() {
  throw new TypeError('invalid variant discriminant for bool');
}

const toUint64 = val => BigInt.asUintN(64, val);

function toUint32(val) {
  return val >>> 0;
}

const utf8Decoder = new TextDecoder();

const utf8Encoder = new TextEncoder();

let utf8EncodedLen = 0;
function utf8Encode(s, realloc, memory) {
  if (typeof s !== 'string') throw new TypeError('expected a string');
  if (s.length === 0) {
    utf8EncodedLen = 0;
    return 1;
  }
  let allocLen = 0;
  let ptr = 0;
  let writtenTotal = 0;
  while (s.length > 0) {
    ptr = realloc(ptr, allocLen, 1, allocLen + s.length);
    allocLen += s.length;
    const { read, written } = utf8Encoder.encodeInto(
    s,
    new Uint8Array(memory.buffer, ptr + writtenTotal, allocLen - writtenTotal),
    );
    writtenTotal += written;
    s = s.slice(read);
  }
  if (allocLen > writtenTotal)
  ptr = realloc(ptr, allocLen, 1, writtenTotal);
  utf8EncodedLen = writtenTotal;
  return ptr;
}

let exports0;
let exports1;

function trampoline8() {
  const ret = getStderr();
  if (!(ret instanceof OutputStream)) {
    throw new Error('Not a valid "OutputStream" resource.');
  }
  const handle0 = handleCnt2++;
  handleTable2.set(handle0, { rep: ret, own: true });
  return handle0;
}

function trampoline9(arg0) {
  let variant0;
  switch (arg0) {
    case 0: {
      variant0= {
        tag: 'ok',
        val: undefined
      };
      break;
    }
    case 1: {
      variant0= {
        tag: 'err',
        val: undefined
      };
      break;
    }
    default: {
      throw new TypeError('invalid variant discriminant for expected');
    }
  }
  exit(variant0);
}

function trampoline10() {
  const ret = getStdin();
  if (!(ret instanceof InputStream)) {
    throw new Error('Not a valid "InputStream" resource.');
  }
  const handle0 = handleCnt0++;
  handleTable0.set(handle0, { rep: ret, own: true });
  return handle0;
}

function trampoline11() {
  const ret = getStdout();
  if (!(ret instanceof OutputStream)) {
    throw new Error('Not a valid "OutputStream" resource.');
  }
  const handle0 = handleCnt2++;
  handleTable2.set(handle0, { rep: ret, own: true });
  return handle0;
}
let exports2;

function trampoline12(arg0) {
  const ret = getDirectories();
  const vec3 = ret;
  const len3 = vec3.length;
  const result3 = realloc0(0, 0, 4, len3 * 12);
  for (let i = 0; i < vec3.length; i++) {
    const e = vec3[i];
    const base = result3 + i * 12;const [tuple0_0, tuple0_1] = e;
    if (!(tuple0_0 instanceof Descriptor)) {
      throw new Error('Not a valid "Descriptor" resource.');
    }
    const handle1 = handleCnt3++;
    handleTable3.set(handle1, { rep: tuple0_0, own: true });
    dataView(memory0).setInt32(base + 0, handle1, true);
    const ptr2 = utf8Encode(tuple0_1, realloc0, memory0);
    const len2 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 8, len2, true);
    dataView(memory0).setInt32(base + 4, ptr2, true);
  }
  dataView(memory0).setInt32(arg0 + 4, len3, true);
  dataView(memory0).setInt32(arg0 + 0, result3, true);
}
let memory0;
let realloc0;

function trampoline13(arg0, arg1, arg2) {
  const rsc0 = handleTable3.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.readViaStream.call(rsc0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e instanceof InputStream)) {
        throw new Error('Not a valid "InputStream" resource.');
      }
      const handle1 = handleCnt0++;
      handleTable0.set(handle1, { rep: e, own: true });
      dataView(memory0).setInt32(arg2 + 4, handle1, true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      const val2 = e;
      let enum2;
      switch (val2) {
        case 'access': {
          enum2 = 0;
          break;
        }
        case 'would-block': {
          enum2 = 1;
          break;
        }
        case 'already': {
          enum2 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum2 = 3;
          break;
        }
        case 'busy': {
          enum2 = 4;
          break;
        }
        case 'deadlock': {
          enum2 = 5;
          break;
        }
        case 'quota': {
          enum2 = 6;
          break;
        }
        case 'exist': {
          enum2 = 7;
          break;
        }
        case 'file-too-large': {
          enum2 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum2 = 9;
          break;
        }
        case 'in-progress': {
          enum2 = 10;
          break;
        }
        case 'interrupted': {
          enum2 = 11;
          break;
        }
        case 'invalid': {
          enum2 = 12;
          break;
        }
        case 'io': {
          enum2 = 13;
          break;
        }
        case 'is-directory': {
          enum2 = 14;
          break;
        }
        case 'loop': {
          enum2 = 15;
          break;
        }
        case 'too-many-links': {
          enum2 = 16;
          break;
        }
        case 'message-size': {
          enum2 = 17;
          break;
        }
        case 'name-too-long': {
          enum2 = 18;
          break;
        }
        case 'no-device': {
          enum2 = 19;
          break;
        }
        case 'no-entry': {
          enum2 = 20;
          break;
        }
        case 'no-lock': {
          enum2 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum2 = 22;
          break;
        }
        case 'insufficient-space': {
          enum2 = 23;
          break;
        }
        case 'not-directory': {
          enum2 = 24;
          break;
        }
        case 'not-empty': {
          enum2 = 25;
          break;
        }
        case 'not-recoverable': {
          enum2 = 26;
          break;
        }
        case 'unsupported': {
          enum2 = 27;
          break;
        }
        case 'no-tty': {
          enum2 = 28;
          break;
        }
        case 'no-such-device': {
          enum2 = 29;
          break;
        }
        case 'overflow': {
          enum2 = 30;
          break;
        }
        case 'not-permitted': {
          enum2 = 31;
          break;
        }
        case 'pipe': {
          enum2 = 32;
          break;
        }
        case 'read-only': {
          enum2 = 33;
          break;
        }
        case 'invalid-seek': {
          enum2 = 34;
          break;
        }
        case 'text-file-busy': {
          enum2 = 35;
          break;
        }
        case 'cross-device': {
          enum2 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val2}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum2, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline14(arg0, arg1, arg2) {
  const rsc0 = handleTable3.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.writeViaStream.call(rsc0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e instanceof OutputStream)) {
        throw new Error('Not a valid "OutputStream" resource.');
      }
      const handle1 = handleCnt2++;
      handleTable2.set(handle1, { rep: e, own: true });
      dataView(memory0).setInt32(arg2 + 4, handle1, true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      const val2 = e;
      let enum2;
      switch (val2) {
        case 'access': {
          enum2 = 0;
          break;
        }
        case 'would-block': {
          enum2 = 1;
          break;
        }
        case 'already': {
          enum2 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum2 = 3;
          break;
        }
        case 'busy': {
          enum2 = 4;
          break;
        }
        case 'deadlock': {
          enum2 = 5;
          break;
        }
        case 'quota': {
          enum2 = 6;
          break;
        }
        case 'exist': {
          enum2 = 7;
          break;
        }
        case 'file-too-large': {
          enum2 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum2 = 9;
          break;
        }
        case 'in-progress': {
          enum2 = 10;
          break;
        }
        case 'interrupted': {
          enum2 = 11;
          break;
        }
        case 'invalid': {
          enum2 = 12;
          break;
        }
        case 'io': {
          enum2 = 13;
          break;
        }
        case 'is-directory': {
          enum2 = 14;
          break;
        }
        case 'loop': {
          enum2 = 15;
          break;
        }
        case 'too-many-links': {
          enum2 = 16;
          break;
        }
        case 'message-size': {
          enum2 = 17;
          break;
        }
        case 'name-too-long': {
          enum2 = 18;
          break;
        }
        case 'no-device': {
          enum2 = 19;
          break;
        }
        case 'no-entry': {
          enum2 = 20;
          break;
        }
        case 'no-lock': {
          enum2 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum2 = 22;
          break;
        }
        case 'insufficient-space': {
          enum2 = 23;
          break;
        }
        case 'not-directory': {
          enum2 = 24;
          break;
        }
        case 'not-empty': {
          enum2 = 25;
          break;
        }
        case 'not-recoverable': {
          enum2 = 26;
          break;
        }
        case 'unsupported': {
          enum2 = 27;
          break;
        }
        case 'no-tty': {
          enum2 = 28;
          break;
        }
        case 'no-such-device': {
          enum2 = 29;
          break;
        }
        case 'overflow': {
          enum2 = 30;
          break;
        }
        case 'not-permitted': {
          enum2 = 31;
          break;
        }
        case 'pipe': {
          enum2 = 32;
          break;
        }
        case 'read-only': {
          enum2 = 33;
          break;
        }
        case 'invalid-seek': {
          enum2 = 34;
          break;
        }
        case 'text-file-busy': {
          enum2 = 35;
          break;
        }
        case 'cross-device': {
          enum2 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val2}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum2, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline15(arg0, arg1) {
  const rsc0 = handleTable3.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.appendViaStream.call(rsc0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e instanceof OutputStream)) {
        throw new Error('Not a valid "OutputStream" resource.');
      }
      const handle1 = handleCnt2++;
      handleTable2.set(handle1, { rep: e, own: true });
      dataView(memory0).setInt32(arg1 + 4, handle1, true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const val2 = e;
      let enum2;
      switch (val2) {
        case 'access': {
          enum2 = 0;
          break;
        }
        case 'would-block': {
          enum2 = 1;
          break;
        }
        case 'already': {
          enum2 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum2 = 3;
          break;
        }
        case 'busy': {
          enum2 = 4;
          break;
        }
        case 'deadlock': {
          enum2 = 5;
          break;
        }
        case 'quota': {
          enum2 = 6;
          break;
        }
        case 'exist': {
          enum2 = 7;
          break;
        }
        case 'file-too-large': {
          enum2 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum2 = 9;
          break;
        }
        case 'in-progress': {
          enum2 = 10;
          break;
        }
        case 'interrupted': {
          enum2 = 11;
          break;
        }
        case 'invalid': {
          enum2 = 12;
          break;
        }
        case 'io': {
          enum2 = 13;
          break;
        }
        case 'is-directory': {
          enum2 = 14;
          break;
        }
        case 'loop': {
          enum2 = 15;
          break;
        }
        case 'too-many-links': {
          enum2 = 16;
          break;
        }
        case 'message-size': {
          enum2 = 17;
          break;
        }
        case 'name-too-long': {
          enum2 = 18;
          break;
        }
        case 'no-device': {
          enum2 = 19;
          break;
        }
        case 'no-entry': {
          enum2 = 20;
          break;
        }
        case 'no-lock': {
          enum2 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum2 = 22;
          break;
        }
        case 'insufficient-space': {
          enum2 = 23;
          break;
        }
        case 'not-directory': {
          enum2 = 24;
          break;
        }
        case 'not-empty': {
          enum2 = 25;
          break;
        }
        case 'not-recoverable': {
          enum2 = 26;
          break;
        }
        case 'unsupported': {
          enum2 = 27;
          break;
        }
        case 'no-tty': {
          enum2 = 28;
          break;
        }
        case 'no-such-device': {
          enum2 = 29;
          break;
        }
        case 'overflow': {
          enum2 = 30;
          break;
        }
        case 'not-permitted': {
          enum2 = 31;
          break;
        }
        case 'pipe': {
          enum2 = 32;
          break;
        }
        case 'read-only': {
          enum2 = 33;
          break;
        }
        case 'invalid-seek': {
          enum2 = 34;
          break;
        }
        case 'text-file-busy': {
          enum2 = 35;
          break;
        }
        case 'cross-device': {
          enum2 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val2}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum2, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline16(arg0, arg1) {
  const rsc0 = handleTable3.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.getType.call(rsc0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      const val1 = e;
      let enum1;
      switch (val1) {
        case 'unknown': {
          enum1 = 0;
          break;
        }
        case 'block-device': {
          enum1 = 1;
          break;
        }
        case 'character-device': {
          enum1 = 2;
          break;
        }
        case 'directory': {
          enum1 = 3;
          break;
        }
        case 'fifo': {
          enum1 = 4;
          break;
        }
        case 'symbolic-link': {
          enum1 = 5;
          break;
        }
        case 'regular-file': {
          enum1 = 6;
          break;
        }
        case 'socket': {
          enum1 = 7;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val1}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum1, true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const val2 = e;
      let enum2;
      switch (val2) {
        case 'access': {
          enum2 = 0;
          break;
        }
        case 'would-block': {
          enum2 = 1;
          break;
        }
        case 'already': {
          enum2 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum2 = 3;
          break;
        }
        case 'busy': {
          enum2 = 4;
          break;
        }
        case 'deadlock': {
          enum2 = 5;
          break;
        }
        case 'quota': {
          enum2 = 6;
          break;
        }
        case 'exist': {
          enum2 = 7;
          break;
        }
        case 'file-too-large': {
          enum2 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum2 = 9;
          break;
        }
        case 'in-progress': {
          enum2 = 10;
          break;
        }
        case 'interrupted': {
          enum2 = 11;
          break;
        }
        case 'invalid': {
          enum2 = 12;
          break;
        }
        case 'io': {
          enum2 = 13;
          break;
        }
        case 'is-directory': {
          enum2 = 14;
          break;
        }
        case 'loop': {
          enum2 = 15;
          break;
        }
        case 'too-many-links': {
          enum2 = 16;
          break;
        }
        case 'message-size': {
          enum2 = 17;
          break;
        }
        case 'name-too-long': {
          enum2 = 18;
          break;
        }
        case 'no-device': {
          enum2 = 19;
          break;
        }
        case 'no-entry': {
          enum2 = 20;
          break;
        }
        case 'no-lock': {
          enum2 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum2 = 22;
          break;
        }
        case 'insufficient-space': {
          enum2 = 23;
          break;
        }
        case 'not-directory': {
          enum2 = 24;
          break;
        }
        case 'not-empty': {
          enum2 = 25;
          break;
        }
        case 'not-recoverable': {
          enum2 = 26;
          break;
        }
        case 'unsupported': {
          enum2 = 27;
          break;
        }
        case 'no-tty': {
          enum2 = 28;
          break;
        }
        case 'no-such-device': {
          enum2 = 29;
          break;
        }
        case 'overflow': {
          enum2 = 30;
          break;
        }
        case 'not-permitted': {
          enum2 = 31;
          break;
        }
        case 'pipe': {
          enum2 = 32;
          break;
        }
        case 'read-only': {
          enum2 = 33;
          break;
        }
        case 'invalid-seek': {
          enum2 = 34;
          break;
        }
        case 'text-file-busy': {
          enum2 = 35;
          break;
        }
        case 'cross-device': {
          enum2 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val2}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum2, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline17(arg0, arg1) {
  const rsc0 = handleTable3.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.readDirectory.call(rsc0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e instanceof DirectoryEntryStream)) {
        throw new Error('Not a valid "DirectoryEntryStream" resource.');
      }
      const handle1 = handleCnt4++;
      handleTable4.set(handle1, { rep: e, own: true });
      dataView(memory0).setInt32(arg1 + 4, handle1, true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const val2 = e;
      let enum2;
      switch (val2) {
        case 'access': {
          enum2 = 0;
          break;
        }
        case 'would-block': {
          enum2 = 1;
          break;
        }
        case 'already': {
          enum2 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum2 = 3;
          break;
        }
        case 'busy': {
          enum2 = 4;
          break;
        }
        case 'deadlock': {
          enum2 = 5;
          break;
        }
        case 'quota': {
          enum2 = 6;
          break;
        }
        case 'exist': {
          enum2 = 7;
          break;
        }
        case 'file-too-large': {
          enum2 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum2 = 9;
          break;
        }
        case 'in-progress': {
          enum2 = 10;
          break;
        }
        case 'interrupted': {
          enum2 = 11;
          break;
        }
        case 'invalid': {
          enum2 = 12;
          break;
        }
        case 'io': {
          enum2 = 13;
          break;
        }
        case 'is-directory': {
          enum2 = 14;
          break;
        }
        case 'loop': {
          enum2 = 15;
          break;
        }
        case 'too-many-links': {
          enum2 = 16;
          break;
        }
        case 'message-size': {
          enum2 = 17;
          break;
        }
        case 'name-too-long': {
          enum2 = 18;
          break;
        }
        case 'no-device': {
          enum2 = 19;
          break;
        }
        case 'no-entry': {
          enum2 = 20;
          break;
        }
        case 'no-lock': {
          enum2 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum2 = 22;
          break;
        }
        case 'insufficient-space': {
          enum2 = 23;
          break;
        }
        case 'not-directory': {
          enum2 = 24;
          break;
        }
        case 'not-empty': {
          enum2 = 25;
          break;
        }
        case 'not-recoverable': {
          enum2 = 26;
          break;
        }
        case 'unsupported': {
          enum2 = 27;
          break;
        }
        case 'no-tty': {
          enum2 = 28;
          break;
        }
        case 'no-such-device': {
          enum2 = 29;
          break;
        }
        case 'overflow': {
          enum2 = 30;
          break;
        }
        case 'not-permitted': {
          enum2 = 31;
          break;
        }
        case 'pipe': {
          enum2 = 32;
          break;
        }
        case 'read-only': {
          enum2 = 33;
          break;
        }
        case 'invalid-seek': {
          enum2 = 34;
          break;
        }
        case 'text-file-busy': {
          enum2 = 35;
          break;
        }
        case 'cross-device': {
          enum2 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val2}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum2, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline18(arg0, arg1) {
  const rsc0 = handleTable3.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.stat.call(rsc0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant10 = ret;
  switch (variant10.tag) {
    case 'ok': {
      const e = variant10.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      const {type: v1_0, linkCount: v1_1, size: v1_2, dataAccessTimestamp: v1_3, dataModificationTimestamp: v1_4, statusChangeTimestamp: v1_5 } = e;
      const val2 = v1_0;
      let enum2;
      switch (val2) {
        case 'unknown': {
          enum2 = 0;
          break;
        }
        case 'block-device': {
          enum2 = 1;
          break;
        }
        case 'character-device': {
          enum2 = 2;
          break;
        }
        case 'directory': {
          enum2 = 3;
          break;
        }
        case 'fifo': {
          enum2 = 4;
          break;
        }
        case 'symbolic-link': {
          enum2 = 5;
          break;
        }
        case 'regular-file': {
          enum2 = 6;
          break;
        }
        case 'socket': {
          enum2 = 7;
          break;
        }
        default: {
          if ((v1_0) instanceof Error) {
            console.error(v1_0);
          }
          
          throw new TypeError(`"${val2}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum2, true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v1_1), true);
      dataView(memory0).setBigInt64(arg1 + 24, toUint64(v1_2), true);
      const variant4 = v1_3;
      if (variant4 === null || variant4=== undefined) {
        dataView(memory0).setInt8(arg1 + 32, 0, true);
      } else {
        const e = variant4;
        dataView(memory0).setInt8(arg1 + 32, 1, true);
        const {seconds: v3_0, nanoseconds: v3_1 } = e;
        dataView(memory0).setBigInt64(arg1 + 40, toUint64(v3_0), true);
        dataView(memory0).setInt32(arg1 + 48, toUint32(v3_1), true);
      }
      const variant6 = v1_4;
      if (variant6 === null || variant6=== undefined) {
        dataView(memory0).setInt8(arg1 + 56, 0, true);
      } else {
        const e = variant6;
        dataView(memory0).setInt8(arg1 + 56, 1, true);
        const {seconds: v5_0, nanoseconds: v5_1 } = e;
        dataView(memory0).setBigInt64(arg1 + 64, toUint64(v5_0), true);
        dataView(memory0).setInt32(arg1 + 72, toUint32(v5_1), true);
      }
      const variant8 = v1_5;
      if (variant8 === null || variant8=== undefined) {
        dataView(memory0).setInt8(arg1 + 80, 0, true);
      } else {
        const e = variant8;
        dataView(memory0).setInt8(arg1 + 80, 1, true);
        const {seconds: v7_0, nanoseconds: v7_1 } = e;
        dataView(memory0).setBigInt64(arg1 + 88, toUint64(v7_0), true);
        dataView(memory0).setInt32(arg1 + 96, toUint32(v7_1), true);
      }
      break;
    }
    case 'err': {
      const e = variant10.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const val9 = e;
      let enum9;
      switch (val9) {
        case 'access': {
          enum9 = 0;
          break;
        }
        case 'would-block': {
          enum9 = 1;
          break;
        }
        case 'already': {
          enum9 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum9 = 3;
          break;
        }
        case 'busy': {
          enum9 = 4;
          break;
        }
        case 'deadlock': {
          enum9 = 5;
          break;
        }
        case 'quota': {
          enum9 = 6;
          break;
        }
        case 'exist': {
          enum9 = 7;
          break;
        }
        case 'file-too-large': {
          enum9 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum9 = 9;
          break;
        }
        case 'in-progress': {
          enum9 = 10;
          break;
        }
        case 'interrupted': {
          enum9 = 11;
          break;
        }
        case 'invalid': {
          enum9 = 12;
          break;
        }
        case 'io': {
          enum9 = 13;
          break;
        }
        case 'is-directory': {
          enum9 = 14;
          break;
        }
        case 'loop': {
          enum9 = 15;
          break;
        }
        case 'too-many-links': {
          enum9 = 16;
          break;
        }
        case 'message-size': {
          enum9 = 17;
          break;
        }
        case 'name-too-long': {
          enum9 = 18;
          break;
        }
        case 'no-device': {
          enum9 = 19;
          break;
        }
        case 'no-entry': {
          enum9 = 20;
          break;
        }
        case 'no-lock': {
          enum9 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum9 = 22;
          break;
        }
        case 'insufficient-space': {
          enum9 = 23;
          break;
        }
        case 'not-directory': {
          enum9 = 24;
          break;
        }
        case 'not-empty': {
          enum9 = 25;
          break;
        }
        case 'not-recoverable': {
          enum9 = 26;
          break;
        }
        case 'unsupported': {
          enum9 = 27;
          break;
        }
        case 'no-tty': {
          enum9 = 28;
          break;
        }
        case 'no-such-device': {
          enum9 = 29;
          break;
        }
        case 'overflow': {
          enum9 = 30;
          break;
        }
        case 'not-permitted': {
          enum9 = 31;
          break;
        }
        case 'pipe': {
          enum9 = 32;
          break;
        }
        case 'read-only': {
          enum9 = 33;
          break;
        }
        case 'invalid-seek': {
          enum9 = 34;
          break;
        }
        case 'text-file-busy': {
          enum9 = 35;
          break;
        }
        case 'cross-device': {
          enum9 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val9}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum9, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline19(arg0, arg1, arg2, arg3, arg4) {
  const rsc0 = handleTable3.get(arg0).rep;
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags1 = {
    symlinkFollow: Boolean(arg1 & 1),
  };
  const ptr2 = arg2;
  const len2 = arg3;
  const result2 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr2, len2));
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.statAt.call(rsc0, flags1, result2) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant12 = ret;
  switch (variant12.tag) {
    case 'ok': {
      const e = variant12.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      const {type: v3_0, linkCount: v3_1, size: v3_2, dataAccessTimestamp: v3_3, dataModificationTimestamp: v3_4, statusChangeTimestamp: v3_5 } = e;
      const val4 = v3_0;
      let enum4;
      switch (val4) {
        case 'unknown': {
          enum4 = 0;
          break;
        }
        case 'block-device': {
          enum4 = 1;
          break;
        }
        case 'character-device': {
          enum4 = 2;
          break;
        }
        case 'directory': {
          enum4 = 3;
          break;
        }
        case 'fifo': {
          enum4 = 4;
          break;
        }
        case 'symbolic-link': {
          enum4 = 5;
          break;
        }
        case 'regular-file': {
          enum4 = 6;
          break;
        }
        case 'socket': {
          enum4 = 7;
          break;
        }
        default: {
          if ((v3_0) instanceof Error) {
            console.error(v3_0);
          }
          
          throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum4, true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v3_1), true);
      dataView(memory0).setBigInt64(arg4 + 24, toUint64(v3_2), true);
      const variant6 = v3_3;
      if (variant6 === null || variant6=== undefined) {
        dataView(memory0).setInt8(arg4 + 32, 0, true);
      } else {
        const e = variant6;
        dataView(memory0).setInt8(arg4 + 32, 1, true);
        const {seconds: v5_0, nanoseconds: v5_1 } = e;
        dataView(memory0).setBigInt64(arg4 + 40, toUint64(v5_0), true);
        dataView(memory0).setInt32(arg4 + 48, toUint32(v5_1), true);
      }
      const variant8 = v3_4;
      if (variant8 === null || variant8=== undefined) {
        dataView(memory0).setInt8(arg4 + 56, 0, true);
      } else {
        const e = variant8;
        dataView(memory0).setInt8(arg4 + 56, 1, true);
        const {seconds: v7_0, nanoseconds: v7_1 } = e;
        dataView(memory0).setBigInt64(arg4 + 64, toUint64(v7_0), true);
        dataView(memory0).setInt32(arg4 + 72, toUint32(v7_1), true);
      }
      const variant10 = v3_5;
      if (variant10 === null || variant10=== undefined) {
        dataView(memory0).setInt8(arg4 + 80, 0, true);
      } else {
        const e = variant10;
        dataView(memory0).setInt8(arg4 + 80, 1, true);
        const {seconds: v9_0, nanoseconds: v9_1 } = e;
        dataView(memory0).setBigInt64(arg4 + 88, toUint64(v9_0), true);
        dataView(memory0).setInt32(arg4 + 96, toUint32(v9_1), true);
      }
      break;
    }
    case 'err': {
      const e = variant12.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
      const val11 = e;
      let enum11;
      switch (val11) {
        case 'access': {
          enum11 = 0;
          break;
        }
        case 'would-block': {
          enum11 = 1;
          break;
        }
        case 'already': {
          enum11 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum11 = 3;
          break;
        }
        case 'busy': {
          enum11 = 4;
          break;
        }
        case 'deadlock': {
          enum11 = 5;
          break;
        }
        case 'quota': {
          enum11 = 6;
          break;
        }
        case 'exist': {
          enum11 = 7;
          break;
        }
        case 'file-too-large': {
          enum11 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum11 = 9;
          break;
        }
        case 'in-progress': {
          enum11 = 10;
          break;
        }
        case 'interrupted': {
          enum11 = 11;
          break;
        }
        case 'invalid': {
          enum11 = 12;
          break;
        }
        case 'io': {
          enum11 = 13;
          break;
        }
        case 'is-directory': {
          enum11 = 14;
          break;
        }
        case 'loop': {
          enum11 = 15;
          break;
        }
        case 'too-many-links': {
          enum11 = 16;
          break;
        }
        case 'message-size': {
          enum11 = 17;
          break;
        }
        case 'name-too-long': {
          enum11 = 18;
          break;
        }
        case 'no-device': {
          enum11 = 19;
          break;
        }
        case 'no-entry': {
          enum11 = 20;
          break;
        }
        case 'no-lock': {
          enum11 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum11 = 22;
          break;
        }
        case 'insufficient-space': {
          enum11 = 23;
          break;
        }
        case 'not-directory': {
          enum11 = 24;
          break;
        }
        case 'not-empty': {
          enum11 = 25;
          break;
        }
        case 'not-recoverable': {
          enum11 = 26;
          break;
        }
        case 'unsupported': {
          enum11 = 27;
          break;
        }
        case 'no-tty': {
          enum11 = 28;
          break;
        }
        case 'no-such-device': {
          enum11 = 29;
          break;
        }
        case 'overflow': {
          enum11 = 30;
          break;
        }
        case 'not-permitted': {
          enum11 = 31;
          break;
        }
        case 'pipe': {
          enum11 = 32;
          break;
        }
        case 'read-only': {
          enum11 = 33;
          break;
        }
        case 'invalid-seek': {
          enum11 = 34;
          break;
        }
        case 'text-file-busy': {
          enum11 = 35;
          break;
        }
        case 'cross-device': {
          enum11 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val11}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum11, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline20(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
  const rsc0 = handleTable3.get(arg0).rep;
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags1 = {
    symlinkFollow: Boolean(arg1 & 1),
  };
  const ptr2 = arg2;
  const len2 = arg3;
  const result2 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr2, len2));
  if ((arg4 & 4294967280) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags3 = {
    create: Boolean(arg4 & 1),
    directory: Boolean(arg4 & 2),
    exclusive: Boolean(arg4 & 4),
    truncate: Boolean(arg4 & 8),
  };
  if ((arg5 & 4294967232) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags4 = {
    read: Boolean(arg5 & 1),
    write: Boolean(arg5 & 2),
    fileIntegritySync: Boolean(arg5 & 4),
    dataIntegritySync: Boolean(arg5 & 8),
    requestedWriteSync: Boolean(arg5 & 16),
    mutateDirectory: Boolean(arg5 & 32),
  };
  if ((arg6 & 4294967288) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags5 = {
    readable: Boolean(arg6 & 1),
    writable: Boolean(arg6 & 2),
    executable: Boolean(arg6 & 4),
  };
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.openAt.call(rsc0, flags1, result2, flags3, flags4, flags5) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant8 = ret;
  switch (variant8.tag) {
    case 'ok': {
      const e = variant8.val;
      dataView(memory0).setInt8(arg7 + 0, 0, true);
      if (!(e instanceof Descriptor)) {
        throw new Error('Not a valid "Descriptor" resource.');
      }
      const handle6 = handleCnt3++;
      handleTable3.set(handle6, { rep: e, own: true });
      dataView(memory0).setInt32(arg7 + 4, handle6, true);
      break;
    }
    case 'err': {
      const e = variant8.val;
      dataView(memory0).setInt8(arg7 + 0, 1, true);
      const val7 = e;
      let enum7;
      switch (val7) {
        case 'access': {
          enum7 = 0;
          break;
        }
        case 'would-block': {
          enum7 = 1;
          break;
        }
        case 'already': {
          enum7 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum7 = 3;
          break;
        }
        case 'busy': {
          enum7 = 4;
          break;
        }
        case 'deadlock': {
          enum7 = 5;
          break;
        }
        case 'quota': {
          enum7 = 6;
          break;
        }
        case 'exist': {
          enum7 = 7;
          break;
        }
        case 'file-too-large': {
          enum7 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum7 = 9;
          break;
        }
        case 'in-progress': {
          enum7 = 10;
          break;
        }
        case 'interrupted': {
          enum7 = 11;
          break;
        }
        case 'invalid': {
          enum7 = 12;
          break;
        }
        case 'io': {
          enum7 = 13;
          break;
        }
        case 'is-directory': {
          enum7 = 14;
          break;
        }
        case 'loop': {
          enum7 = 15;
          break;
        }
        case 'too-many-links': {
          enum7 = 16;
          break;
        }
        case 'message-size': {
          enum7 = 17;
          break;
        }
        case 'name-too-long': {
          enum7 = 18;
          break;
        }
        case 'no-device': {
          enum7 = 19;
          break;
        }
        case 'no-entry': {
          enum7 = 20;
          break;
        }
        case 'no-lock': {
          enum7 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum7 = 22;
          break;
        }
        case 'insufficient-space': {
          enum7 = 23;
          break;
        }
        case 'not-directory': {
          enum7 = 24;
          break;
        }
        case 'not-empty': {
          enum7 = 25;
          break;
        }
        case 'not-recoverable': {
          enum7 = 26;
          break;
        }
        case 'unsupported': {
          enum7 = 27;
          break;
        }
        case 'no-tty': {
          enum7 = 28;
          break;
        }
        case 'no-such-device': {
          enum7 = 29;
          break;
        }
        case 'overflow': {
          enum7 = 30;
          break;
        }
        case 'not-permitted': {
          enum7 = 31;
          break;
        }
        case 'pipe': {
          enum7 = 32;
          break;
        }
        case 'read-only': {
          enum7 = 33;
          break;
        }
        case 'invalid-seek': {
          enum7 = 34;
          break;
        }
        case 'text-file-busy': {
          enum7 = 35;
          break;
        }
        case 'cross-device': {
          enum7 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val7}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg7 + 4, enum7, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline21(arg0, arg1) {
  const rsc0 = handleTable3.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.metadataHash.call(rsc0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      const {lower: v1_0, upper: v1_1 } = e;
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(v1_0), true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v1_1), true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const val2 = e;
      let enum2;
      switch (val2) {
        case 'access': {
          enum2 = 0;
          break;
        }
        case 'would-block': {
          enum2 = 1;
          break;
        }
        case 'already': {
          enum2 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum2 = 3;
          break;
        }
        case 'busy': {
          enum2 = 4;
          break;
        }
        case 'deadlock': {
          enum2 = 5;
          break;
        }
        case 'quota': {
          enum2 = 6;
          break;
        }
        case 'exist': {
          enum2 = 7;
          break;
        }
        case 'file-too-large': {
          enum2 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum2 = 9;
          break;
        }
        case 'in-progress': {
          enum2 = 10;
          break;
        }
        case 'interrupted': {
          enum2 = 11;
          break;
        }
        case 'invalid': {
          enum2 = 12;
          break;
        }
        case 'io': {
          enum2 = 13;
          break;
        }
        case 'is-directory': {
          enum2 = 14;
          break;
        }
        case 'loop': {
          enum2 = 15;
          break;
        }
        case 'too-many-links': {
          enum2 = 16;
          break;
        }
        case 'message-size': {
          enum2 = 17;
          break;
        }
        case 'name-too-long': {
          enum2 = 18;
          break;
        }
        case 'no-device': {
          enum2 = 19;
          break;
        }
        case 'no-entry': {
          enum2 = 20;
          break;
        }
        case 'no-lock': {
          enum2 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum2 = 22;
          break;
        }
        case 'insufficient-space': {
          enum2 = 23;
          break;
        }
        case 'not-directory': {
          enum2 = 24;
          break;
        }
        case 'not-empty': {
          enum2 = 25;
          break;
        }
        case 'not-recoverable': {
          enum2 = 26;
          break;
        }
        case 'unsupported': {
          enum2 = 27;
          break;
        }
        case 'no-tty': {
          enum2 = 28;
          break;
        }
        case 'no-such-device': {
          enum2 = 29;
          break;
        }
        case 'overflow': {
          enum2 = 30;
          break;
        }
        case 'not-permitted': {
          enum2 = 31;
          break;
        }
        case 'pipe': {
          enum2 = 32;
          break;
        }
        case 'read-only': {
          enum2 = 33;
          break;
        }
        case 'invalid-seek': {
          enum2 = 34;
          break;
        }
        case 'text-file-busy': {
          enum2 = 35;
          break;
        }
        case 'cross-device': {
          enum2 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val2}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum2, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline22(arg0, arg1, arg2, arg3, arg4) {
  const rsc0 = handleTable3.get(arg0).rep;
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags1 = {
    symlinkFollow: Boolean(arg1 & 1),
  };
  const ptr2 = arg2;
  const len2 = arg3;
  const result2 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr2, len2));
  let ret;
  try {
    ret = { tag: 'ok', val: Descriptor.prototype.metadataHashAt.call(rsc0, flags1, result2) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant5 = ret;
  switch (variant5.tag) {
    case 'ok': {
      const e = variant5.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      const {lower: v3_0, upper: v3_1 } = e;
      dataView(memory0).setBigInt64(arg4 + 8, toUint64(v3_0), true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v3_1), true);
      break;
    }
    case 'err': {
      const e = variant5.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
      const val4 = e;
      let enum4;
      switch (val4) {
        case 'access': {
          enum4 = 0;
          break;
        }
        case 'would-block': {
          enum4 = 1;
          break;
        }
        case 'already': {
          enum4 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum4 = 3;
          break;
        }
        case 'busy': {
          enum4 = 4;
          break;
        }
        case 'deadlock': {
          enum4 = 5;
          break;
        }
        case 'quota': {
          enum4 = 6;
          break;
        }
        case 'exist': {
          enum4 = 7;
          break;
        }
        case 'file-too-large': {
          enum4 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum4 = 9;
          break;
        }
        case 'in-progress': {
          enum4 = 10;
          break;
        }
        case 'interrupted': {
          enum4 = 11;
          break;
        }
        case 'invalid': {
          enum4 = 12;
          break;
        }
        case 'io': {
          enum4 = 13;
          break;
        }
        case 'is-directory': {
          enum4 = 14;
          break;
        }
        case 'loop': {
          enum4 = 15;
          break;
        }
        case 'too-many-links': {
          enum4 = 16;
          break;
        }
        case 'message-size': {
          enum4 = 17;
          break;
        }
        case 'name-too-long': {
          enum4 = 18;
          break;
        }
        case 'no-device': {
          enum4 = 19;
          break;
        }
        case 'no-entry': {
          enum4 = 20;
          break;
        }
        case 'no-lock': {
          enum4 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum4 = 22;
          break;
        }
        case 'insufficient-space': {
          enum4 = 23;
          break;
        }
        case 'not-directory': {
          enum4 = 24;
          break;
        }
        case 'not-empty': {
          enum4 = 25;
          break;
        }
        case 'not-recoverable': {
          enum4 = 26;
          break;
        }
        case 'unsupported': {
          enum4 = 27;
          break;
        }
        case 'no-tty': {
          enum4 = 28;
          break;
        }
        case 'no-such-device': {
          enum4 = 29;
          break;
        }
        case 'overflow': {
          enum4 = 30;
          break;
        }
        case 'not-permitted': {
          enum4 = 31;
          break;
        }
        case 'pipe': {
          enum4 = 32;
          break;
        }
        case 'read-only': {
          enum4 = 33;
          break;
        }
        case 'invalid-seek': {
          enum4 = 34;
          break;
        }
        case 'text-file-busy': {
          enum4 = 35;
          break;
        }
        case 'cross-device': {
          enum4 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum4, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline23(arg0, arg1) {
  const rsc0 = handleTable4.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: DirectoryEntryStream.prototype.readDirectoryEntry.call(rsc0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant6 = ret;
  switch (variant6.tag) {
    case 'ok': {
      const e = variant6.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      const variant4 = e;
      if (variant4 === null || variant4=== undefined) {
        dataView(memory0).setInt8(arg1 + 4, 0, true);
      } else {
        const e = variant4;
        dataView(memory0).setInt8(arg1 + 4, 1, true);
        const {type: v1_0, name: v1_1 } = e;
        const val2 = v1_0;
        let enum2;
        switch (val2) {
          case 'unknown': {
            enum2 = 0;
            break;
          }
          case 'block-device': {
            enum2 = 1;
            break;
          }
          case 'character-device': {
            enum2 = 2;
            break;
          }
          case 'directory': {
            enum2 = 3;
            break;
          }
          case 'fifo': {
            enum2 = 4;
            break;
          }
          case 'symbolic-link': {
            enum2 = 5;
            break;
          }
          case 'regular-file': {
            enum2 = 6;
            break;
          }
          case 'socket': {
            enum2 = 7;
            break;
          }
          default: {
            if ((v1_0) instanceof Error) {
              console.error(v1_0);
            }
            
            throw new TypeError(`"${val2}" is not one of the cases of descriptor-type`);
          }
        }
        dataView(memory0).setInt8(arg1 + 8, enum2, true);
        const ptr3 = utf8Encode(v1_1, realloc0, memory0);
        const len3 = utf8EncodedLen;
        dataView(memory0).setInt32(arg1 + 16, len3, true);
        dataView(memory0).setInt32(arg1 + 12, ptr3, true);
      }
      break;
    }
    case 'err': {
      const e = variant6.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const val5 = e;
      let enum5;
      switch (val5) {
        case 'access': {
          enum5 = 0;
          break;
        }
        case 'would-block': {
          enum5 = 1;
          break;
        }
        case 'already': {
          enum5 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum5 = 3;
          break;
        }
        case 'busy': {
          enum5 = 4;
          break;
        }
        case 'deadlock': {
          enum5 = 5;
          break;
        }
        case 'quota': {
          enum5 = 6;
          break;
        }
        case 'exist': {
          enum5 = 7;
          break;
        }
        case 'file-too-large': {
          enum5 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum5 = 9;
          break;
        }
        case 'in-progress': {
          enum5 = 10;
          break;
        }
        case 'interrupted': {
          enum5 = 11;
          break;
        }
        case 'invalid': {
          enum5 = 12;
          break;
        }
        case 'io': {
          enum5 = 13;
          break;
        }
        case 'is-directory': {
          enum5 = 14;
          break;
        }
        case 'loop': {
          enum5 = 15;
          break;
        }
        case 'too-many-links': {
          enum5 = 16;
          break;
        }
        case 'message-size': {
          enum5 = 17;
          break;
        }
        case 'name-too-long': {
          enum5 = 18;
          break;
        }
        case 'no-device': {
          enum5 = 19;
          break;
        }
        case 'no-entry': {
          enum5 = 20;
          break;
        }
        case 'no-lock': {
          enum5 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum5 = 22;
          break;
        }
        case 'insufficient-space': {
          enum5 = 23;
          break;
        }
        case 'not-directory': {
          enum5 = 24;
          break;
        }
        case 'not-empty': {
          enum5 = 25;
          break;
        }
        case 'not-recoverable': {
          enum5 = 26;
          break;
        }
        case 'unsupported': {
          enum5 = 27;
          break;
        }
        case 'no-tty': {
          enum5 = 28;
          break;
        }
        case 'no-such-device': {
          enum5 = 29;
          break;
        }
        case 'overflow': {
          enum5 = 30;
          break;
        }
        case 'not-permitted': {
          enum5 = 31;
          break;
        }
        case 'pipe': {
          enum5 = 32;
          break;
        }
        case 'read-only': {
          enum5 = 33;
          break;
        }
        case 'invalid-seek': {
          enum5 = 34;
          break;
        }
        case 'text-file-busy': {
          enum5 = 35;
          break;
        }
        case 'cross-device': {
          enum5 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val5}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum5, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline24(arg0, arg1) {
  const rsc0 = handleTable1.get(arg0).rep;
  const ret = filesystemErrorCode(rsc0);
  const variant2 = ret;
  if (variant2 === null || variant2=== undefined) {
    dataView(memory0).setInt8(arg1 + 0, 0, true);
  } else {
    const e = variant2;
    dataView(memory0).setInt8(arg1 + 0, 1, true);
    const val1 = e;
    let enum1;
    switch (val1) {
      case 'access': {
        enum1 = 0;
        break;
      }
      case 'would-block': {
        enum1 = 1;
        break;
      }
      case 'already': {
        enum1 = 2;
        break;
      }
      case 'bad-descriptor': {
        enum1 = 3;
        break;
      }
      case 'busy': {
        enum1 = 4;
        break;
      }
      case 'deadlock': {
        enum1 = 5;
        break;
      }
      case 'quota': {
        enum1 = 6;
        break;
      }
      case 'exist': {
        enum1 = 7;
        break;
      }
      case 'file-too-large': {
        enum1 = 8;
        break;
      }
      case 'illegal-byte-sequence': {
        enum1 = 9;
        break;
      }
      case 'in-progress': {
        enum1 = 10;
        break;
      }
      case 'interrupted': {
        enum1 = 11;
        break;
      }
      case 'invalid': {
        enum1 = 12;
        break;
      }
      case 'io': {
        enum1 = 13;
        break;
      }
      case 'is-directory': {
        enum1 = 14;
        break;
      }
      case 'loop': {
        enum1 = 15;
        break;
      }
      case 'too-many-links': {
        enum1 = 16;
        break;
      }
      case 'message-size': {
        enum1 = 17;
        break;
      }
      case 'name-too-long': {
        enum1 = 18;
        break;
      }
      case 'no-device': {
        enum1 = 19;
        break;
      }
      case 'no-entry': {
        enum1 = 20;
        break;
      }
      case 'no-lock': {
        enum1 = 21;
        break;
      }
      case 'insufficient-memory': {
        enum1 = 22;
        break;
      }
      case 'insufficient-space': {
        enum1 = 23;
        break;
      }
      case 'not-directory': {
        enum1 = 24;
        break;
      }
      case 'not-empty': {
        enum1 = 25;
        break;
      }
      case 'not-recoverable': {
        enum1 = 26;
        break;
      }
      case 'unsupported': {
        enum1 = 27;
        break;
      }
      case 'no-tty': {
        enum1 = 28;
        break;
      }
      case 'no-such-device': {
        enum1 = 29;
        break;
      }
      case 'overflow': {
        enum1 = 30;
        break;
      }
      case 'not-permitted': {
        enum1 = 31;
        break;
      }
      case 'pipe': {
        enum1 = 32;
        break;
      }
      case 'read-only': {
        enum1 = 33;
        break;
      }
      case 'invalid-seek': {
        enum1 = 34;
        break;
      }
      case 'text-file-busy': {
        enum1 = 35;
        break;
      }
      case 'cross-device': {
        enum1 = 36;
        break;
      }
      default: {
        if ((e) instanceof Error) {
          console.error(e);
        }
        
        throw new TypeError(`"${val1}" is not one of the cases of error-code`);
      }
    }
    dataView(memory0).setInt8(arg1 + 1, enum1, true);
  }
}

function trampoline25(arg0, arg1, arg2) {
  const rsc0 = handleTable0.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: InputStream.prototype.read.call(rsc0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant4 = ret;
  switch (variant4.tag) {
    case 'ok': {
      const e = variant4.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      const val1 = e;
      const len1 = val1.byteLength;
      const ptr1 = realloc0(0, 0, 1, len1 * 1);
      const src1 = new Uint8Array(val1.buffer || val1, val1.byteOffset, len1 * 1);
      (new Uint8Array(memory0.buffer, ptr1, len1 * 1)).set(src1);
      dataView(memory0).setInt32(arg2 + 8, len1, true);
      dataView(memory0).setInt32(arg2 + 4, ptr1, true);
      break;
    }
    case 'err': {
      const e = variant4.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      const variant3 = e;
      switch (variant3.tag) {
        case 'last-operation-failed': {
          const e = variant3.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e instanceof Error$1)) {
            throw new Error('Not a valid "Error" resource.');
          }
          const handle2 = handleCnt1++;
          handleTable1.set(handle2, { rep: e, own: true });
          dataView(memory0).setInt32(arg2 + 8, handle2, true);
          break;
        }
        case 'closed': {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError('invalid variant specified for StreamError');
        }
      }
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline26(arg0, arg1, arg2) {
  const rsc0 = handleTable0.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: InputStream.prototype.blockingRead.call(rsc0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant4 = ret;
  switch (variant4.tag) {
    case 'ok': {
      const e = variant4.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      const val1 = e;
      const len1 = val1.byteLength;
      const ptr1 = realloc0(0, 0, 1, len1 * 1);
      const src1 = new Uint8Array(val1.buffer || val1, val1.byteOffset, len1 * 1);
      (new Uint8Array(memory0.buffer, ptr1, len1 * 1)).set(src1);
      dataView(memory0).setInt32(arg2 + 8, len1, true);
      dataView(memory0).setInt32(arg2 + 4, ptr1, true);
      break;
    }
    case 'err': {
      const e = variant4.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      const variant3 = e;
      switch (variant3.tag) {
        case 'last-operation-failed': {
          const e = variant3.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e instanceof Error$1)) {
            throw new Error('Not a valid "Error" resource.');
          }
          const handle2 = handleCnt1++;
          handleTable1.set(handle2, { rep: e, own: true });
          dataView(memory0).setInt32(arg2 + 8, handle2, true);
          break;
        }
        case 'closed': {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError('invalid variant specified for StreamError');
        }
      }
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline27(arg0, arg1) {
  const rsc0 = handleTable2.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: OutputStream.prototype.checkWrite.call(rsc0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(e), true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const variant2 = e;
      switch (variant2.tag) {
        case 'last-operation-failed': {
          const e = variant2.val;
          dataView(memory0).setInt8(arg1 + 8, 0, true);
          if (!(e instanceof Error$1)) {
            throw new Error('Not a valid "Error" resource.');
          }
          const handle1 = handleCnt1++;
          handleTable1.set(handle1, { rep: e, own: true });
          dataView(memory0).setInt32(arg1 + 12, handle1, true);
          break;
        }
        case 'closed': {
          dataView(memory0).setInt8(arg1 + 8, 1, true);
          break;
        }
        default: {
          throw new TypeError('invalid variant specified for StreamError');
        }
      }
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline28(arg0, arg1, arg2, arg3) {
  const rsc0 = handleTable2.get(arg0).rep;
  const ptr1 = arg1;
  const len1 = arg2;
  const result1 = new Uint8Array(memory0.buffer.slice(ptr1, ptr1 + len1 * 1));
  let ret;
  try {
    ret = { tag: 'ok', val: OutputStream.prototype.write.call(rsc0, result1) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant4 = ret;
  switch (variant4.tag) {
    case 'ok': {
      const e = variant4.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case 'err': {
      const e = variant4.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      const variant3 = e;
      switch (variant3.tag) {
        case 'last-operation-failed': {
          const e = variant3.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e instanceof Error$1)) {
            throw new Error('Not a valid "Error" resource.');
          }
          const handle2 = handleCnt1++;
          handleTable1.set(handle2, { rep: e, own: true });
          dataView(memory0).setInt32(arg3 + 8, handle2, true);
          break;
        }
        case 'closed': {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError('invalid variant specified for StreamError');
        }
      }
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline29(arg0, arg1, arg2, arg3) {
  const rsc0 = handleTable2.get(arg0).rep;
  const ptr1 = arg1;
  const len1 = arg2;
  const result1 = new Uint8Array(memory0.buffer.slice(ptr1, ptr1 + len1 * 1));
  let ret;
  try {
    ret = { tag: 'ok', val: OutputStream.prototype.blockingWriteAndFlush.call(rsc0, result1) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant4 = ret;
  switch (variant4.tag) {
    case 'ok': {
      const e = variant4.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case 'err': {
      const e = variant4.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      const variant3 = e;
      switch (variant3.tag) {
        case 'last-operation-failed': {
          const e = variant3.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e instanceof Error$1)) {
            throw new Error('Not a valid "Error" resource.');
          }
          const handle2 = handleCnt1++;
          handleTable1.set(handle2, { rep: e, own: true });
          dataView(memory0).setInt32(arg3 + 8, handle2, true);
          break;
        }
        case 'closed': {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError('invalid variant specified for StreamError');
        }
      }
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline30(arg0, arg1) {
  const rsc0 = handleTable2.get(arg0).rep;
  let ret;
  try {
    ret = { tag: 'ok', val: OutputStream.prototype.blockingFlush.call(rsc0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const variant2 = e;
      switch (variant2.tag) {
        case 'last-operation-failed': {
          const e = variant2.val;
          dataView(memory0).setInt8(arg1 + 4, 0, true);
          if (!(e instanceof Error$1)) {
            throw new Error('Not a valid "Error" resource.');
          }
          const handle1 = handleCnt1++;
          handleTable1.set(handle1, { rep: e, own: true });
          dataView(memory0).setInt32(arg1 + 8, handle1, true);
          break;
        }
        case 'closed': {
          dataView(memory0).setInt8(arg1 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError('invalid variant specified for StreamError');
        }
      }
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function trampoline31(arg0, arg1) {
  const ret = getRandomBytes(BigInt.asUintN(64, arg0));
  const val0 = ret;
  const len0 = val0.byteLength;
  const ptr0 = realloc0(0, 0, 1, len0 * 1);
  const src0 = new Uint8Array(val0.buffer || val0, val0.byteOffset, len0 * 1);
  (new Uint8Array(memory0.buffer, ptr0, len0 * 1)).set(src0);
  dataView(memory0).setInt32(arg1 + 4, len0, true);
  dataView(memory0).setInt32(arg1 + 0, ptr0, true);
}

function trampoline32(arg0) {
  const ret = getEnvironment();
  const vec3 = ret;
  const len3 = vec3.length;
  const result3 = realloc0(0, 0, 4, len3 * 16);
  for (let i = 0; i < vec3.length; i++) {
    const e = vec3[i];
    const base = result3 + i * 16;const [tuple0_0, tuple0_1] = e;
    const ptr1 = utf8Encode(tuple0_0, realloc0, memory0);
    const len1 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 4, len1, true);
    dataView(memory0).setInt32(base + 0, ptr1, true);
    const ptr2 = utf8Encode(tuple0_1, realloc0, memory0);
    const len2 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 12, len2, true);
    dataView(memory0).setInt32(base + 8, ptr2, true);
  }
  dataView(memory0).setInt32(arg0 + 4, len3, true);
  dataView(memory0).setInt32(arg0 + 0, result3, true);
}

function trampoline33(arg0) {
  const ret = getTerminalStdin();
  const variant1 = ret;
  if (variant1 === null || variant1=== undefined) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalInput)) {
      throw new Error('Not a valid "TerminalInput" resource.');
    }
    const handle0 = handleCnt6++;
    handleTable6.set(handle0, { rep: e, own: true });
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}

function trampoline34(arg0) {
  const ret = getTerminalStdout();
  const variant1 = ret;
  if (variant1 === null || variant1=== undefined) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalOutput)) {
      throw new Error('Not a valid "TerminalOutput" resource.');
    }
    const handle0 = handleCnt7++;
    handleTable7.set(handle0, { rep: e, own: true });
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}

function trampoline35(arg0) {
  const ret = getTerminalStderr();
  const variant1 = ret;
  if (variant1 === null || variant1=== undefined) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalOutput)) {
      throw new Error('Not a valid "TerminalOutput" resource.');
    }
    const handle0 = handleCnt7++;
    handleTable7.set(handle0, { rep: e, own: true });
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
}
let exports3;
let realloc1;
let postReturn0;
let postReturn1;
const handleTable4= new Map();
let handleCnt4 = 0;
function trampoline0(handle) {
  const handleEntry = handleTable4.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable4.delete(handle);
}
const handleTable1= new Map();
let handleCnt1 = 0;
function trampoline1(handle) {
  const handleEntry = handleTable1.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable1.delete(handle);
}
const handleTable0= new Map();
let handleCnt0 = 0;
function trampoline2(handle) {
  const handleEntry = handleTable0.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable0.delete(handle);
}
const handleTable2= new Map();
let handleCnt2 = 0;
function trampoline3(handle) {
  const handleEntry = handleTable2.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable2.delete(handle);
}
const handleTable3= new Map();
let handleCnt3 = 0;
function trampoline4(handle) {
  const handleEntry = handleTable3.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable3.delete(handle);
}
const handleTable5= new Map();
let handleCnt5 = 0;
function trampoline5(handle) {
  const handleEntry = handleTable5.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable5.delete(handle);
}
const handleTable6= new Map();
let handleCnt6 = 0;
function trampoline6(handle) {
  const handleEntry = handleTable6.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable6.delete(handle);
}
const handleTable7= new Map();
let handleCnt7 = 0;
function trampoline7(handle) {
  const handleEntry = handleTable7.get(handle);
  if (!handleEntry) {
    throw new Error(`Resource error: Invalid handle ${handle}`);
  }
  handleTable7.delete(handle);
}

function stubWasi(arg0, arg1) {
  const val0 = arg0;
  const len0 = val0.byteLength;
  const ptr0 = realloc1(0, 0, 1, len0 * 1);
  const src0 = new Uint8Array(val0.buffer || val0, val0.byteOffset, len0 * 1);
  (new Uint8Array(memory0.buffer, ptr0, len0 * 1)).set(src0);
  const ret = exports1['stub-wasi'](ptr0, len0, arg1 ? 1 : 0);
  let variant3;
  switch (dataView(memory0).getUint8(ret + 0, true)) {
    case 0: {
      const ptr1 = dataView(memory0).getInt32(ret + 4, true);
      const len1 = dataView(memory0).getInt32(ret + 8, true);
      const result1 = new Uint8Array(memory0.buffer.slice(ptr1, ptr1 + len1 * 1));
      variant3= {
        tag: 'ok',
        val: result1
      };
      break;
    }
    case 1: {
      const ptr2 = dataView(memory0).getInt32(ret + 4, true);
      const len2 = dataView(memory0).getInt32(ret + 8, true);
      const result2 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr2, len2));
      variant3= {
        tag: 'err',
        val: result2
      };
      break;
    }
    default: {
      throw new TypeError('invalid variant discriminant for expected');
    }
  }
  postReturn0(ret);
  if (variant3.tag === 'err') {
    throw new ComponentError(variant3.val);
  }
  return variant3.val;
}

function spliceBindings(arg0, arg1, arg2, arg3, arg4) {
  const variant1 = arg0;
  let variant1_0;
  let variant1_1;
  let variant1_2;
  if (variant1 === null || variant1=== undefined) {
    variant1_0 = 0;
    variant1_1 = 0;
    variant1_2 = 0;
  } else {
    const e = variant1;
    const ptr0 = utf8Encode(e, realloc1, memory0);
    const len0 = utf8EncodedLen;
    variant1_0 = 1;
    variant1_1 = ptr0;
    variant1_2 = len0;
  }
  const val2 = arg1;
  const len2 = val2.byteLength;
  const ptr2 = realloc1(0, 0, 1, len2 * 1);
  const src2 = new Uint8Array(val2.buffer || val2, val2.byteOffset, len2 * 1);
  (new Uint8Array(memory0.buffer, ptr2, len2 * 1)).set(src2);
  const variant4 = arg2;
  let variant4_0;
  let variant4_1;
  let variant4_2;
  if (variant4 === null || variant4=== undefined) {
    variant4_0 = 0;
    variant4_1 = 0;
    variant4_2 = 0;
  } else {
    const e = variant4;
    const ptr3 = utf8Encode(e, realloc1, memory0);
    const len3 = utf8EncodedLen;
    variant4_0 = 1;
    variant4_1 = ptr3;
    variant4_2 = len3;
  }
  const variant6 = arg3;
  let variant6_0;
  let variant6_1;
  let variant6_2;
  if (variant6 === null || variant6=== undefined) {
    variant6_0 = 0;
    variant6_1 = 0;
    variant6_2 = 0;
  } else {
    const e = variant6;
    const ptr5 = utf8Encode(e, realloc1, memory0);
    const len5 = utf8EncodedLen;
    variant6_0 = 1;
    variant6_1 = ptr5;
    variant6_2 = len5;
  }
  const variant8 = arg4;
  let variant8_0;
  let variant8_1;
  let variant8_2;
  if (variant8 === null || variant8=== undefined) {
    variant8_0 = 0;
    variant8_1 = 0;
    variant8_2 = 0;
  } else {
    const e = variant8;
    const ptr7 = utf8Encode(e, realloc1, memory0);
    const len7 = utf8EncodedLen;
    variant8_0 = 1;
    variant8_1 = ptr7;
    variant8_2 = len7;
  }
  const ret = exports1['splice-bindings'](variant1_0, variant1_1, variant1_2, ptr2, len2, variant4_0, variant4_1, variant4_2, variant6_0, variant6_1, variant6_2, variant8_0, variant8_1, variant8_2);
  let variant26;
  switch (dataView(memory0).getUint8(ret + 0, true)) {
    case 0: {
      const ptr9 = dataView(memory0).getInt32(ret + 4, true);
      const len9 = dataView(memory0).getInt32(ret + 8, true);
      const result9 = new Uint8Array(memory0.buffer.slice(ptr9, ptr9 + len9 * 1));
      const ptr10 = dataView(memory0).getInt32(ret + 12, true);
      const len10 = dataView(memory0).getInt32(ret + 16, true);
      const result10 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr10, len10));
      const len18 = dataView(memory0).getInt32(ret + 24, true);
      const base18 = dataView(memory0).getInt32(ret + 20, true);
      const result18 = [];
      for (let i = 0; i < len18; i++) {
        const base = base18 + i * 28;
        const ptr11 = dataView(memory0).getInt32(base + 0, true);
        const len11 = dataView(memory0).getInt32(base + 4, true);
        const result11 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr11, len11));
        const len13 = dataView(memory0).getInt32(base + 12, true);
        const base13 = dataView(memory0).getInt32(base + 8, true);
        const result13 = [];
        for (let i = 0; i < len13; i++) {
          const base = base13 + i * 1;
          let enum12;
          switch (dataView(memory0).getUint8(base + 0, true)) {
            case 0: {
              enum12 = 'i32';
              break;
            }
            case 1: {
              enum12 = 'i64';
              break;
            }
            case 2: {
              enum12 = 'f32';
              break;
            }
            case 3: {
              enum12 = 'f64';
              break;
            }
            default: {
              throw new TypeError('invalid discriminant specified for CoreTy');
            }
          }
          result13.push(enum12);
        }
        let variant15;
        switch (dataView(memory0).getUint8(base + 16, true)) {
          case 0: {
            variant15 = undefined;
            break;
          }
          case 1: {
            let enum14;
            switch (dataView(memory0).getUint8(base + 17, true)) {
              case 0: {
                enum14 = 'i32';
                break;
              }
              case 1: {
                enum14 = 'i64';
                break;
              }
              case 2: {
                enum14 = 'f32';
                break;
              }
              case 3: {
                enum14 = 'f64';
                break;
              }
              default: {
                throw new TypeError('invalid discriminant specified for CoreTy');
              }
            }
            variant15 = enum14;
            break;
          }
          default: {
            throw new TypeError('invalid variant discriminant for option');
          }
        }
        const bool16 = dataView(memory0).getUint8(base + 18, true);
        const bool17 = dataView(memory0).getUint8(base + 24, true);
        result18.push([result11, {
          params: result13,
          ret: variant15,
          retptr: bool16 == 0 ? false : (bool16 == 1 ? true : throwInvalidBool()),
          retsize: dataView(memory0).getInt32(base + 20, true) >>> 0,
          paramptr: bool17 == 0 ? false : (bool17 == 1 ? true : throwInvalidBool()),
        }]);
      }
      const len21 = dataView(memory0).getInt32(ret + 32, true);
      const base21 = dataView(memory0).getInt32(ret + 28, true);
      const result21 = [];
      for (let i = 0; i < len21; i++) {
        const base = base21 + i * 16;
        const ptr19 = dataView(memory0).getInt32(base + 0, true);
        const len19 = dataView(memory0).getInt32(base + 4, true);
        const result19 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr19, len19));
        const ptr20 = dataView(memory0).getInt32(base + 8, true);
        const len20 = dataView(memory0).getInt32(base + 12, true);
        const result20 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr20, len20));
        result21.push([result19, result20]);
      }
      const len24 = dataView(memory0).getInt32(ret + 40, true);
      const base24 = dataView(memory0).getInt32(ret + 36, true);
      const result24 = [];
      for (let i = 0; i < len24; i++) {
        const base = base24 + i * 20;
        const ptr22 = dataView(memory0).getInt32(base + 0, true);
        const len22 = dataView(memory0).getInt32(base + 4, true);
        const result22 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr22, len22));
        const ptr23 = dataView(memory0).getInt32(base + 8, true);
        const len23 = dataView(memory0).getInt32(base + 12, true);
        const result23 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr23, len23));
        result24.push([result22, result23, dataView(memory0).getInt32(base + 16, true) >>> 0]);
      }
      variant26= {
        tag: 'ok',
        val: {
          wasm: result9,
          jsBindings: result10,
          exports: result18,
          importWrappers: result21,
          imports: result24,
        }
      };
      break;
    }
    case 1: {
      const ptr25 = dataView(memory0).getInt32(ret + 4, true);
      const len25 = dataView(memory0).getInt32(ret + 8, true);
      const result25 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr25, len25));
      variant26= {
        tag: 'err',
        val: result25
      };
      break;
    }
    default: {
      throw new TypeError('invalid variant discriminant for expected');
    }
  }
  postReturn1(ret);
  if (variant26.tag === 'err') {
    throw new ComponentError(variant26.val);
  }
  return variant26.val;
}

const $init = (async() => {
  const module0 = fetchCompile(new URL('./spidermonkey-embedding-splicer.core.wasm', import.meta.url));
  const module1 = fetchCompile(new URL('./spidermonkey-embedding-splicer.core2.wasm', import.meta.url));
  const module2 = base64Compile('AGFzbQEAAAABbA9gAX8AYAN/fn8AYAJ/fwBgBX9/f39/AGAIf39/f39/f38AYAR/f39/AGACfn8AYAJ/fwF/YAR/f39/AX9gBX9/f35/AX9gBX9/f39/AX9gCX9/f39/fn5/fwF/YAF/AX9gA39/fwF/YAF/AAMmJQABAQICAgIDBAIDAgIBAQIFBQIGAAAAAAcICQgKCwcHBwwHDQ4EBQFwASUlB7sBJgEwAAABMQABATIAAgEzAAMBNAAEATUABQE2AAYBNwAHATgACAE5AAkCMTAACgIxMQALAjEyAAwCMTMADQIxNAAOAjE1AA8CMTYAEAIxNwARAjE4ABICMTkAEwIyMAAUAjIxABUCMjIAFgIyMwAXAjI0ABgCMjUAGQIyNgAaAjI3ABsCMjgAHAIyOQAdAjMwAB4CMzEAHwIzMgAgAjMzACECMzQAIgIzNQAjAjM2ACQIJGltcG9ydHMBAAr7AyUJACAAQQARAAALDQAgACABIAJBAREBAAsNACAAIAEgAkECEQEACwsAIAAgAUEDEQIACwsAIAAgAUEEEQIACwsAIAAgAUEFEQIACwsAIAAgAUEGEQIACxEAIAAgASACIAMgBEEHEQMACxcAIAAgASACIAMgBCAFIAYgB0EIEQQACwsAIAAgAUEJEQIACxEAIAAgASACIAMgBEEKEQMACwsAIAAgAUELEQIACwsAIAAgAUEMEQIACw0AIAAgASACQQ0RAQALDQAgACABIAJBDhEBAAsLACAAIAFBDxECAAsPACAAIAEgAiADQRARBQALDwAgACABIAIgA0EREQUACwsAIAAgAUESEQIACwsAIAAgAUETEQYACwkAIABBFBEAAAsJACAAQRURAAALCQAgAEEWEQAACwkAIABBFxEAAAsLACAAIAFBGBEHAAsPACAAIAEgAiADQRkRCAALEQAgACABIAIgAyAEQRoRCQALDwAgACABIAIgA0EbEQgACxEAIAAgASACIAMgBEEcEQoACxkAIAAgASACIAMgBCAFIAYgByAIQR0RCwALCwAgACABQR4RBwALCwAgACABQR8RBwALCwAgACABQSARBwALCQAgAEEhEQwACwsAIAAgAUEiEQcACw0AIAAgASACQSMRDQALCQAgAEEkEQ4ACwAuCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AQ13aXQtY29tcG9uZW50BjAuMTYuMADQEwRuYW1lABMSd2l0LWNvbXBvbmVudDpzaGltAbMTJQBFaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3ByZW9wZW5zQDAuMi4wLXJjLTIwMjMtMTEtMDUtZ2V0LWRpcmVjdG9yaWVzAVVpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0wNS1bbWV0aG9kXWRlc2NyaXB0b3IucmVhZC12aWEtc3RyZWFtAlZpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0wNS1bbWV0aG9kXWRlc2NyaXB0b3Iud3JpdGUtdmlhLXN0cmVhbQNXaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMDUtW21ldGhvZF1kZXNjcmlwdG9yLmFwcGVuZC12aWEtc3RyZWFtBE5pbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0wNS1bbWV0aG9kXWRlc2NyaXB0b3IuZ2V0LXR5cGUFVGluZGlyZWN0LXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTA1LVttZXRob2RdZGVzY3JpcHRvci5yZWFkLWRpcmVjdG9yeQZKaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMDUtW21ldGhvZF1kZXNjcmlwdG9yLnN0YXQHTWluZGlyZWN0LXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTA1LVttZXRob2RdZGVzY3JpcHRvci5zdGF0LWF0CE1pbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0wNS1bbWV0aG9kXWRlc2NyaXB0b3Iub3Blbi1hdAlTaW5kaXJlY3Qtd2FzaTpmaWxlc3lzdGVtL3R5cGVzQDAuMi4wLXJjLTIwMjMtMTEtMDUtW21ldGhvZF1kZXNjcmlwdG9yLm1ldGFkYXRhLWhhc2gKVmluZGlyZWN0LXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTA1LVttZXRob2RdZGVzY3JpcHRvci5tZXRhZGF0YS1oYXNoLWF0C2ZpbmRpcmVjdC13YXNpOmZpbGVzeXN0ZW0vdHlwZXNAMC4yLjAtcmMtMjAyMy0xMS0wNS1bbWV0aG9kXWRpcmVjdG9yeS1lbnRyeS1zdHJlYW0ucmVhZC1kaXJlY3RvcnktZW50cnkMSGluZGlyZWN0LXdhc2k6ZmlsZXN5c3RlbS90eXBlc0AwLjIuMC1yYy0yMDIzLTExLTA1LWZpbGVzeXN0ZW0tZXJyb3ItY29kZQ1GaW5kaXJlY3Qtd2FzaTppby9zdHJlYW1zQDAuMi4wLXJjLTIwMjMtMTEtMDUtW21ldGhvZF1pbnB1dC1zdHJlYW0ucmVhZA5PaW5kaXJlY3Qtd2FzaTppby9zdHJlYW1zQDAuMi4wLXJjLTIwMjMtMTEtMDUtW21ldGhvZF1pbnB1dC1zdHJlYW0uYmxvY2tpbmctcmVhZA9OaW5kaXJlY3Qtd2FzaTppby9zdHJlYW1zQDAuMi4wLXJjLTIwMjMtMTEtMDUtW21ldGhvZF1vdXRwdXQtc3RyZWFtLmNoZWNrLXdyaXRlEEhpbmRpcmVjdC13YXNpOmlvL3N0cmVhbXNAMC4yLjAtcmMtMjAyMy0xMS0wNS1bbWV0aG9kXW91dHB1dC1zdHJlYW0ud3JpdGURW2luZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTA1LVttZXRob2Rdb3V0cHV0LXN0cmVhbS5ibG9ja2luZy13cml0ZS1hbmQtZmx1c2gSUWluZGlyZWN0LXdhc2k6aW8vc3RyZWFtc0AwLjIuMC1yYy0yMDIzLTExLTA1LVttZXRob2Rdb3V0cHV0LXN0cmVhbS5ibG9ja2luZy1mbHVzaBNAaW5kaXJlY3Qtd2FzaTpyYW5kb20vcmFuZG9tQDAuMi4wLXJjLTIwMjMtMTEtMDUtZ2V0LXJhbmRvbS1ieXRlcxRBaW5kaXJlY3Qtd2FzaTpjbGkvZW52aXJvbm1lbnRAMC4yLjAtcmMtMjAyMy0xMS0wNS1nZXQtZW52aXJvbm1lbnQVR2luZGlyZWN0LXdhc2k6Y2xpL3Rlcm1pbmFsLXN0ZGluQDAuMi4wLXJjLTIwMjMtMTEtMDUtZ2V0LXRlcm1pbmFsLXN0ZGluFklpbmRpcmVjdC13YXNpOmNsaS90ZXJtaW5hbC1zdGRvdXRAMC4yLjAtcmMtMjAyMy0xMS0wNS1nZXQtdGVybWluYWwtc3Rkb3V0F0lpbmRpcmVjdC13YXNpOmNsaS90ZXJtaW5hbC1zdGRlcnJAMC4yLjAtcmMtMjAyMy0xMS0wNS1nZXQtdGVybWluYWwtc3RkZXJyGCxhZGFwdC13YXNpX3NuYXBzaG90X3ByZXZpZXcxLWZkX2ZpbGVzdGF0X2dldBkkYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF9yZWFkGidhZGFwdC13YXNpX3NuYXBzaG90X3ByZXZpZXcxLWZkX3JlYWRkaXIbJWFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfd3JpdGUcLmFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtcGF0aF9maWxlc3RhdF9nZXQdJmFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtcGF0aF9vcGVuHidhZGFwdC13YXNpX3NuYXBzaG90X3ByZXZpZXcxLXJhbmRvbV9nZXQfKGFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZW52aXJvbl9nZXQgLmFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZW52aXJvbl9zaXplc19nZXQhJWFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfY2xvc2UiK2FkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfcHJlc3RhdF9nZXQjMGFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfcHJlc3RhdF9kaXJfbmFtZSQmYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1wcm9jX2V4aXQ');
  const module3 = base64Compile('AGFzbQEAAAABbA9gAX8AYAN/fn8AYAJ/fwBgBX9/f39/AGAIf39/f39/f38AYAR/f39/AGACfn8AYAJ/fwF/YAR/f39/AX9gBX9/f35/AX9gBX9/f39/AX9gCX9/f39/fn5/fwF/YAF/AX9gA39/fwF/YAF/AALkASYAATAAAAABMQABAAEyAAEAATMAAgABNAACAAE1AAIAATYAAgABNwADAAE4AAQAATkAAgACMTAAAwACMTEAAgACMTIAAgACMTMAAQACMTQAAQACMTUAAgACMTYABQACMTcABQACMTgAAgACMTkABgACMjAAAAACMjEAAAACMjIAAAACMjMAAAACMjQABwACMjUACAACMjYACQACMjcACAACMjgACgACMjkACwACMzAABwACMzEABwACMzIABwACMzMADAACMzQABwACMzUADQACMzYADgAIJGltcG9ydHMBcAElJQkrAQBBAAslAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJAAuCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AQ13aXQtY29tcG9uZW50BjAuMTYuMAAcBG5hbWUAFRR3aXQtY29tcG9uZW50OmZpeHVwcw');
  const instanceFlags0 = new WebAssembly.Global({ value: "i32", mutable: true }, 3);
  Promise.all([module0, module1, module2, module3]).catch(() => {});
  ({ exports: exports0 } = await instantiateCore(await module2));
  ({ exports: exports1 } = await instantiateCore(await module0, {
    wasi_snapshot_preview1: {
      environ_get: exports0['31'],
      environ_sizes_get: exports0['32'],
      fd_close: exports0['33'],
      fd_filestat_get: exports0['24'],
      fd_prestat_dir_name: exports0['35'],
      fd_prestat_get: exports0['34'],
      fd_read: exports0['25'],
      fd_readdir: exports0['26'],
      fd_write: exports0['27'],
      path_filestat_get: exports0['28'],
      path_open: exports0['29'],
      proc_exit: exports0['36'],
      random_get: exports0['30'],
    },
  }));
  ({ exports: exports2 } = await instantiateCore(await module1, {
    __main_module__: {
      cabi_realloc: exports1.cabi_realloc,
    },
    env: {
      memory: exports1.memory,
    },
    'wasi:cli/environment@0.2.0-rc-2023-11-05': {
      'get-environment': exports0['20'],
    },
    'wasi:cli/exit@0.2.0-rc-2023-11-05': {
      exit: trampoline9,
    },
    'wasi:cli/stderr@0.2.0-rc-2023-11-05': {
      'get-stderr': trampoline8,
    },
    'wasi:cli/stdin@0.2.0-rc-2023-11-05': {
      'get-stdin': trampoline10,
    },
    'wasi:cli/stdout@0.2.0-rc-2023-11-05': {
      'get-stdout': trampoline11,
    },
    'wasi:cli/terminal-input@0.2.0-rc-2023-11-05': {
      '[resource-drop]terminal-input': trampoline6,
    },
    'wasi:cli/terminal-output@0.2.0-rc-2023-11-05': {
      '[resource-drop]terminal-output': trampoline7,
    },
    'wasi:cli/terminal-stderr@0.2.0-rc-2023-11-05': {
      'get-terminal-stderr': exports0['23'],
    },
    'wasi:cli/terminal-stdin@0.2.0-rc-2023-11-05': {
      'get-terminal-stdin': exports0['21'],
    },
    'wasi:cli/terminal-stdout@0.2.0-rc-2023-11-05': {
      'get-terminal-stdout': exports0['22'],
    },
    'wasi:filesystem/preopens@0.2.0-rc-2023-11-05': {
      'get-directories': exports0['0'],
    },
    'wasi:filesystem/types@0.2.0-rc-2023-11-05': {
      '[method]descriptor.append-via-stream': exports0['3'],
      '[method]descriptor.get-type': exports0['4'],
      '[method]descriptor.metadata-hash': exports0['9'],
      '[method]descriptor.metadata-hash-at': exports0['10'],
      '[method]descriptor.open-at': exports0['8'],
      '[method]descriptor.read-directory': exports0['5'],
      '[method]descriptor.read-via-stream': exports0['1'],
      '[method]descriptor.stat': exports0['6'],
      '[method]descriptor.stat-at': exports0['7'],
      '[method]descriptor.write-via-stream': exports0['2'],
      '[method]directory-entry-stream.read-directory-entry': exports0['11'],
      '[resource-drop]descriptor': trampoline4,
      '[resource-drop]directory-entry-stream': trampoline0,
      'filesystem-error-code': exports0['12'],
    },
    'wasi:io/streams@0.2.0-rc-2023-11-05': {
      '[method]input-stream.blocking-read': exports0['14'],
      '[method]input-stream.read': exports0['13'],
      '[method]output-stream.blocking-flush': exports0['18'],
      '[method]output-stream.blocking-write-and-flush': exports0['17'],
      '[method]output-stream.check-write': exports0['15'],
      '[method]output-stream.write': exports0['16'],
      '[resource-drop]error': trampoline1,
      '[resource-drop]input-stream': trampoline2,
      '[resource-drop]output-stream': trampoline3,
    },
    'wasi:random/random@0.2.0-rc-2023-11-05': {
      'get-random-bytes': exports0['19'],
    },
    'wasi:sockets/tcp@0.2.0-rc-2023-11-05': {
      '[resource-drop]tcp-socket': trampoline5,
    },
  }));
  memory0 = exports1.memory;
  realloc0 = exports2.cabi_import_realloc;
  ({ exports: exports3 } = await instantiateCore(await module3, {
    '': {
      $imports: exports0.$imports,
      '0': trampoline12,
      '1': trampoline13,
      '10': trampoline22,
      '11': trampoline23,
      '12': trampoline24,
      '13': trampoline25,
      '14': trampoline26,
      '15': trampoline27,
      '16': trampoline28,
      '17': trampoline29,
      '18': trampoline30,
      '19': trampoline31,
      '2': trampoline14,
      '20': trampoline32,
      '21': trampoline33,
      '22': trampoline34,
      '23': trampoline35,
      '24': exports2.fd_filestat_get,
      '25': exports2.fd_read,
      '26': exports2.fd_readdir,
      '27': exports2.fd_write,
      '28': exports2.path_filestat_get,
      '29': exports2.path_open,
      '3': trampoline15,
      '30': exports2.random_get,
      '31': exports2.environ_get,
      '32': exports2.environ_sizes_get,
      '33': exports2.fd_close,
      '34': exports2.fd_prestat_get,
      '35': exports2.fd_prestat_dir_name,
      '36': exports2.proc_exit,
      '4': trampoline16,
      '5': trampoline17,
      '6': trampoline18,
      '7': trampoline19,
      '8': trampoline20,
      '9': trampoline21,
    },
  }));
  realloc1 = exports1.cabi_realloc;
  postReturn0 = exports1['cabi_post_stub-wasi'];
  postReturn1 = exports1['cabi_post_splice-bindings'];
})();

await $init;

export { spliceBindings, stubWasi }