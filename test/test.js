import { componentize } from '../src/componentize.js';
import { writeFile } from 'node:fs/promises';
import { transpile } from 'js-component-tools';
import { mkdir } from 'node:fs/promises';
import { strictEqual } from 'node:assert';

const source = `
export function hello() {
  return 'world (' + imports['get-num'].getNum('world') + ')';
}
`;

const exportedWorld = `
/// # WASI Logging API
///
/// WASI Logging is a logging API intended to let users emit log messages with
/// simple priority levels and context values.
interface wasi-logging {
  /// A log level, describing a kind of message.
  enum level {
     /// Describes messages about the values of variables and the flow of control
     /// within a program.
     trace,

     /// Describes messages likely to be of interest to someone debugging a program.
     debug,

     /// Describes messages likely to be of interest to someone monitoring a program.
     info,

     /// Describes messages indicating hazardous situations.
     warn,

     /// Describes messages indicating serious errors.
     error,
  }

  /// Emit a log message.
  ///
  /// A log message has a \`level\` describing what kind of message is being sent,
  /// a context, which is an uninterpreted string meant to help consumers group
  /// similar messages, and a string containing the message text.
  log: func(level: level, context: string, message: string)
}

interface get-num {
  get-num: func(text: string) -> u32
}

world hello-world {
  import wasi-logging2: wasi-logging
  import get-num: get-num

  default export interface {
    hello: func() -> string
  }
}
`;

const component = await componentize(source, exportedWorld);

const { files } = await transpile(component, {
  name: 'hello',
  map: {
    'get-num': '../fixtures/get-num.js ',
    'wasi-filesystem': '../../wasi/filesystem.js',
    'wasi-default-clocks': '../../wasi/default-clocks.js',
    'wasi-stderr': '../../wasi/std-err.js ',
    'wasi-exit': '../../wasi/exit.js ',
    'wasi-logging': '../../wasi/logging.js ',
    'wasi-logging2': '../../wasi/logging.js ',
    'wasi-poll': '../../wasi/poll.js ',
    'wasi-clocks': '../../wasi/clocks.js ',
    'wasi-random': '../../wasi/random.js',
  },
});

await mkdir(new URL(',/output/imports', import.meta.url), { recursive: true });

for (const name of Object.keys(files)) {
  await writeFile(new URL(`./output/${name}`, import.meta.url), files[name]);
}

const { hello } = await import('./output/hello.js');
strictEqual(hello(), 'world (5)');

console.log('Tests Successful');
