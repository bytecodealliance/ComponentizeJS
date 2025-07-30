import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';

import { suite, test, assert } from 'vitest';

const DEBUG_TRACING = false;
const LOG_DEBUGGING = false;

const enableAot = process.env.WEVAL_TEST == '1';
const debugBuild = process.env.DEBUG_TEST == '1';

function maybeLogging(disableFeatures) {
  if (!LOG_DEBUGGING) return disableFeatures;
  if (disableFeatures && disableFeatures.includes('stdio')) {
    disableFeatures.splice(disableFeatures.indexOf('stdio'), 1);
  }
  return disableFeatures;
}

const builtinsCases = await readdir(new URL('./builtins', import.meta.url));
suite('Builtins', () => {
  for (const filename of builtinsCases) {
    const name = filename.slice(0, -3);
    test(name, async () => {
      const {
        source,
        test: runTest,
        disableFeatures,
        enableFeatures,
      } = await import(`./builtins/${name}.js`);

      const { component } = await componentize(
        source,
        `
        package local:runworld;
        world runworld {
          export run: func();
        }
      `,
        {
          sourceName: `${name}.js`,
          // also test the debug build while we are about it (unless testing Weval)
          debugBuild,
          enableFeatures,
          disableFeatures: maybeLogging(disableFeatures),
          enableAot,
        },
      );

      const { files } = await transpile(component, {
        name,
        wasiShim: true,
        tracing: DEBUG_TRACING,
      });

      await mkdir(new URL(`./output/${name}/interfaces`, import.meta.url), {
        recursive: true,
      });

      await writeFile(
        new URL(`./output/${name}.component.wasm`, import.meta.url),
        component,
      );

      for (const file of Object.keys(files)) {
        await writeFile(
          new URL(`./output/${name}/${file}`, import.meta.url),
          files[file],
        );
      }

      await writeFile(
        new URL(`./output/${name}/run.js`, import.meta.url),
        `
        import { run } from './${name}.js';
        run();
      `,
      );

      try {
        await runTest(async function run() {
          let stdout = '',
            stderr = '',
            timeout;
          try {
            await new Promise((resolve, reject) => {
              const cp = spawn(
                process.argv[0],
                [
                  fileURLToPath(
                    new URL(`./output/${name}/run.js`, import.meta.url),
                  ),
                ],
                { stdio: 'pipe' },
              );
              cp.stdout.on('data', (chunk) => {
                stdout += chunk;
              });
              cp.stderr.on('data', (chunk) => {
                stderr += chunk;
              });
              cp.on('error', reject);
              cp.on('exit', (code) =>
                code === 0 ? resolve() : reject(new Error(stderr || stdout)),
              );
              timeout = setTimeout(() => {
                reject(
                  new Error(
                    'test timed out with output:\n' +
                      stdout +
                      '\n\nstderr:\n' +
                      stderr,
                  ),
                );
              }, 10_000);
            });
          } catch (err) {
            throw { err, stdout, stderr };
          } finally {
            clearTimeout(timeout);
          }

          return { stdout, stderr };
        });
      } catch (err) {
        if (err.stderr) console.error(err.stderr);
        throw err.err || err;
      }
    });
  }
});

