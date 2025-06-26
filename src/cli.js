#! /usr/bin/env node

import { program, Option } from 'commander';
import { componentize } from "./componentize.js";
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function componentizeCmd (jsSource, opts) {
  const { component } = await componentize( {
    sourcePath: jsSource,
    witPath: resolve(opts.wit),
    worldName: opts.worldName,
    runtimeArgs: opts.runtimeArgs,
    enableAot: opts.aot,
    disableFeatures: opts.disable,
    preview2Adapter: opts.preview2Adapter,
    debugBindings: opts.debugBindings,
    debugBuild: opts.useDebugBuild,
    enableWizerLogging: opts.enableWizerLogging,
  });
  await writeFile(opts.out, component);
}

program
  .version('0.18.2')
  .description('Create a component from a JavaScript module')
  .usage('<js-source> --wit wit-world.wit -o <component-path>')
  .argument('<js-source>', 'JS source file to build')
  .requiredOption('-w, --wit <path>', 'WIT path to build with')
  .option('-n, --world-name <name>', 'WIT world to build')
  .option('--runtime-args <string>', 'arguments to pass to the runtime')
  .option('--aot', 'enable AOT compilation')
  .addOption(new Option('-d, --disable <feature...>', 'disable WASI features').choices(['stdio', 'random', 'clocks', 'http']))
  .option('--preview2-adapter <adapter>', 'provide a custom preview2 adapter path')
  .option('--use-debug-build', 'use a debug build of StarlingMonkey')
  .option('--debug-bindings', 'enable debug logging for bindings generation')
  .option('--enable-wizer-logging', 'enable debug logging for calls in the generated component')
  .requiredOption('-o, --out <out>', 'output component file')
  .action(asyncAction(componentizeCmd));


program.showHelpAfterError();

program.parse();

function asyncAction (cmd) {
  return function () {
    const args = [...arguments];
    (async () => {
      await cmd.apply(null, args);
    })();
  };
}
