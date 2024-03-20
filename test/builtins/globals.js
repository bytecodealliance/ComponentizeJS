import { strictEqual } from 'node:assert';

export const source = `
  export function run () {
    console.log(Reflect.ownKeys(globalThis));
  }
  export function ready () {
    return true;
  }
`;

export async function test(run) {
  const { stdout, stderr } = await run();
  strictEqual(
    stdout,
    `["undefined", "Function", "Object", "eval", "globalThis", "Array", "Boolean", "JSON", "Date", "Math", "isNaN", "isFinite", "parseInt", "parseFloat", "NaN", "Infinity", "Number", "escape", "unescape", "decodeURI", "encodeURI", "decodeURIComponent", "encodeURIComponent", "String", "RegExp", "Error", "InternalError", "AggregateError", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError", "ArrayBuffer", "Int8Array", "Uint8Array", "Int16Array", "Uint16Array", "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "Uint8ClampedArray", "BigInt64Array", "BigUint64Array", "BigInt", "Proxy", "WeakMap", "Map", "Set", "DataView", "Symbol", "Reflect", "WeakSet", "Promise", "FinalizationRegistry", "WeakRef", "ReadableStream", "ReadableStreamBYOBReader", "ReadableStreamBYOBRequest", "ReadableStreamDefaultReader", "ReadableStreamDefaultController", "ReadableByteStreamController", "WritableStream", "ByteLengthQueuingStrategy", "CountQueuingStrategy", "self", "URL", "URLSearchParams", "atob", "btoa", "console", "DOMException", "Performance", "queueMicrotask", "structuredClone", "setInterval", "setTimeout", "clearInterval", "clearTimeout", "WorkerLocation", "location", "TextEncoder", "TextDecoder", "TransformStream", "CompressionStream", "DecompressionStream", "fetch", "Request", "Response", "Headers", "addEventListener", "SubtleCrypto", "Crypto", "crypto", "CryptoKey"]\n`
  );
  strictEqual(stderr, '');
}
