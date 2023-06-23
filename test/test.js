import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { strictEqual } from 'node:assert';

// import { setLevel } from './wasi/logging.js';
// setLevel('debug');

const builtinsCases = await readdir(new URL('./builtins', import.meta.url));
suite('Builtins', () => {
  for (const filename of builtinsCases) {
    const name = filename.slice(0, -3);
    test(name, async () => {
      const { source, test: runTest } = await import(`./builtins/${filename}`);

      const { component } = await componentize(source, `
        package local:runworld
        world runworld {
          export run: func() -> ()
        }
      `, {
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
    // if (name === 'use-across-interfaces' || name === 'rename-interface') {
    //   test.skip(name, () => {});
    //   continue;
    // }
    test(name, async () => {
      const source = await readFile(new URL(`./cases/${name}/source.js`, import.meta.url), 'utf8');
      const world = await readFile(new URL(`./cases/${name}/world.wit`, import.meta.url), 'utf8');

      const test = await import(`./cases/${name}/test.js`);

      try {
        const { component, imports } = await componentize(source, world, {
          sourceName: `${name}.js`,
        });

        const map = {
          'wasi:cli-base/*': '@bytecodealliance/preview2-shim/cli-base#*',
          'wasi:clocks/*': '@bytecodealliance/preview2-shim/clocks#*',
          'wasi:filesystem/*': '@bytecodealliance/preview2-shim/filesystem#*',
          'wasi:http/*': '@bytecodealliance/preview2-shim/http#*',
          'wasi:io/*': '@bytecodealliance/preview2-shim/io#*',
          'wasi:logging/*': '@bytecodealliance/preview2-shim/logging#*',
          'wasi:poll/*': '@bytecodealliance/preview2-shim/poll#*',
          'wasi:random/*': '@bytecodealliance/preview2-shim/random#*',
          'wasi:sockets/*': '@bytecodealliance/preview2-shim/sockets#*'
        };
        for (const [impt] of imports) {
          let importName = impt.split('/').pop();
          if (importName === 'test') importName = 'imports';
          map[impt] = `../../cases/${name}/${importName}.js`;
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

suite('WASI', () => {
  test('basic app', async () => {
    const { component } = await componentize(`
      import { now } from 'wasi:clocks/wall-clock';
      import { getRandomBytes } from 'wasi:random/random';

      export function test () {
        return \`NOW: \${now().seconds}, RANDOM: \${getRandomBytes(2n)}\`;
      }
    `, {
      witPath: fileURLToPath(new URL('./wit', import.meta.url)),
      worldName: 'test1'
    });

    const { files } = await transpile(component);
    await mkdir(new URL(`./output/wasi/imports`, import.meta.url), { recursive: true });
    await mkdir(new URL(`./output/wasi/exports`, import.meta.url), { recursive: true });
    for (const file of Object.keys(files)) {
      await writeFile(new URL(`./output/wasi/${file}`, import.meta.url), files[file]);
    }

    var instance = await import(`./output/wasi/component.js`);
    const result = instance.test();
    strictEqual(result.slice(0, 10), `NOW: ${String(Date.now()).slice(0, 5)}`);
    strictEqual(result.split(',').length, 3);
  });
});
