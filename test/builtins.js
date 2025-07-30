import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';

import { suite, test, assert } from 'vitest';

import {
  DEBUG_TRACING_ENABLED,
  WEVAL_TEST_ENABLED,
  DEBUG_TEST_ENABLED,
  maybeLogging,
} from './util.js';

suite('Builtins', async () => {
  const builtins = await readdir(new URL('./builtins', import.meta.url));

  for (const filename of builtins) {
    const name = filename.slice(0, -3);
    test.concurrent(name, async () => {
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
          debugBuild: DEBUG_TEST_ENABLED,
          enableFeatures,
          disableFeatures: maybeLogging(disableFeatures),
          enableAot: WEVAL_TEST_ENABLED,
        },
      );

      const { files } = await transpile(component, {
        name,
        wasiShim: true,
        tracing: DEBUG_TRACING_ENABLED,
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
