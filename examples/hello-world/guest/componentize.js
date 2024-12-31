import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { componentize } from '@bytecodealliance/componentize-js';

// AoT compilation makes use of weval (https://github.com/bytecodealliance/weval)
const enableAot = process.env.ENABLE_AOT == '1';

const jsSource = await readFile('hello.js', 'utf8');

const { component } = await componentize(jsSource, {
  witPath: resolve('hello.wit'),
  enableAot
});

await writeFile('hello.component.wasm', component);
