# ComponentizeJS Example

### Creating the Component

Given a world that descibes a component interface:

hello.wit
```
package local:hello
world hello {
  export hello: func(name: string) -> string
}
```

Write a JS file that adheres to the same interface:

hello.js
```js
export function hello (name) {
  return `Hello ${name}`;
}
```

The component can then be built with the `componentize` API:

componentize.mjs
```js
import { componentize } from '@bytecodealliance/componentize-js';
import { readFile, writeFile } from 'node:fs/promises';

const jsSource = await readFile('hello.js', 'utf8');
const witSource = await readFile('hello.wit', 'utf8');

const { component } = await componentize(jsSource, witSource);

await writeFile('hello.component.wasm', component);
```

Run this with Node to build `hello.component.wasm`:

```
node componentize.mjs
```

### Running the Component in Wasmtime

Set up the [Cargo.toml as in the example directory](example/Cargo.toml).

Set up [`src/main.rs`](example/src/main.rs) as in the example directory.

Building and running the binary should print the result:

```
cargo build --release
./target/release/wasmtime-test
> Hello ComponentizeJS
```

### Running the Component in Node.js

To run the component in Node.js, we need to first transpile the component with `jco`:

```
npm install -g @bytecodealliance/jco
```

Transpile the component:

```
jco transpile hello.component.wasm -o hello --map 'wasi-*=@bytecodealliance/preview2-shim/*'
```

Set up a Node.js package.json:

package.json
```
{
  "type": "module"
}
```

The custom WASI mapping argument allows us to direct the WASI component imports to the experimental JS WASI shim.

We can install this shim itself from npm as well:

```
npm install @bytecodealliance/preview2-shim
```

Create package.json in the *hello* folder

```npm init
```

Append the below line to the package.json file that was just created.

```
"type": "module",
```

This is added to ensure all .js and .mjs files are interpreted as ES modules. 

In the absence of this, you may receive the following error SyntaxError: Cannot use import statement outside a module

To test the component:

```
node -e "import('./hello/hello.component.js').then(m => console.log(m.hello('ComponentizeJS')))"
> Hello ComponentizeJS
```
