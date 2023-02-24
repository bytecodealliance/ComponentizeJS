cd js-compute-runtime/c-dependencies/spidermonkey
./download-engine.sh release
cd ../js-compute-runtime
make shared-builtins.a -j16
cd ../../
