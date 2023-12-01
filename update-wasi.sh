rm -r test/wit/deps
mkdir wasmtime
cd wasmtime
git init
git remote add origin https://github.com/bytecodealliance/wasmtime
git fetch --depth 1 origin "${1:-main}"
git checkout "${1:-main}"
cp -r crates/wasi/wit/deps ../test/wit/
# note the WASI version for reference
cat .git/HEAD | head -c 16 > ../wasi-version
cd ..
# rm -rf wasmtime
echo "\nWASI Updated to $(cat wasi-version)"
