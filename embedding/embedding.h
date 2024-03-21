#include "extension-api.h"
#include <js/BigInt.h>
#include <jsapi.h>
#include <cstdio>
// #include <assert.h>
#include <unistd.h>
#include <js/Array.h>

#define LOG(...)                               \
  if (Runtime.debug)                           \
  {                                            \
    fprintf(stderr, __VA_ARGS__);              \
    fprintf(stderr, "\n");                     \
    fflush(stdout);                            \
  }

// StarlingMonkey Wizer initialize function
// we intercept the Wizer function to add our own
// wrapper around this Wizer function
void __wizer_initialize();

namespace componentize::embedding
{
  enum class CoreVal : char
  {
    I32,
    I64,
    F32,
    F64
  };
  struct ComponentizeRuntime
  {
    enum class InitError
    {
      OK,
      FnList,
      TypeParse
    };

    enum class RuntimeError
    {
      OK,
      BigInt,
    };

    bool debug = false;
    bool first_call = true;

    JSContext *cx;

    InitError init_err = InitError::OK;
    RuntimeError runtime_err = RuntimeError::OK;

    // The name of the source being executed
    std::string source_name;

    // The user module being executed
    JS::PersistentRootedObject mod;
    // The internal generated bindings module being executed
    JS::PersistentRootedObject mod_bindings;

    api::Engine *engine;

    // The core abi "lowered" functions for the user code being executed
    struct CoreFn
    {
      // The compiled JS core function
      JS::PersistentRootedValue func;
      // The type of the function params
      // If using a retptr, the last param will be the retptr
      std::vector<CoreVal> args;
      // The type of the function return
      // Functions with more than one return value use a retptr
      std::optional<CoreVal> ret;
      // whether the function has a retptr
      bool retptr = false;
      // whether the function has a param ptr
      bool paramptr = false;
      // when using a retptr, the size of the ret area
      uint32_t retsize = false;

      CoreFn() : func(), args(), ret() {}
    };
    std::vector<CoreFn> fns;

    // the current export function call
    int cur_fn_idx = -1;
    std::vector<void *> free_list;

    void free_list_remove(void *ptr)
    {
      free_list.erase(std::remove(free_list.begin(), free_list.end(), ptr), free_list.end());
    }

    ComponentizeRuntime() : engine(nullptr),
                            fns(),
                            free_list() {}
  };

  // Runtime singleton
  ComponentizeRuntime Runtime = ComponentizeRuntime();

  void cabi_free(void *ptr);
  const char *core_ty_str(CoreVal ty);
  bool ReportAndClearException(JSContext *cx);

} // namespace componentize
