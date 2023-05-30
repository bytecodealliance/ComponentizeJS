cd deps/js-compute-runtime/runtime/spidermonkey
./download-engine.sh release
cd ../js-compute-runtime
make -j16
make shared-builtins -j16
cd ../../../
