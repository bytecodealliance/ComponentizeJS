# WASM_OPT ?= $(shell rm node_modules/.bin/wasm-opt ; which wasm-opt)
JCO ?= ./node_modules/.bin/jco

ifndef JCO
	JCO = $(error No jco in PATH. Run npm install -g @bytecodealliance/jco)
endif

# ifndef WASM_OPT
#   WASM_OPT = $(error No Binaryen wasm-opt in PATH)
# endif

all: release
debug: lib/starlingmonkey_embedding.debug.wasm lib/spidermonkey-embedding-splicer.js
release: lib/starlingmonkey_embedding.wasm lib/spidermonkey-embedding-splicer.js

lib/spidermonkey-embedding-splicer.js: target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm crates/spidermonkey-embedding-splicer/wit/spidermonkey-embedding-splicer.wit | obj lib
	@$(JCO) new target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm -o obj/spidermonkey-embedding-splicer.wasm --wasi-reactor
	@$(JCO) transpile -q --name spidermonkey-embedding-splicer obj/spidermonkey-embedding-splicer.wasm -o lib -- -O1

target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm: Cargo.toml crates/spidermonkey-embedding-splicer/Cargo.toml crates/spidermonkey-embedding-splicer/src/*.rs
	cargo build --release --target wasm32-wasi

lib/starlingmonkey_embedding.wasm: StarlingMonkey/cmake/* embedding/* StarlingMonkey/runtime/* StarlingMonkey/builtins/* StarlingMonkey/builtins/**/* StarlingMonkey/include/* | lib
	cmake -B build-release -DCMAKE_BUILD_TYPE=Release
	make -j16 -C build-release
	@cp build-release/starling.wasm/starling.wasm $@

lib/starlingmonkey_embedding.debug.wasm: StarlingMonkey/cmake/* embedding/* StarlingMonkey/runtime/* StarlingMonkey/builtins/* StarlingMonkey/builtins/**/* StarlingMonkey/include/* | lib
	cmake -B build-debug -DCMAKE_BUILD_TYPE=RelWithDebInfo
	make -j16 -C build-debug
	@cp build-debug/starling.wasm/starling.wasm $@

obj:
	mkdir -p obj

lib:
	mkdir -p lib

obj/builtins:
	mkdir -p obj/builtins

clean:
	rm -r obj
	rm lib/spidermonkey-embedding-splicer.js
	rm lib/spidermonkey_embedding.wasm
