import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// import { setLevel } from './wasi/logging.js';
// setLevel('debug');

const builtinsCases = await readdir(new URL('./builtins', import.meta.url));
suite('Builtins', () => {
  for (const filename of builtinsCases) {
    const name = filename.slice(0, -3);
    test(name, async () => {
      const { source, test: runTest } = await import(`./builtins/${filename}`);

      const { component } = await componentize(source, `
        default world runworld {
          export run: func() -> ()
        }
      `, {
        debug: false,
        sourceName: `${name}.js`,
      });
    
      const { files } = await transpile(component, { name, wasiShim: true });
    
      await mkdir(new URL(`./output/${name}/imports`, import.meta.url), { recursive: true });
      await mkdir(new URL(`./output/${name}/exports`, import.meta.url), { recursive: true });
    
      await writeFile(new URL(`./output/${name}.component.wasm`, import.meta.url), component);
    
      for (const file of Object.keys(files)) {
        await writeFile(new URL(`./output/${name}/${file}`, import.meta.url), files[file]);
      }
  
      await writeFile(new URL(`./output/${name}/run.js`, import.meta.url), `
        import { run } from './${name}.js';
        run();
      `);
  
      await runTest(async function run () {
        let stdout = '', stderr = '';
        await new Promise((resolve, reject) => {
          const cp = spawn(process.argv[0], [fileURLToPath(new URL(`./output/${name}/run.js`, import.meta.url))], { stdio: 'pipe' });
          cp.stdout.on('data', chunk => {
            stdout += chunk;
          });
          cp.stderr.on('data', chunk => {
            stderr += chunk;
          });
          cp.on('error', reject);
          cp.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr || stdout)));
        });
      
        return { stdout, stderr };
      });
    });
  }
});

const bindingsCases = await readdir(new URL('./cases', import.meta.url));
suite('Bindings', () => {
  for (const name of bindingsCases) {
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

        const map = {};
        for (const [impt] of imports) {
          map[impt] = `../../cases/${name}/${impt}.js`;
        }

        const { files } = await transpile(component, { name, map, wasiShim: true });

        await mkdir(new URL(`./output/${name}/imports`, import.meta.url), { recursive: true });
        await mkdir(new URL(`./output/${name}/exports`, import.meta.url), { recursive: true });

        await writeFile(new URL(`./output/${name}.component.wasm`, import.meta.url), component);

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