const bindingsCases = await readdir(new URL('./cases', import.meta.url));
suite('Bindings', () => {
  for (const name of bindingsCases) {
    test(name, async () => {
      const source = await readFile(
        new URL(`./cases/${name}/source.js`, import.meta.url),
        'utf8',
      );

      const test = await import(`./cases/${name}/test.js`);

      // Determine the relevant WIT world to use
      let witWorld,
        witPath,
        worldName,
        isWasiTarget = false;
      if (test.worldName) {
        witPath = fileURLToPath(new URL('./wit', import.meta.url));
        worldName = test.worldName;
        isWasiTarget = true;
      } else {
        try {
          witWorld = await readFile(
            new URL(`./cases/${name}/world.wit`, import.meta.url),
            'utf8',
          );
        } catch (e) {
          if (e?.code == 'ENOENT') {
            try {
              isWasiTarget = true;
              witPath = fileURLToPath(
                new URL(`./cases/${name}/wit`, import.meta.url),
              );
              await readdir(witPath);
            } catch (e) {
              if (e?.code === 'ENOENT') {
                witPath = fileURLToPath(new URL('./wit', import.meta.url));
                worldName = 'test2';
              } else {
                throw e;
              }
            }
          } else {
            throw e;
          }
        }
      }

      const enableFeatures = test.enableFeatures || ['http'];
      const disableFeatures =
        test.disableFeatures ||
        (isWasiTarget ? [] : ['random', 'clocks', 'http', 'stdio']);

      let testArg;
      try {
        const { component, imports } = await componentize(source, {
          sourceName: `${name}.js`,
          witWorld,
          witPath,
          worldName,
          enableFeatures,
          disableFeatures: maybeLogging(disableFeatures),
          enableAot,
          debugBuild,
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
          'wasi:sockets/*': '@bytecodealliance/preview2-shim/sockets#*',
        };
        for (let [impt] of imports) {
          if (impt.startsWith('wasi:')) continue;
          if (impt.startsWith('[')) impt = impt.slice(impt.indexOf(']') + 1);
          let importName = impt.split('/').pop();
          if (importName === 'test') importName = 'imports';
          map[impt] = `../../cases/${name}/${importName}.js`;
        }

        const {
          files,
          imports: componentImports,
          exports: componentExports,
        } = await transpile(component, {
          name,
          map,
          wasiShim: true,
          validLiftingOptimization: false,
          tracing: DEBUG_TRACING,
        });

        testArg = { imports, componentImports, componentExports };

        await mkdir(new URL(`./output/${name}/interfaces`, import.meta.url), {
          recursive: true,
        });

        await writeFile(
          new URL(`./output/${name}.component.wasm`, import.meta.url),
          component,
        );

        for (const file of Object.keys(files)) {
          let source = files[file];
          await writeFile(
            new URL(`./output/${name}/${file}`, import.meta.url),
            source,
          );
        }

        const instancePath = fileURLToPath(
          new URL(`./output/${name}/${name}.js`, import.meta.url),
        );
        var instance = await import(instancePath);
      } catch (e) {
        if (test.err) {
          test.err(e);
          return;
        }
        throw e;
      }
      await test.test(instance, testArg);
    });
  }
});

suite('WASI', () => {
  test('basic app (old API)', async () => {
    const { component } = await componentize(
      `
      import { now } from 'wasi:clocks/wall-clock@0.2.3';
      import { getRandomBytes } from 'wasi:random/random@0.2.3';

      let result;
      export const run = {
        run () {
          result = \`NOW: \${now().seconds}, RANDOM: \${getRandomBytes(2n)}\`;
          return { tag: 'ok' };
        }
      };

      export const getResult = () => result;
    `,
      {
        witPath: fileURLToPath(new URL('./wit', import.meta.url)),
        worldName: 'test1',
        enableAot,
        debugBuild,
      },
    );

    await writeFile(
      new URL(`./output/wasi.component.wasm`, import.meta.url),
      component,
    );

    const { files } = await transpile(component, { tracing: DEBUG_TRACING });

    await mkdir(new URL(`./output/wasi/interfaces`, import.meta.url), {
      recursive: true,
    });

    for (const file of Object.keys(files)) {
      await writeFile(
        new URL(`./output/wasi/${file}`, import.meta.url),
        files[file],
      );
    }

    var instance = await import(`./output/wasi/component.js`);
    instance.run.run();
    const result = instance.getResult();
    assert.strictEqual(
      result.slice(0, 10),
      `NOW: ${String(Date.now()).slice(0, 5)}`,
    );
    assert.strictEqual(result.split(',').length, 3);
  });

  test('basic app (OriginalSourceFile API)', async () => {
    const { component } = await componentize({
      sourcePath: './test/api/index.js',
      witPath: fileURLToPath(new URL('./wit', import.meta.url)),
      worldName: 'test1',
      enableAot,
      debugBuild,
    });

    await writeFile(
      new URL(`./output/wasi.component.wasm`, import.meta.url),
      component,
    );

    const { files } = await transpile(component, { tracing: DEBUG_TRACING });

    await mkdir(new URL(`./output/wasi/interfaces`, import.meta.url), {
      recursive: true,
    });

    for (const file of Object.keys(files)) {
      await writeFile(
        new URL(`./output/wasi/${file}`, import.meta.url),
        files[file],
      );
    }

    var instance = await import(`./output/wasi/component.js`);
    instance.run.run();
    const result = instance.getResult();
    assert.strictEqual(
      result.slice(0, 10),
      `NOW: ${String(Date.now()).slice(0, 5)}`,
    );
    assert.strictEqual(result.split(',').length, 3);
  });
});
