cmake_minimum_required(VERSION 3.27)

include("StarlingMonkey/cmake/add_as_subproject.cmake")

add_builtin(componentize::embedding SRC embedding/embedding.cpp)

project(ComponentizeJS)
