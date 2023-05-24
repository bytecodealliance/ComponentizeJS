import { exit as lowering5Callee } from '@bytecodealliance/preview2-shim/exit';
import { getStdio as lowering8Callee, getDirectories as lowering9Callee } from '@bytecodealliance/preview2-shim/preopens';
import { dropInputStream as lowering6Callee, dropOutputStream as lowering7Callee, read as lowering18Callee, blockingRead as lowering19Callee, write as lowering20Callee, blockingWrite as lowering21Callee } from '@bytecodealliance/preview2-shim/streams';
import { getRandomBytes as lowering16Callee } from '@bytecodealliance/preview2-shim/random';
import { dropDirectoryEntryStream as lowering0Callee, readViaStream as lowering1Callee, writeViaStream as lowering2Callee, appendViaStream as lowering3Callee, dropDescriptor as lowering4Callee, getType as lowering10Callee, readDirectory as lowering11Callee, stat as lowering12Callee, statAt as lowering13Callee, openAt as lowering14Callee, readDirectoryEntry as lowering15Callee } from '@bytecodealliance/preview2-shim/filesystem';
import { getEnvironment as lowering17Callee } from '@bytecodealliance/preview2-shim/environment';

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

function lowering0(arg0) {
  lowering0Callee(arg0 >>> 0);
}

function lowering1(arg0, arg1) {
  const ret = lowering1Callee(arg0 >>> 0, BigInt.asUintN(64, arg1));
  return toUint32(ret);
}

function lowering2(arg0, arg1) {
  const ret = lowering2Callee(arg0 >>> 0, BigInt.asUintN(64, arg1));
  return toUint32(ret);
}

function lowering3(arg0) {
  const ret = lowering3Callee(arg0 >>> 0);
  return toUint32(ret);
}

function lowering4(arg0) {
  lowering4Callee(arg0 >>> 0);
}

function lowering5(arg0) {
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
  lowering5Callee(variant0);
}

function lowering6(arg0) {
  lowering6Callee(arg0 >>> 0);
}

function lowering7(arg0) {
  lowering7Callee(arg0 >>> 0);
}
let exports2;
let memory0;

function lowering8(arg0) {
  const ret = lowering8Callee();
  const {stdin: v0_0, stdout: v0_1, stderr: v0_2 } = ret;
  dataView(memory0).setInt32(arg0 + 0, toUint32(v0_0), true);
  dataView(memory0).setInt32(arg0 + 4, toUint32(v0_1), true);
  dataView(memory0).setInt32(arg0 + 8, toUint32(v0_2), true);
}
let realloc0;

function lowering9(arg0) {
  const ret = lowering9Callee();
  const vec2 = ret;
  const len2 = vec2.length;
  const result2 = realloc0(0, 0, 4, len2 * 12);
  for (let i = 0; i < vec2.length; i++) {
    const e = vec2[i];
    const base = result2 + i * 12;const [tuple0_0, tuple0_1] = e;
    dataView(memory0).setInt32(base + 0, toUint32(tuple0_0), true);
    const ptr1 = utf8Encode(tuple0_1, realloc0, memory0);
    const len1 = utf8EncodedLen;
    dataView(memory0).setInt32(base + 8, len1, true);
    dataView(memory0).setInt32(base + 4, ptr1, true);
  }
  dataView(memory0).setInt32(arg0 + 4, len2, true);
  dataView(memory0).setInt32(arg0 + 0, result2, true);
}

