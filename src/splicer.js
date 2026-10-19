import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, toNamespacedPath } from 'node:path';
import { WASIShim } from '@bytecodealliance/preview2-shim/instantiation';

import { instantiate } from '../lib/spidermonkey-embedding-splicer.js';

// Warmed instances retain large Wasm heaps, so bound the cached filesystem scopes.
const MAX_CACHED_SPLICERS = 2;
const coreModules = new Map();
const splicerCache = new Map();

function getCoreModule(name) {
  if (!coreModules.has(name)) {
    coreModules.set(
      name,
      readFile(new URL(`../lib/${name}`, import.meta.url)).then(WebAssembly.compile),
    );
  }
  return coreModules.get(name);
}

export async function createSplicer(witPath) {
  const preopens = {};
  let guestWitPath;
  let scope;

  if (witPath != null) {
    const hostPath = await realpath(witPath);
    const isDirectory = (await stat(hostPath)).isDirectory();
    preopens['/wit'] = isDirectory ? hostPath : dirname(hostPath);
    scope = toNamespacedPath(preopens['/wit']);
    guestWitPath = isDirectory ? '/wit' : `/wit/${basename(hostPath)}`;
  }

  let splicerPromise = splicerCache.get(scope);
  if (splicerPromise) {
    splicerCache.delete(scope);
  } else {
    const wasi = new WASIShim({ sandbox: { preopens } });
    splicerPromise = instantiate(getCoreModule, wasi.getImportObject()).then(
      ({ splicer }) => splicer,
    );
  }

  splicerCache.set(scope, splicerPromise);
  if (splicerCache.size > MAX_CACHED_SPLICERS) {
    splicerCache.delete(splicerCache.keys().next().value);
  }

  try {
    return { splicer: await splicerPromise, witPath: guestWitPath };
  } catch (err) {
    if (splicerCache.get(scope) === splicerPromise) {
      splicerCache.delete(scope);
    }
    throw err;
  }
}
