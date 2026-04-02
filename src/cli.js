#! /usr/bin/env node

import { program, Option } from 'commander';
import { componentize, DEFAULT_FEATURES } from './componentize.js';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function componentizeCmd(jsSource, opts) {
  const { component } = await componentize({
    sourcePath: jsSource,
    witPath: resolve(opts.wit),
    worldName: opts.worldName,
    runtimeArgs: opts.runtimeArgs,
    enableAot: opts.aot,
    engine: opts.engine,
    disableFeatures: opts.disable,
    preview2Adapter: opts.preview2Adapter,
    debugBindings: opts.debugBindings,
    debugBuild: opts.useDebugBuild,
    enableWizerLogging: opts.enableWizerLogging,
    wizerBin: opts.wizerBin,
    wevalBin: opts.wevalBin,
    aotCache: opts.aotCacheDir,
    aotMinStackSizeBytes: opts.aotMinStackSize,
  });
  await writeFile(opts.out, component);
}

program
  .version('0.19.4-rc.1')
  .description('Create a component from a JavaScript module')
  .usage('<js-source> --wit wit-world.wit -o <component-path>')
  .argument('<js-source>', 'JS source file to build')
  .requiredOption('-w, --wit <path>', 'WIT path to build with')
  .option('-n, --world-name <name>', 'WIT world to build')
  .option('--runtime-args <string>', 'arguments to pass to the runtime')
  .option('--aot', 'enable AOT compilation')
  .option(
    '--engine <path>',
    'provide a custom ComponentizeJS engine build path',
  )
  .addOption(
    new Option('-d, --disable <feature...>', 'disable WASI features').choices(
      DEFAULT_FEATURES,
    ),
  )
  .option(
    '--preview2-adapter <adapter>',
    'provide a custom preview2 adapter path',
  )
  .option('--use-debug-build', 'use a debug build of StarlingMonkey')
  .option('--debug-bindings', 'enable debug logging for bindings generation')
  .option(
    '--enable-wizer-logging',
    'enable debug logging for calls in the generated component',
  )
  .option(
    '--wizer-bin <path>',
    'specify a path to a local wizer binary',
  )
  .option(
    '--weval-bin <path>',
    'specify a path to a local weval binary',
  )
  .option(
    '--aot-cache-dir <path>',
    'specify a custom AOT weval cache path',
  )
  .option(
    '--aot-min-stack-size <bytes>',
    'set the minimum stack size (RUST_MIN_STACK) for weval AOT compilation',
  )
  .requiredOption('-o, --out <out>', 'output component file')
  .action(asyncAction(componentizeCmd));

program.showHelpAfterError();

program.parse();

function asyncAction(cmd) {
  return function () {
    const args = [...arguments];
    (async () => {
      await cmd.apply(null, args);
    })();
  };
}
