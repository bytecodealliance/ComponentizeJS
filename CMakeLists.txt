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
include_directories("StarlingMonkey")

project(ComponentizeJS)

set(RAW_WASM ${CMAKE_CURRENT_BINARY_DIR}/starling-raw.wasm/starling-raw.wasm)

# Define output filenames based on build configuration
set(OUTPUT_NAME_RELEASE "starlingmonkey_embedding.wasm")
set(OUTPUT_NAME_DEBUG "starlingmonkey_embedding.debug.wasm")
set(OUTPUT_NAME_WEVAL "starlingmonkey_embedding_weval.wasm")

# Set the appropriate name based on current configuration
if(CMAKE_BUILD_TYPE STREQUAL "Debug" OR CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
    set(OUTPUT_FILENAME ${OUTPUT_NAME_DEBUG})
elseif(WEVAL)
    set(OUTPUT_FILENAME ${OUTPUT_NAME_WEVAL})
else()
    set(OUTPUT_FILENAME ${OUTPUT_NAME_RELEASE})
endif()

set(OUTPUT_FILENAME ${CMAKE_CURRENT_SOURCE_DIR}/lib/${OUTPUT_FILENAME})

add_custom_target(starlingmonkey_embedding
    DEPENDS starling-raw.wasm
    COMMAND ${CMAKE_COMMAND} -E copy
            ${CMAKE_CURRENT_BINARY_DIR}/starling-raw.wasm/starling-raw.wasm
            ${OUTPUT_FILENAME}
)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    add_custom_command(TARGET starlingmonkey_embedding POST_BUILD
        COMMAND ${WASM_TOOLS_BIN} strip ${OUTPUT_FILENAME} -d ".debug_(info|loc|ranges|abbrev|line|str)" -o ${OUTPUT_FILENAME}
        COMMENT "Stripping debug info from ${OUTPUT_FILENAME}"
        VERBATIM
    )
endif()
message(STATUS "Output file: ${OUTPUT_FILENAME}, wasm tools: ${WASM_TOOLS_BIN}")
