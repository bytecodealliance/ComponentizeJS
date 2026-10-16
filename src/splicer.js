import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { WASIShim } from '@bytecodealliance/preview2-shim/instantiation';

import { instantiate } from '../lib/spidermonkey-embedding-splicer.js';

// Compiled modules can be shared, but instances must retain isolated preopens.
const coreModules = new Map();

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

  if (witPath != null) {
    const hostPath = await realpath(witPath);
    const isDirectory = (await stat(hostPath)).isDirectory();
    preopens['/wit'] = isDirectory ? hostPath : dirname(hostPath);
    guestWitPath = isDirectory ? '/wit' : `/wit/${basename(hostPath)}`;
  }

  const wasi = new WASIShim({ sandbox: { preopens } });
  const { splicer } = await instantiate(getCoreModule, wasi.getImportObject());
  return { splicer, witPath: guestWitPath };
}
