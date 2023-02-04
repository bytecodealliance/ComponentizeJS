import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';

// import { setLevel } from './wasi/logging.js';
// setLevel('debug');

const cases = await readdir(new URL('./cases', import.meta.url));

suite('Bindings', async () => {
  for (const name of cases) {
    if (name === 'use-across-interfaces' || name === 'rename-interface') {
      test.skip(name, () => {});
      continue;
    }
    test(name, async () => {
      const source = await readFile(new URL(`./cases/${name}/source.js`, import.meta.url), 'utf8');
      const world = await readFile(new URL(`./cases/${name}/world.wit`, import.meta.url), 'utf8');

      const test = await import(`./cases/${name}/test.js`);

      try {
        const { component, imports } = await componentize(source, world, {
          debug: false,
          sourceName: `${name}.js`,
        });

        const map = { 'wasi-*': '../../wasi/*.js' };
        for (const [impt] of imports) {
          map[impt] = `../../cases/${name}/${impt}.js`;
        }

        const { files } = await transpile(component, { name, map });

        await mkdir(new URL(`./output/${name}/imports`, import.meta.url), { recursive: true });
        await mkdir(new URL(`./output/${name}/exports`, import.meta.url), { recursive: true });

        for (const file of Object.keys(files)) {
          await writeFile(new URL(`./output/${name}/${file}`, import.meta.url), files[file]);
        }

        var instance = await import(`./output/${name}/${name}.js`);
      } catch (e) {
        if (test.err) {
          test.err(e);
          return;
        }
        throw e;
      }
      await test.test(instance);
    });
  }
});
