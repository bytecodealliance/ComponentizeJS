import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { readFile, readdir, mkdir, writeFile, mkdtemp } from 'node:fs/promises';

import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';

import { suite, test, assert } from 'vitest';

import {
  DEBUG_TRACING_ENABLED,
  WEVAL_TEST_ENABLED,
  DEBUG_TEST_ENABLED,
} from './util.js';

suite('WASI', () => {
  test('basic app (old API)', async () => {
    const { instance } = await setupComponent({
      componentize: {
        src: `
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
        opts: {
          witPath: fileURLToPath(new URL('./wit', import.meta.url)),
          worldName: 'test1',
          enableAot: WEVAL_TEST_ENABLED,
          debugBuild: DEBUG_TEST_ENABLED,
        },
      },
      transpile: {
        opts: {
          tracing: DEBUG_TRACING_ENABLED,
        },
      },
    });

    instance.run.run();

    const result = instance.getResult();

    assert.strictEqual(
      result.slice(0, 10),
      `NOW: ${String(Date.now()).slice(0, 5)}`,
    );
    assert.strictEqual(result.split(',').length, 3);
  });

    test('basic app (OriginalSourceFile API)', async () => {
    const { instance } = await setupComponent({
      componentize: {
        opts: {
          sourcePath: './test/api/index.js',
          witPath: fileURLToPath(new URL('./wit', import.meta.url)),
          worldName: 'test1',
          enableAot: WEVAL_TEST_ENABLED,
          debugBuild: DEBUG_TEST_ENABLED,
        },
      },
      transpile: {
        opts: {
          tracing: DEBUG_TRACING_ENABLED,
        },
      },
    });

    instance.run.run();

    const result = instance.getResult();

    assert.strictEqual(
      result.slice(0, 10),
      `NOW: ${String(Date.now()).slice(0, 5)}`,
    );
    assert.strictEqual(result.split(',').length, 3);
  });
});

async function setupComponent(opts) {
  const componentizeSrc = opts?.componentize?.src;
  const componentizeOpts = opts?.componentize?.opts;
  const transpileOpts = opts?.transpile?.opts;

  let component;
  if (componentizeSrc) {
    const srcBuild = await componentize(componentizeSrc, componentizeOpts);
    component = srcBuild.component;
  } else if (!componentizeSrc && componentizeOpts) {
    const optsBuild = await componentize(componentizeOpts);
    component = optsBuild.component;
  } else {
    throw new Error('no componentize options or src provided');
  }

  const outputDir = join('./out', 'wasi-test');
  await mkdir(outputDir, { recursive: true });

  await writeFile(join(outputDir, 'wasi.component.wasm'), component);

  const { files } = await transpile(component, transpileOpts);

  const wasiDir = join(outputDir, 'wasi');
  const interfacesDir = join(wasiDir, 'interfaces');
  await mkdir(interfacesDir, { recursive: true });

  for (const file of Object.keys(files)) {
    await writeFile(join(wasiDir, file), files[file]);
  }

  const componentJsPath = join(wasiDir, 'component.js');
  var instance = await import(componentJsPath);

  return {
    instance,
    outputDir,
  };
}
