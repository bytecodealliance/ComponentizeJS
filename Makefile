WASI_SDK ?= /opt/wasi-sdk
WASI_CXX ?= $(WASI_SDK)/bin/clang++
WASI_CC ?= $(WASI_SDK)/bin/clang
WASM_TOOLS ?= $(shell which wasm-tools)
WASM_OPT ?= ../binaryen/bin/wasm-opt
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

SM_SRC := deps/spidermonkey-wasi-embedding/release

CXX_FLAGS := -std=gnu++20 -Wall -Werror -Qunused-arguments
CXX_FLAGS += -fno-sized-deallocation -fno-aligned-new -mthread-model single
CXX_FLAGS += -fPIC -fno-rtti -fno-exceptions -fno-math-errno -pipe
CXX_FLAGS += -fno-omit-frame-pointer -funwind-tables -I$(SM_SRC/include)
CXX_FLAGS += --sysroot=$(WASI_SDK)/share/wasi-sysroot# -DDEBUG

CXX_OPT ?= -O2

CFLAGS := -Wall -Werror -Wno-unknown-attributes -Wno-pointer-to-int-cast -Wno-int-to-pointer-cast

LD_FLAGS := -Wl,-z,stack-size=1048576 -Wl,--stack-first -lwasi-emulated-getpid# -Wl,--export-table

DEFINES ?=

# This is required when using spidermonkey headers, as it allows us to enable
# the streams library when setting up the js context.
DEFINES += -DMOZ_JS_STREAMS

OBJS := $(patsubst spidermonkey_embedding/%.cpp,obj/%.o,$(wildcard spidermonkey_embedding/**/*.cpp)) $(patsubst spidermonkey_embedding/%.cpp,obj/%.o,$(wildcard spidermonkey_embedding/*.cpp))

all: dist/spidermonkey-embedding-splicer.js dist/spidermonkey_embedding.wasm

dist/spidermonkey-embedding-splicer.js: target/wasm32-unknown-unknown/debug/spidermonkey_embedding_splicer.wasm crates/spidermonkey-embedding-splicer/wit/spidermonkey-embedding-splicer.wit | obj
	$(JCO) new target/wasm32-unknown-unknown/debug/spidermonkey_embedding_splicer.wasm -o obj/spidermonkey-embedding-splicer.wasm
	$(JCO) transpile -q --name spidermonkey-embedding-splicer obj/spidermonkey-embedding-splicer.wasm -o dist --map console=../console.js

target/wasm32-unknown-unknown/debug/spidermonkey_embedding_splicer.wasm: crates/spidermonkey-embedding-splicer/Cargo.toml crates/spidermonkey-embedding-splicer/src/lib.rs
	cargo build

dist/spidermonkey_embedding.wasm: $(OBJS) | $(SM_SRC) dist
	PATH="$(FSM_SRC)/scripts:$$PATH" $(WASI_CXX) $(CXX_FLAGS) $(CXX_OPT) $(DEFINES) $(LD_FLAGS) -o $@ $^ $(SM_SRC)/lib/*.o $(SM_SRC)/lib/*.a

obj/%.o: spidermonkey_embedding/%.cpp Makefile | $(SM_SRC) obj obj/builtins
	$(WASI_CXX) $(CXX_FLAGS) -O2 $(DEFINES) -I $(SM_SRC)/include -MMD -MP -c -o $@ $<

dist:
	mkdir -p dist

obj:
	mkdir -p obj

obj/builtins:
	mkdir -p obj/builtins

$(SM_SRC):
	cd deps/spidermonkey-wasi-embedding && ./download-engine.sh

deps/wasi_snapshot_preview1.wasm:
	curl -L https://github.com/bytecodealliance/preview2-prototyping/releases/download/latest/wasi_snapshot_preview1.wasm -o $@

clean:
	rm -r obj && rm component-runtime.wasm