function lowering10(arg0, arg1) {
  let ret;
  try {
    ret = { tag: 'ok', val: lowering10Callee(arg0 >>> 0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant2 = ret;
  switch (variant2.tag) {
    case 'ok': {
      const e = variant2.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      const val0 = e;
      let enum0;
      switch (val0) {
        case 'unknown': {
          enum0 = 0;
          break;
        }
        case 'block-device': {
          enum0 = 1;
          break;
        }
        case 'character-device': {
          enum0 = 2;
          break;
        }
        case 'directory': {
          enum0 = 3;
          break;
        }
        case 'fifo': {
          enum0 = 4;
          break;
        }
        case 'symbolic-link': {
          enum0 = 5;
          break;
        }
        case 'regular-file': {
          enum0 = 6;
          break;
        }
        case 'socket': {
          enum0 = 7;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val0}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum0, true);
      break;
    }
    case 'err': {
      const e = variant2.val;
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
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering11(arg0, arg1) {
  let ret;
  try {
    ret = { tag: 'ok', val: lowering11Callee(arg0 >>> 0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant1 = ret;
  switch (variant1.tag) {
    case 'ok': {
      const e = variant1.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      dataView(memory0).setInt32(arg1 + 4, toUint32(e), true);
      break;
    }
    case 'err': {
      const e = variant1.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      const val0 = e;
      let enum0;
      switch (val0) {
        case 'access': {
          enum0 = 0;
          break;
        }
        case 'would-block': {
          enum0 = 1;
          break;
        }
        case 'already': {
          enum0 = 2;
          break;
        }
        case 'bad-descriptor': {
          enum0 = 3;
          break;
        }
        case 'busy': {
          enum0 = 4;
          break;
        }
        case 'deadlock': {
          enum0 = 5;
          break;
        }
        case 'quota': {
          enum0 = 6;
          break;
        }
        case 'exist': {
          enum0 = 7;
          break;
        }
        case 'file-too-large': {
          enum0 = 8;
          break;
        }
        case 'illegal-byte-sequence': {
          enum0 = 9;
          break;
        }
        case 'in-progress': {
          enum0 = 10;
          break;
        }
        case 'interrupted': {
          enum0 = 11;
          break;
        }
        case 'invalid': {
          enum0 = 12;
          break;
        }
        case 'io': {
          enum0 = 13;
          break;
        }
        case 'is-directory': {
          enum0 = 14;
          break;
        }
        case 'loop': {
          enum0 = 15;
          break;
        }
        case 'too-many-links': {
          enum0 = 16;
          break;
        }
        case 'message-size': {
          enum0 = 17;
          break;
        }
        case 'name-too-long': {
          enum0 = 18;
          break;
        }
        case 'no-device': {
          enum0 = 19;
          break;
        }
        case 'no-entry': {
          enum0 = 20;
          break;
        }
        case 'no-lock': {
          enum0 = 21;
          break;
        }
        case 'insufficient-memory': {
          enum0 = 22;
          break;
        }
        case 'insufficient-space': {
          enum0 = 23;
          break;
        }
        case 'not-directory': {
          enum0 = 24;
          break;
        }
        case 'not-empty': {
          enum0 = 25;
          break;
        }
        case 'not-recoverable': {
          enum0 = 26;
          break;
        }
        case 'unsupported': {
          enum0 = 27;
          break;
        }
        case 'no-tty': {
          enum0 = 28;
          break;
        }
        case 'no-such-device': {
          enum0 = 29;
          break;
        }
        case 'overflow': {
          enum0 = 30;
          break;
        }
        case 'not-permitted': {
          enum0 = 31;
          break;
        }
        case 'pipe': {
          enum0 = 32;
          break;
        }
        case 'read-only': {
          enum0 = 33;
          break;
        }
        case 'invalid-seek': {
          enum0 = 34;
          break;
        }
        case 'text-file-busy': {
          enum0 = 35;
          break;
        }
        case 'cross-device': {
          enum0 = 36;
          break;
        }
        default: {
          if ((e) instanceof Error) {
            console.error(e);
          }
          
          throw new TypeError(`"${val0}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum0, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering12(arg0, arg1) {
  let ret;
  try {
    ret = { tag: 'ok', val: lowering12Callee(arg0 >>> 0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant6 = ret;
  switch (variant6.tag) {
    case 'ok': {
      const e = variant6.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      const {device: v0_0, inode: v0_1, type: v0_2, linkCount: v0_3, size: v0_4, dataAccessTimestamp: v0_5, dataModificationTimestamp: v0_6, statusChangeTimestamp: v0_7 } = e;
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(v0_0), true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v0_1), true);
      const val1 = v0_2;
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
          if ((v0_2) instanceof Error) {
            console.error(v0_2);
          }
          
          throw new TypeError(`"${val1}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 24, enum1, true);
      dataView(memory0).setBigInt64(arg1 + 32, toUint64(v0_3), true);
      dataView(memory0).setBigInt64(arg1 + 40, toUint64(v0_4), true);
      const {seconds: v2_0, nanoseconds: v2_1 } = v0_5;
      dataView(memory0).setBigInt64(arg1 + 48, toUint64(v2_0), true);
      dataView(memory0).setInt32(arg1 + 56, toUint32(v2_1), true);
      const {seconds: v3_0, nanoseconds: v3_1 } = v0_6;
      dataView(memory0).setBigInt64(arg1 + 64, toUint64(v3_0), true);
      dataView(memory0).setInt32(arg1 + 72, toUint32(v3_1), true);
      const {seconds: v4_0, nanoseconds: v4_1 } = v0_7;
      dataView(memory0).setBigInt64(arg1 + 80, toUint64(v4_0), true);
      dataView(memory0).setInt32(arg1 + 88, toUint32(v4_1), true);
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
      dataView(memory0).setInt8(arg1 + 8, enum5, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering13(arg0, arg1, arg2, arg3, arg4) {
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags0 = {
    symlinkFollow: Boolean(arg1 & 1),
  };
  const ptr1 = arg2;
  const len1 = arg3;
  const result1 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr1, len1));
  let ret;
  try {
    ret = { tag: 'ok', val: lowering13Callee(arg0 >>> 0, flags0, result1) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant8 = ret;
  switch (variant8.tag) {
    case 'ok': {
      const e = variant8.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      const {device: v2_0, inode: v2_1, type: v2_2, linkCount: v2_3, size: v2_4, dataAccessTimestamp: v2_5, dataModificationTimestamp: v2_6, statusChangeTimestamp: v2_7 } = e;
      dataView(memory0).setBigInt64(arg4 + 8, toUint64(v2_0), true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v2_1), true);
      const val3 = v2_2;
      let enum3;
      switch (val3) {
        case 'unknown': {
          enum3 = 0;
          break;
        }
        case 'block-device': {
          enum3 = 1;
          break;
        }
        case 'character-device': {
          enum3 = 2;
          break;
        }
        case 'directory': {
          enum3 = 3;
          break;
        }
        case 'fifo': {
          enum3 = 4;
          break;
        }
        case 'symbolic-link': {
          enum3 = 5;
          break;
        }
        case 'regular-file': {
          enum3 = 6;
          break;
        }
        case 'socket': {
          enum3 = 7;
          break;
        }
        default: {
          if ((v2_2) instanceof Error) {
            console.error(v2_2);
          }
          
          throw new TypeError(`"${val3}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg4 + 24, enum3, true);
      dataView(memory0).setBigInt64(arg4 + 32, toUint64(v2_3), true);
      dataView(memory0).setBigInt64(arg4 + 40, toUint64(v2_4), true);
      const {seconds: v4_0, nanoseconds: v4_1 } = v2_5;
      dataView(memory0).setBigInt64(arg4 + 48, toUint64(v4_0), true);
      dataView(memory0).setInt32(arg4 + 56, toUint32(v4_1), true);
      const {seconds: v5_0, nanoseconds: v5_1 } = v2_6;
      dataView(memory0).setBigInt64(arg4 + 64, toUint64(v5_0), true);
      dataView(memory0).setInt32(arg4 + 72, toUint32(v5_1), true);
      const {seconds: v6_0, nanoseconds: v6_1 } = v2_7;
      dataView(memory0).setBigInt64(arg4 + 80, toUint64(v6_0), true);
      dataView(memory0).setInt32(arg4 + 88, toUint32(v6_1), true);
      break;
    }
    case 'err': {
      const e = variant8.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
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
      dataView(memory0).setInt8(arg4 + 8, enum7, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering14(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags0 = {
    symlinkFollow: Boolean(arg1 & 1),
  };
  const ptr1 = arg2;
  const len1 = arg3;
  const result1 = utf8Decoder.decode(new Uint8Array(memory0.buffer, ptr1, len1));
  if ((arg4 & 4294967280) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags2 = {
    create: Boolean(arg4 & 1),
    directory: Boolean(arg4 & 2),
    exclusive: Boolean(arg4 & 4),
    truncate: Boolean(arg4 & 8),
  };
  if ((arg5 & 4294967232) !== 0) {
    throw new TypeError('flags have extraneous bits set');
  }
  const flags3 = {
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
  const flags4 = {
    readable: Boolean(arg6 & 1),
    writeable: Boolean(arg6 & 2),
    executable: Boolean(arg6 & 4),
  };
  let ret;
  try {
    ret = { tag: 'ok', val: lowering14Callee(arg0 >>> 0, flags0, result1, flags2, flags3, flags4) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant6 = ret;
  switch (variant6.tag) {
    case 'ok': {
      const e = variant6.val;
      dataView(memory0).setInt8(arg7 + 0, 0, true);
      dataView(memory0).setInt32(arg7 + 4, toUint32(e), true);
      break;
    }
    case 'err': {
      const e = variant6.val;
      dataView(memory0).setInt8(arg7 + 0, 1, true);
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
      dataView(memory0).setInt8(arg7 + 4, enum5, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering15(arg0, arg1) {
  let ret;
  try {
    ret = { tag: 'ok', val: lowering15Callee(arg0 >>> 0) };
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
        dataView(memory0).setInt8(arg1 + 8, 0, true);
      } else {
        const e = variant4;
        dataView(memory0).setInt8(arg1 + 8, 1, true);
        const {inode: v0_0, type: v0_1, name: v0_2 } = e;
        const variant1 = v0_0;
        if (variant1 === null || variant1=== undefined) {
          dataView(memory0).setInt8(arg1 + 16, 0, true);
        } else {
          const e = variant1;
          dataView(memory0).setInt8(arg1 + 16, 1, true);
          dataView(memory0).setBigInt64(arg1 + 24, toUint64(e), true);
        }
        const val2 = v0_1;
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
            if ((v0_1) instanceof Error) {
              console.error(v0_1);
            }
            
            throw new TypeError(`"${val2}" is not one of the cases of descriptor-type`);
          }
        }
        dataView(memory0).setInt8(arg1 + 32, enum2, true);
        const ptr3 = utf8Encode(v0_2, realloc0, memory0);
        const len3 = utf8EncodedLen;
        dataView(memory0).setInt32(arg1 + 40, len3, true);
        dataView(memory0).setInt32(arg1 + 36, ptr3, true);
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
      dataView(memory0).setInt8(arg1 + 8, enum5, true);
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering16(arg0, arg1) {
  const ret = lowering16Callee(BigInt.asUintN(64, arg0));
  const val0 = ret;
  const len0 = val0.byteLength;
  const ptr0 = realloc0(0, 0, 1, len0 * 1);
  const src0 = new Uint8Array(val0.buffer || val0, val0.byteOffset, len0 * 1);
  (new Uint8Array(memory0.buffer, ptr0, len0 * 1)).set(src0);
  dataView(memory0).setInt32(arg1 + 4, len0, true);
  dataView(memory0).setInt32(arg1 + 0, ptr0, true);
}

function lowering17(arg0) {
  const ret = lowering17Callee();
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

function lowering18(arg0, arg1, arg2) {
  let ret;
  try {
    ret = { tag: 'ok', val: lowering18Callee(arg0 >>> 0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      const [tuple0_0, tuple0_1] = e;
      const val1 = tuple0_0;
      const len1 = val1.byteLength;
      const ptr1 = realloc0(0, 0, 1, len1 * 1);
      const src1 = new Uint8Array(val1.buffer || val1, val1.byteOffset, len1 * 1);
      (new Uint8Array(memory0.buffer, ptr1, len1 * 1)).set(src1);
      dataView(memory0).setInt32(arg2 + 8, len1, true);
      dataView(memory0).setInt32(arg2 + 4, ptr1, true);
      dataView(memory0).setInt8(arg2 + 12, tuple0_1 ? 1 : 0, true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      const { } = e;
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering19(arg0, arg1, arg2) {
  let ret;
  try {
    ret = { tag: 'ok', val: lowering19Callee(arg0 >>> 0, BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant3 = ret;
  switch (variant3.tag) {
    case 'ok': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      const [tuple0_0, tuple0_1] = e;
      const val1 = tuple0_0;
      const len1 = val1.byteLength;
      const ptr1 = realloc0(0, 0, 1, len1 * 1);
      const src1 = new Uint8Array(val1.buffer || val1, val1.byteOffset, len1 * 1);
      (new Uint8Array(memory0.buffer, ptr1, len1 * 1)).set(src1);
      dataView(memory0).setInt32(arg2 + 8, len1, true);
      dataView(memory0).setInt32(arg2 + 4, ptr1, true);
      dataView(memory0).setInt8(arg2 + 12, tuple0_1 ? 1 : 0, true);
      break;
    }
    case 'err': {
      const e = variant3.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      const { } = e;
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering20(arg0, arg1, arg2, arg3) {
  const ptr0 = arg1;
  const len0 = arg2;
  const result0 = new Uint8Array(memory0.buffer.slice(ptr0, ptr0 + len0 * 1));
  let ret;
  try {
    ret = { tag: 'ok', val: lowering20Callee(arg0 >>> 0, result0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant2 = ret;
  switch (variant2.tag) {
    case 'ok': {
      const e = variant2.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      dataView(memory0).setBigInt64(arg3 + 8, toUint64(e), true);
      break;
    }
    case 'err': {
      const e = variant2.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      const { } = e;
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}

function lowering21(arg0, arg1, arg2, arg3) {
  const ptr0 = arg1;
  const len0 = arg2;
  const result0 = new Uint8Array(memory0.buffer.slice(ptr0, ptr0 + len0 * 1));
  let ret;
  try {
    ret = { tag: 'ok', val: lowering21Callee(arg0 >>> 0, result0) };
  } catch (e) {
    ret = { tag: 'err', val: getErrorPayload(e) };
  }
  const variant2 = ret;
  switch (variant2.tag) {
    case 'ok': {
      const e = variant2.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      dataView(memory0).setBigInt64(arg3 + 8, toUint64(e), true);
      break;
    }
    case 'err': {
      const e = variant2.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      const { } = e;
      break;
    }
    default: {
      throw new TypeError('invalid variant specified for result');
    }
  }
}
let exports3;
let realloc1;
let postReturn0;
const exports = {
  spliceBindings(arg0, arg1, arg2, arg3, arg4) {
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
    const ret = exports1['exports#splice-bindings'](variant1_0, variant1_1, variant1_2, ptr2, len2, variant4_0, variant4_1, variant4_2, variant6_0, variant6_1, variant6_2, variant8_0, variant8_1, variant8_2);
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
              variant15 = null;
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
    postReturn0(ret);
    if (variant26.tag === 'err') {
      throw new ComponentError(variant26.val);
    }
    return variant26.val;
  },
  
};

export { exports }

const $init = (async() => {
  const module0 = fetchCompile(new URL('./spidermonkey-embedding-splicer.core.wasm', import.meta.url));
  const module1 = fetchCompile(new URL('./spidermonkey-embedding-splicer.core2.wasm', import.meta.url));
  const module2 = base64Compile('AGFzbQEAAAABbA9gAX8AYAJ/fwBgBX9/f39/AGAIf39/f39/f38AYAJ+fwBgA39+fwBgBH9/f38AYAJ/fwF/YAR/f39/AX9gBX9/f35/AX9gBX9/f39/AX9gCX9/f39/fn5/fwF/YAF/AX9gA39/fwF/YAF/AAMcGwAAAQEBAgMBBAAFBQYGBwgJCAoLBwcHDAcNDgQFAXABGxsHiQEcATAAAAExAAEBMgACATMAAwE0AAQBNQAFATYABgE3AAcBOAAIATkACQIxMAAKAjExAAsCMTIADAIxMwANAjE0AA4CMTUADwIxNgAQAjE3ABECMTgAEgIxOQATAjIwABQCMjEAFQIyMgAWAjIzABcCMjQAGAIyNQAZAjI2ABoIJGltcG9ydHMBAAr9AhsJACAAQQARAAALCQAgAEEBEQAACwsAIAAgAUECEQEACwsAIAAgAUEDEQEACwsAIAAgAUEEEQEACxEAIAAgASACIAMgBEEFEQIACxcAIAAgASACIAMgBCAFIAYgB0EGEQMACwsAIAAgAUEHEQEACwsAIAAgAUEIEQQACwkAIABBCREAAAsNACAAIAEgAkEKEQUACw0AIAAgASACQQsRBQALDwAgACABIAIgA0EMEQYACw8AIAAgASACIANBDREGAAsLACAAIAFBDhEHAAsPACAAIAEgAiADQQ8RCAALEQAgACABIAIgAyAEQRARCQALDwAgACABIAIgA0EREQgACxEAIAAgASACIAMgBEESEQoACxkAIAAgASACIAMgBCAFIAYgByAIQRMRCwALCwAgACABQRQRBwALCwAgACABQRURBwALCwAgACABQRYRBwALCQAgAEEXEQwACwsAIAAgAUEYEQcACw0AIAAgASACQRkRDQALCQAgAEEaEQ4ACwAtCXByb2R1Y2VycwEMcHJvY2Vzc2VkLWJ5AQ13aXQtY29tcG9uZW50BTAuOS4wAIMIBG5hbWUAExJ3aXQtY29tcG9uZW50OnNoaW0B5gcbABtpbmRpcmVjdC1wcmVvcGVucy1nZXQtc3RkaW8BIWluZGlyZWN0LXByZW9wZW5zLWdldC1kaXJlY3RvcmllcwIcaW5kaXJlY3QtZmlsZXN5c3RlbS1nZXQtdHlwZQMiaW5kaXJlY3QtZmlsZXN5c3RlbS1yZWFkLWRpcmVjdG9yeQQYaW5kaXJlY3QtZmlsZXN5c3RlbS1zdGF0BRtpbmRpcmVjdC1maWxlc3lzdGVtLXN0YXQtYXQGG2luZGlyZWN0LWZpbGVzeXN0ZW0tb3Blbi1hdAcoaW5kaXJlY3QtZmlsZXN5c3RlbS1yZWFkLWRpcmVjdG9yeS1lbnRyeQggaW5kaXJlY3QtcmFuZG9tLWdldC1yYW5kb20tYnl0ZXMJJGluZGlyZWN0LWVudmlyb25tZW50LWdldC1lbnZpcm9ubWVudAoVaW5kaXJlY3Qtc3RyZWFtcy1yZWFkCx5pbmRpcmVjdC1zdHJlYW1zLWJsb2NraW5nLXJlYWQMFmluZGlyZWN0LXN0cmVhbXMtd3JpdGUNH2luZGlyZWN0LXN0cmVhbXMtYmxvY2tpbmctd3JpdGUOLGFkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfZmlsZXN0YXRfZ2V0DyRhZGFwdC13YXNpX3NuYXBzaG90X3ByZXZpZXcxLWZkX3JlYWQQJ2FkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtZmRfcmVhZGRpchElYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF93cml0ZRIuYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1wYXRoX2ZpbGVzdGF0X2dldBMmYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1wYXRoX29wZW4UJ2FkYXB0LXdhc2lfc25hcHNob3RfcHJldmlldzEtcmFuZG9tX2dldBUoYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1lbnZpcm9uX2dldBYuYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1lbnZpcm9uX3NpemVzX2dldBclYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF9jbG9zZRgrYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF9wcmVzdGF0X2dldBkwYWRhcHQtd2FzaV9zbmFwc2hvdF9wcmV2aWV3MS1mZF9wcmVzdGF0X2Rpcl9uYW1lGiZhZGFwdC13YXNpX3NuYXBzaG90X3ByZXZpZXcxLXByb2NfZXhpdA');
  const module3 = base64Compile('AGFzbQEAAAABbA9gAX8AYAJ/fwBgBX9/f39/AGAIf39/f39/f38AYAJ+fwBgA39+fwBgBH9/f38AYAJ/fwF/YAR/f39/AX9gBX9/f35/AX9gBX9/f39/AX9gCX9/f39/fn5/fwF/YAF/AX9gA39/fwF/YAF/AAKoARwAATAAAAABMQAAAAEyAAEAATMAAQABNAABAAE1AAIAATYAAwABNwABAAE4AAQAATkAAAACMTAABQACMTEABQACMTIABgACMTMABgACMTQABwACMTUACAACMTYACQACMTcACAACMTgACgACMTkACwACMjAABwACMjEABwACMjIABwACMjMADAACMjQABwACMjUADQACMjYADgAIJGltcG9ydHMBcAEbGwkhAQBBAAsbAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaAC0JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBDXdpdC1jb21wb25lbnQFMC45LjAAHARuYW1lABUUd2l0LWNvbXBvbmVudDpmaXh1cHM');
  Promise.all([module0, module1, module2, module3]).catch(() => {});
  ({ exports: exports0 } = await instantiateCore(await module2));
  ({ exports: exports1 } = await instantiateCore(await module0, {
    wasi_snapshot_preview1: {
      environ_get: exports0['21'],
      environ_sizes_get: exports0['22'],
      fd_close: exports0['23'],
      fd_filestat_get: exports0['14'],
      fd_prestat_dir_name: exports0['25'],
      fd_prestat_get: exports0['24'],
      fd_read: exports0['15'],
      fd_readdir: exports0['16'],
      fd_write: exports0['17'],
      path_filestat_get: exports0['18'],
      path_open: exports0['19'],
      proc_exit: exports0['26'],
      random_get: exports0['20'],
    },
  }));
  ({ exports: exports2 } = await instantiateCore(await module1, {
    __main_module__: {
      cabi_realloc: exports1.cabi_realloc,
    },
    env: {
      memory: exports1.memory,
    },
    environment: {
      'get-environment': exports0['9'],
    },
    exit: {
      exit: lowering5,
    },
    filesystem: {
      'append-via-stream': lowering3,
      'drop-descriptor': lowering4,
      'drop-directory-entry-stream': lowering0,
      'get-type': exports0['2'],
      'open-at': exports0['6'],
      'read-directory': exports0['3'],
      'read-directory-entry': exports0['7'],
      'read-via-stream': lowering1,
      stat: exports0['4'],
      'stat-at': exports0['5'],
      'write-via-stream': lowering2,
    },
    preopens: {
      'get-directories': exports0['1'],
      'get-stdio': exports0['0'],
    },
    random: {
      'get-random-bytes': exports0['8'],
    },
    streams: {
      'blocking-read': exports0['11'],
      'blocking-write': exports0['13'],
      'drop-input-stream': lowering6,
      'drop-output-stream': lowering7,
      read: exports0['10'],
      write: exports0['12'],
    },
  }));
  memory0 = exports1.memory;
  realloc0 = exports2.cabi_import_realloc;
  ({ exports: exports3 } = await instantiateCore(await module3, {
    '': {
      $imports: exports0.$imports,
      '0': lowering8,
      '1': lowering9,
      '10': lowering18,
      '11': lowering19,
      '12': lowering20,
      '13': lowering21,
      '14': exports2.fd_filestat_get,
      '15': exports2.fd_read,
      '16': exports2.fd_readdir,
      '17': exports2.fd_write,
      '18': exports2.path_filestat_get,
      '19': exports2.path_open,
      '2': lowering10,
      '20': exports2.random_get,
      '21': exports2.environ_get,
      '22': exports2.environ_sizes_get,
      '23': exports2.fd_close,
      '24': exports2.fd_prestat_get,
      '25': exports2.fd_prestat_dir_name,
      '26': exports2.proc_exit,
      '3': lowering11,
      '4': lowering12,
      '5': lowering13,
      '6': lowering14,
      '7': lowering15,
      '8': lowering16,
      '9': lowering17,
    },
  }));
  realloc1 = exports1.cabi_realloc;
  postReturn0 = exports1['cabi_post_exports#splice-bindings'];
})();

await $init;
