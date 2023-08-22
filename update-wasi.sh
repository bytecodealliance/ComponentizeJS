rm -r test/wit/deps
git clone https://github.com/bytecodealliance/wasmtime --depth 1
cd wasmtime
cp -r crates/wasi/wit/deps ../test/wit/
cd ..
rm -rf wasmtime
