import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { componentize } from '@bytecodealliance/componentize-js';

const jsSource = await readFile('hello.js', 'utf8');

const { component } = await componentize(jsSource, {
  witPath: resolve('hello.wit'),
});

await writeFile('hello.component.wasm', component);
