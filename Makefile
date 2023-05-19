WASI_SDK ?= /opt/wasi-sdk
WASI_CXX ?= $(WASI_SDK)/bin/clang++
WASI_CC ?= $(WASI_SDK)/bin/clang
WASM_TOOLS ?= $(shell which wasm-tools)
WASM_OPT ?= $(shell which wasm-opt-manual)
JCO ?= ./node_modules/.bin/jco
WIT_BINDGEN := $(shell which wit-bindgen)

ifndef WIT_BINDGEN
	WIT_BINDGEN = $(error No wit-bindgen in PATH, consider doing cargo install --git https://github.com/bytecodealliance/wit-bindgen wit-bindgen-cli)
endif

ifndef JCO
	JCO = $(error No jco in PATH. Run npm install -g @bytecodealliance/jco)
endif

ifndef WASM_OPT
	WASM_OPT = $(error No Binaryen wasm-opt in PATH)
endif

ifndef WASM_TOOLS
	WASM_TOOLS = $(error No wasm-tools in PATH. First run "cargo install wasm-tools")
endif

SM_SRC := deps/js-compute-runtime/c-dependencies/spidermonkey/release
JSCR_SRC := deps/js-compute-runtime/c-dependencies/js-compute-runtime

CXX_FLAGS := -std=gnu++20 -Wall -Werror -Qunused-arguments
CXX_FLAGS += -fno-sized-deallocation -fno-aligned-new -mthread-model single
CXX_FLAGS += -fPIC -fno-rtti -fno-exceptions -fno-math-errno -pipe
CXX_FLAGS += -fno-omit-frame-pointer -funwind-tables -I$(SM_SRC/include)
CXX_FLAGS += --sysroot=$(WASI_SDK)/share/wasi-sysroot# -DDEBUG

CXX_OPT ?= -O2

CFLAGS := -Wall -Werror -Wno-unknown-attributes -Wno-pointer-to-int-cast -Wno-int-to-pointer-cast

LD_FLAGS := -Wl,-z,stack-size=1048576 -Wl,--stack-first -lwasi-emulated-getpid# -Wl,--export-table

DEFINES ?= 

INCLUDES := -I $(JSCR_SRC)

OBJS := $(patsubst spidermonkey_embedding/%.cpp,obj/%.o,$(wildcard spidermonkey_embedding/**/*.cpp)) $(patsubst spidermonkey_embedding/%.cpp,obj/%.o,$(wildcard spidermonkey_embedding/*.cpp))

all: lib/spidermonkey-embedding-splicer.js lib/spidermonkey_embedding.wasm test/wit/deps

lib/spidermonkey-embedding-splicer.js: target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm crates/spidermonkey-embedding-splicer/wit/spidermonkey-embedding-splicer.wit | obj
	$(JCO) new target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm -o obj/spidermonkey-embedding-splicer.wasm --adapt wasi_snapshot_preview1=node_modules/@bytecodealliance/jco/wasi_preview1_component_adapter.reactor.wasm
	$(JCO) transpile -q --name spidermonkey-embedding-splicer obj/spidermonkey-embedding-splicer.wasm -o lib -- -O1

target/wasm32-wasi/release/spidermonkey_embedding_splicer.wasm: crates/spidermonkey-embedding-splicer/Cargo.toml crates/spidermonkey-embedding-splicer/src/lib.rs
	cargo build --release --target wasm32-wasi

lib/spidermonkey_embedding.wasm: $(OBJS) | $(SM_SRC)
	-make --makefile=$(JSCR_SRC)/Makefile -I $(JSCR_SRC) $(abspath $(JSCR_SRC)/js-compute-runtime.wasm) $(abspath $(JSCR_SRC)/js-compute-runtime-component.wasm) -j16
	make --makefile=$(JSCR_SRC)/Makefile -I $(JSCR_SRC) shared-builtins -j16
	PATH="$(FSM_SRC)/scripts:$$PATH" $(WASI_CXX) $(CXX_FLAGS) $(CXX_OPT) $(DEFINES) $(LD_FLAGS) -o $@ $^ shared/*.a $(wildcard $(SM_SRC)/lib/*.a) $(wildcard $(SM_SRC)/lib/*.o)
	$(WASM_OPT) --strip-debug $@ -o $@ -O1

test/wit/deps: preview2-prototyping
	mkdir -p $@
	cp -r preview2-prototyping/wit/deps/* $@

obj/%.o: spidermonkey_embedding/%.cpp Makefile | $(SM_SRC) obj obj/builtins
	$(WASI_CXX) $(CXX_FLAGS) -O2 $(DEFINES) $(INCLUDES) -I $(SM_SRC)/include -MMD -MP -c -o $@ $<

obj:
	mkdir -p obj

lib:
	mkdir -p lib

$(SM_SRC):
	cd deps/js-compute-runtime/c-dependencies/spidermonkey && ./download-engine.sh

obj/builtins:
	mkdir -p obj/builtins

clean:
	rm -r obj
	rm lib/spidermonkey-embedding-splicer.js
	rm lib/spidermonkey_embedding.wasm
