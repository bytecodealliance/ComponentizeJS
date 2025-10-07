import { join } from 'node:path';
import { env } from 'node:process';
import { readFile, readdir, mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';

import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';

export const DEBUG_TRACING_ENABLED = isEnabledEnvVar(env.DEBUG_TRACING);
export const LOG_DEBUGGING_ENABLED = isEnabledEnvVar(env.LOG_DEBUGGING);
export const DEBUG_TEST_ENABLED = isEnabledEnvVar(env.DEBUG_TEST);

function isEnabledEnvVar(v) {
  return (
    typeof v === 'string' && ['1', 'yes', 'true'].includes(v.toLowerCase())
  );
}

export function maybeLogging(disableFeatures) {
  if (!LOG_DEBUGGING_ENABLED) return disableFeatures;
  if (disableFeatures && disableFeatures.includes('stdio')) {
    disableFeatures.splice(disableFeatures.indexOf('stdio'), 1);
  }
  return disableFeatures;
}

export async function setupComponent(opts) {
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

  const outputDir = join('./test/output', 'wasi-test');
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
