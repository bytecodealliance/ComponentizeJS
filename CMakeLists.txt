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

set(EMBEDDING_DEP "starling-raw.wasm")

# Define output filenames based on build configuration
set(OUTPUT_NAME_RELEASE "starlingmonkey_embedding.wasm")
set(OUTPUT_NAME_DEBUG "starlingmonkey_embedding.debug.wasm")

# Set the appropriate name based on current configuration
if(CMAKE_BUILD_TYPE STREQUAL "Debug" OR CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
    set(OUTPUT_FILENAME ${OUTPUT_NAME_DEBUG})
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

if(CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo")
    add_custom_command(TARGET starlingmonkey_embedding POST_BUILD
        COMMAND ${WASM_TOOLS_BIN} strip ${OUTPUT_FILENAME} -d ".debug_(info|loc|ranges|abbrev|line|str)" -o ${OUTPUT_FILENAME}
        VERBATIM
    )
endif()
