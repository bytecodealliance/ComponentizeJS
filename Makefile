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
release-weval: lib/starlingmonkey_ics.wevalcache lib/spidermonkey-embedding-splicer.js

lib/spidermonkey-embedding-splicer.js: target/wasm32-wasip1/release/spidermonkey_embedding_splicer.wasm crates/spidermonkey-embedding-splicer/wit/spidermonkey-embedding-splicer.wit | obj lib
	@$(JCO) new target/wasm32-wasip1/release/spidermonkey_embedding_splicer.wasm -o obj/spidermonkey-embedding-splicer.wasm --wasi-reactor
	@$(JCO) transpile -q --name spidermonkey-embedding-splicer obj/spidermonkey-embedding-splicer.wasm -o lib -- -O1

target/wasm32-wasip1/release/spidermonkey_embedding_splicer.wasm: Cargo.toml crates/spidermonkey-embedding-splicer/Cargo.toml crates/spidermonkey-embedding-splicer/src/*.rs
	cargo build --release --target wasm32-wasip1

lib/starlingmonkey_embedding.wasm: StarlingMonkey/cmake/* embedding/* StarlingMonkey/runtime/* StarlingMonkey/builtins/* StarlingMonkey/builtins/*/* StarlingMonkey/builtins/*/*/* StarlingMonkey/include/* | lib
	cmake -B build-release -DCMAKE_BUILD_TYPE=Release
	make -j16 -C build-release
	@cp build-release/starling-raw.wasm/starling-raw.wasm $@

lib/starlingmonkey_embedding_weval.wasm: StarlingMonkey/cmake/* embedding/* StarlingMonkey/runtime/* StarlingMonkey/builtins/* StarlingMonkey/builtins/*/* StarlingMonkey/builtins/*/*/* StarlingMonkey/include/* | lib
	cmake -B build-release-weval -DCMAKE_BUILD_TYPE=Release -DUSE_WASM_OPT=OFF -DWEVAL=ON
	make -j16 -C build-release-weval
	@cp build-release-weval/starling-raw.wasm/starling-raw.wasm $@

lib/starlingmonkey_ics.wevalcache: lib/starlingmonkey_embedding_weval.wasm
	@cp build-release-weval/starling-raw.wasm/starling-ics.wevalcache $@

lib/starlingmonkey_embedding.debug.wasm: StarlingMonkey/cmake/* embedding/* StarlingMonkey/runtime/* StarlingMonkey/builtins/* StarlingMonkey/builtins/*/* StarlingMonkey/builtins/*/*/* StarlingMonkey/include/* | lib
	cmake -B build-debug -DCMAKE_BUILD_TYPE=RelWithDebInfo
	make -j16 -C build-debug
	wasm-tools strip build-debug/starling-raw.wasm/starling-raw.wasm -d ".debug_(info|loc|ranges|abbrev|line|str)" -o $@

obj:
	mkdir -p obj

lib:
	mkdir -p lib

obj/builtins:
	mkdir -p obj/builtins

clean:
	rm -r obj
	rm lib/spidermonkey-embedding-splicer.js
	rm lib/starlingmonkey_embedding.wasm
