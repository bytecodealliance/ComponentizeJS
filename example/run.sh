#!/bin/bash
set -ex

node build.mjs
cargo run --release
