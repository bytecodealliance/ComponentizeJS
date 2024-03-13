cmake_minimum_required(VERSION 3.27)

include("StarlingMonkey/cmake/add_as_subproject.cmake")

add_builtin(componentize::embedding SRC embedding/embedding.cpp)

project(ComponentizeJS)

# if (CMAKE_BUILD_TYPE STREQUAL "Release")
#   add_custom_command(
#           TARGET starling.wasm
#           POST_BUILD
#           COMMAND ${WASM_OPT} --strip-debug -O3 -o starling.wasm starling.wasm
#           WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
#   )
# else()
#   add_definitions(-DDEBUG_LOGGING)
# endif()
