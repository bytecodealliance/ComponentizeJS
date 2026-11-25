cmake_minimum_required(VERSION 3.27)

if (DEFINED ENV{STARLINGMONKEY_SRC})
    set(STARLINGMONKEY_SRC $ENV{STARLINGMONKEY_SRC})
    if (EXISTS ${STARLINGMONKEY_SRC})
        cmake_path(ABSOLUTE_PATH STARLINGMONKEY_SRC)
    endif()
    if (NOT EXISTS ${STARLINGMONKEY_SRC})
        message(FATAL_ERROR "StarlingMonkey source not found at `$ENV{STARLINGMONKEY_SRC}`.")
    endif()
else()
    set(STARLINGMONKEY_SRC ${CMAKE_CURRENT_SOURCE_DIR}/StarlingMonkey)
endif()

include("${STARLINGMONKEY_SRC}/cmake/add_as_subproject.cmake")

add_builtin(componentize::embedding SRC embedding/embedding.cpp)
include_directories("${STARLINGMONKEY_SRC}")

project(ComponentizeJS)

set(RAW_WASM ${CMAKE_CURRENT_BINARY_DIR}/starling-raw.wasm/starling-raw.wasm)

set(EMBEDDING_DEP "starling-raw.wasm")

# Define output filenames based on build configuration
set(OUTPUT_NAME_RELEASE "starlingmonkey_embedding.wasm")
set(OUTPUT_NAME_DEBUG "starlingmonkey_embedding.debug.wasm")
set(OUTPUT_NAME_WEVAL "starlingmonkey_embedding_weval.wasm")
set(OUTPUT_NAME_NIGHTMONKEY "starlingmonkey_embedding_nightmonkey.wasm")

# Set the appropriate name based on current configuration
if(CMAKE_BUILD_TYPE STREQUAL "Debug" OR CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
    set(OUTPUT_FILENAME ${OUTPUT_NAME_DEBUG})
elseif(WEVAL)
    set(OUTPUT_FILENAME ${OUTPUT_NAME_WEVAL})
    set(EMBEDDING_DEP "starling-ics.wevalcache")
elseif(NIGHTMONKEY)
    set(OUTPUT_FILENAME ${OUTPUT_NAME_NIGHTMONKEY})
else()
    set(OUTPUT_FILENAME ${OUTPUT_NAME_RELEASE})
endif()

set(OUTPUT_FILENAME ${CMAKE_CURRENT_SOURCE_DIR}/lib/${OUTPUT_FILENAME})

add_custom_target(starlingmonkey_embedding
    DEPENDS ${EMBEDDING_DEP}
    COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_BINARY_DIR}/starling-raw.wasm/starling-raw.wasm
            ${OUTPUT_FILENAME}
)

# The NightMonkey compiler is a native binary that must match the engine
# exactly. The package ships one per supported host (built by CI from the
# NightMonkey revision StarlingMonkey pins) in lib/nightmonkey/, named as in
# NIGHTMONKEY_HOST_ASSETS in src/componentize.js; a local build puts the one
# it built there for the host.
if(NIGHTMONKEY)
    set(NIGHTMONKEY_HOST_ASSET "")
    if(CMAKE_HOST_SYSTEM_NAME STREQUAL "Linux" AND CMAKE_HOST_SYSTEM_PROCESSOR MATCHES "^(x86_64|AMD64)$")
        set(NIGHTMONKEY_HOST_ASSET "nightmonkey-x86_64-linux")
    elseif(CMAKE_HOST_SYSTEM_NAME STREQUAL "Linux" AND CMAKE_HOST_SYSTEM_PROCESSOR MATCHES "^(aarch64|arm64)$")
        set(NIGHTMONKEY_HOST_ASSET "nightmonkey-aarch64-linux")
    elseif(CMAKE_HOST_SYSTEM_NAME STREQUAL "Darwin" AND CMAKE_HOST_SYSTEM_PROCESSOR STREQUAL "arm64")
        set(NIGHTMONKEY_HOST_ASSET "nightmonkey-aarch64-macos")
    elseif(CMAKE_HOST_SYSTEM_NAME STREQUAL "Windows" AND CMAKE_HOST_SYSTEM_PROCESSOR MATCHES "^(x86_64|AMD64)$")
        set(NIGHTMONKEY_HOST_ASSET "nightmonkey-x86_64-windows.exe")
    endif()
    if(NIGHTMONKEY_HOST_ASSET)
        add_dependencies(starlingmonkey_embedding nightmonkey_compiler)
        add_custom_command(TARGET starlingmonkey_embedding POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy
                    ${NIGHTMONKEY_BIN}
                    ${CMAKE_CURRENT_SOURCE_DIR}/lib/nightmonkey/${NIGHTMONKEY_HOST_ASSET}
            VERBATIM
        )
    endif()
endif()

if(CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
    add_custom_command(TARGET starlingmonkey_embedding POST_BUILD
        COMMAND ${WASM_TOOLS_BIN} strip ${OUTPUT_FILENAME} -d ".debug_(info|loc|ranges|abbrev|line|str)" -o ${OUTPUT_FILENAME}
        VERBATIM
    )
endif()
