#!/bin/bash

# NOTE: COMPONENT_WASM_PATH will be picked up by the test binary as well
export COMPONENT_WASM_PATH=$(realpath guest)/hello.component.wasm
export TEST_BINARY_PATH=$(realpath host)/target/release/wasmtime-test

# Build the JS component if not present
echo -e "[info] expecting component WASM at [$COMPONENT_WASM_PATH]...";
if [ ! -f "$COMPONENT_WASM_PATH" ]; then
    cd guest && npm install && npm run build && cd ..
fi

# Build the Rust embedding test binary if not present
echo -e "[info] expecting test binary at [$TEST_BINARY_PATH]...";
if [ ! -f "$TEST_BINARY_PATH" ]; then
    cd host && cargo build --release && cd ..
fi

# Run the test binary, capturing the output
CMD_OUTPUT=$($TEST_BINARY_PATH)

# Ensure hte output contained what we expected
if ! echo $CMD_OUTPUT | grep -q 'Hello ComponentizeJS'; then
    echo "[error] test binary output (below) does not contain 'Hello ComponentizeJS':";
    echo "$CMD_OUTPUT";
    exit 1;
fi

echo "[success] test embedding binary produced expected output";
