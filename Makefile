WASM_OPT ?= $(shell rm node_modules/.bin/wasm-opt ; which wasm-opt)
JCO ?= ./node_modules/.bin/jco

ifndef JCO
	JCO = $(error No jco in PATH. Run npm install -g @bytecodealliance/jco)
endif

ifndef WASM_OPT
	WASM_OPT = $(error No Binaryen wasm-opt in PATH)
endif

all: lib/spidermonkey-embedding-splicer.js lib/starlingmonkey_embedding.debug.wasm

lib/spidermonkey-embedding-splicer.js: target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm crates/spidermonkey-embedding-splicer/wit/spidermonkey-embedding-splicer.wit | obj
	$(JCO) new target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm -o obj/spidermonkey-embedding-splicer.wasm --wasi-reactor
	$(JCO) transpile -q --name spidermonkey-embedding-splicer obj/spidermonkey-embedding-splicer.wasm -o lib -- -O1

target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm: crates/spidermonkey-embedding-splicer/Cargo.toml crates/spidermonkey-embedding-splicer/src/*.rs
	cargo build --release --target wasm32-wasi

lib/starlingmonkey_embedding.debug.wasm: $(wildcard embedding/*) $(wildcard StarlingMonkey/runtime/*) $(wildcard StarlingMonkey/builtins/*) $(wildcard StarlingMonkey/builtins/**/*) $(wildcard StarlingMonkey/include/*)
	cmake -B build -DCMAKE_BUILD_TYPE=Release
	make -j16 -C build
	@cp build/starling.wasm/starling.wasm $@

lib/starlingmonkey_embedding.wasm: lib/starlingmonkey_embedding.debug.wasm
	$(WASM_OPT) --strip-debug lib/starlingmonkey_embedding.debug.wasm -o $@ -O3

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
