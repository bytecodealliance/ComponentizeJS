import { fileURLToPath, URL } from 'node:url';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';

import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';

import { suite, test } from 'vitest';

import {
  DEBUG_TRACING_ENABLED,
  DEBUG_TEST_ENABLED,
  maybeLogging,
} from './util.js';

suite('Bindings', async () => {
  const bindingsCases = await readdir(new URL('./cases', import.meta.url));

  for (const name of bindingsCases) {
    test.concurrent(name, async () => {
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
          debugBuild: DEBUG_TEST_ENABLED,
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
          tracing: DEBUG_TRACING_ENABLED,
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

        const outputPath = fileURLToPath(
          new URL(`./output/${name}/${name}.js`, import.meta.url),
        );
        var instance = await import(outputPath);
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
