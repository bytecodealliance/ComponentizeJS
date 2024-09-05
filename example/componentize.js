import { componentize } from '@bytecodealliance/componentize-js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const enableAot = process.env.ENABLE_AOT == '1'

const jsSource = await readFile('hello.js', 'utf8');

const { component } = await componentize(jsSource, {
  witPath: resolve('hello.wit'),
  enableAot
});

await writeFile('hello.component.wasm', component);
