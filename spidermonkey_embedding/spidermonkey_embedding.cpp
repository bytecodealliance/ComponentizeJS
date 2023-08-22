#include "spidermonkey_embedding.h"

// builtins
#include "builtins/shared/text-encoder.h"
#include "builtins/shared/text-decoder.h"
#include "builtins/shared/console.h"
#include "builtins/shared/url.h"

using builtins::Console;

// Logging

void builtin_impl_console_log(Console::LogType log_ty, const char *msg)
{
  FILE *stdio = (log_ty == Console::LogType::Error || log_ty == Console::LogType::Warn) ? stderr : stdout;
  fprintf(stdio, "%s\n", msg);
  fflush(stdio);
}

static bool DEBUG = false;

void log(const char *msg)
{
  if (DEBUG)
  {
    fprintf(stderr, "%s\n", msg);
  }
}

// Runtime State

enum class CoreVal : char
{
  I32,
  I64,
  F32,
  F64
};

struct Runtime
{
  enum class InitError
  {
    OK,
    JSInit,
    Intrinsics,
    CustomIntrinsics,
    SourceStdin,
    SourceCompile,
    BindingsCompile,
    ImportWrapperCompile,
    SourceLink,
    SourceExec,
    BindingsExec,
    FnList,
    MemBuffer,
    ReallocFn,
    MemBindings,
    PromiseRejections,
    ImportFn,
    TypeParse
  };

  enum class RuntimeError
  {
    OK,
    BigInt,
  };

  JSContext *cx;
  JSClass global_class = {"global", JSCLASS_GLOBAL_FLAGS, &JS::DefaultGlobalClassOps};
  InitError init_err = InitError::OK;
  RuntimeError runtime_err = RuntimeError::OK;
  JS::PersistentRootedObject global;
  JS::PersistentRootedObject unhandled_rejection_promises;

  // The name of the source being executed
  std::string source_name;

  // The user module being executed
  JS::PersistentRootedObject mod;
  // The internal generated bindings module being executed
  JS::PersistentRootedObject mod_bindings;
  // The import wrappers for the user code imports
  std::unordered_map<std::string, JS::PersistentRootedObject> import_wrappers;

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

  Runtime() : import_wrappers(),
              fns(),
              free_list() {}
};

// State singleton
Runtime R = Runtime();

// Exception Handling

const JSErrorFormatString *GetErrorMessage(void *userRef, unsigned errorNumber)
{
  if (errorNumber > 0 && errorNumber < JSBuiltinErrNum_Limit)
  {
    return &js_ErrorFormatStringBuiltin[errorNumber];
  }

  return nullptr;
}

// Note requires an AutoRealm
bool ReportAndClearException(JSContext *cx)
{
  JS::ExceptionStack stack(cx);
  if (!JS::StealPendingExceptionStack(cx, &stack))
  {
    log("(err) Uncatchable exception thrown");
    return false;
  }

  JS::ErrorReportBuilder report(cx);
  if (!report.init(cx, stack, JS::ErrorReportBuilder::WithSideEffects))
  {
    log("(err) Couldn't build error report");
    return false;
  }

  JS::PrintError(stderr, report, false);
  return true;
}

static void rejection_tracker(JSContext *cx, bool mutedErrors, JS::HandleObject promise,
                              JS::PromiseRejectionHandlingState state, void *data)
{
  JS::RootedValue promiseVal(cx, JS::ObjectValue(*promise));

  switch (state)
  {
  case JS::PromiseRejectionHandlingState::Unhandled:
  {
    if (!JS::SetAdd(cx, R.unhandled_rejection_promises, promiseVal))
    {
      log("(rejection_tracker) Adding an unhandled rejected promise to the promise rejection tracker failed");
    }
    return;
  }
  case JS::PromiseRejectionHandlingState::Handled:
  {
    bool deleted = false;
    if (!JS::SetDelete(cx, R.unhandled_rejection_promises, promiseVal, &deleted))
    {
      log("(rejection_tracker) Removing an handled rejected promise from the promise rejection tracker failed");
    }
  }
  }
}

// Import Splicing Functions
__attribute__((noinline, export_name("coreabi_from_bigint64"))) int64_t from_bigint64(JS::MutableHandleValue handle)
{
  JS::BigInt *arg0 = handle.toBigInt();
  uint64_t arg0_uint64;
  if (!JS::detail::BigIntIsUint64(arg0, &arg0_uint64))
  {
    log("(get_int64) Not a valid int64");
    abort();
  }
  return arg0_uint64;
}

__attribute__((noinline, export_name("coreabi_to_bigint64"))) JS::BigInt *to_bigint64(JSContext *cx, int64_t val)
{
  return JS::detail::BigIntFromUint64(cx, val);
}

/*
 * These 4 "sample" functions are deconstructed after compilation and fully
 * removed. The prime number separates the get from the set in this deconstruction.
 * The generated code is then used to build a template for constructing
 * the generic binding functions from it. By always keeping these samples around we
 * can ensure this approach is resiliant to some degree of compiled output changes,
 * or at least throw a vaguely useful error when that is no longer the case.
 */
__attribute__((export_name("coreabi_sample_i32"))) bool CoreAbiSampleI32(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  int32_t arg0 = static_cast<int32_t>(args[0].toInt32());
  args.rval().setInt32(arg0 * 32771);
  return true;
}

__attribute__((export_name("coreabi_sample_i64"))) bool CoreAbiSampleI64(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  int64_t arg1 = from_bigint64(args[1]);
  args.rval().setBigInt(to_bigint64(cx, arg1));
  return true;
}

__attribute__((export_name("coreabi_sample_f32"))) bool CoreAbiSampleF32(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  float arg2 = static_cast<float>(args[2].toDouble());
  args.rval().setDouble(arg2);
  return true;
}

__attribute__((export_name("coreabi_sample_f64"))) bool CoreAbiSampleF64(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  double arg3 = args[3].toDouble();
  args.rval().setDouble(arg3);
  return true;
}

__attribute__((optnone, export_name("coreabi_get_import")))
JSFunction *
coreabi_get_import(int32_t idx, int32_t argcnt, const char *name)
{
  return JS_NewFunction(R.cx, CoreAbiSampleI32, argcnt, 0, name);
}

// Binding Functions

__attribute__((export_name("cabi_realloc_adapter"))) void *cabi_realloc_adapter(void *ptr, size_t orig_size, size_t org_align, size_t new_size)
{
  return JS_realloc(R.cx, ptr, orig_size, new_size);
}

__attribute__((export_name("cabi_realloc"))) void *cabi_realloc(void *ptr, size_t orig_size, size_t org_align, size_t new_size)
{
  void *ret = JS_realloc(R.cx, ptr, orig_size, new_size);
  // track all allocations during a function "call" for freeing
  R.free_list.push_back(ret);
  if (!ret)
  {
    log("(cabi_realloc) Unable to realloc");
    abort();
  }
  if (DEBUG)
  {
    fprintf(stderr, "(cabi_realloc) [%d %zu %zu] %d\n", (uint32_t)ptr, orig_size, new_size, (uint32_t)ret);
  }
  return ret;
}

void cabi_free(void *ptr)
{
  if (DEBUG)
  {
    fprintf(stderr, "(cabi_free) %d\n", (uint32_t)ptr);
  }
  JS_free(R.cx, ptr);
}

void *LAST_SBRK;
JS::PersistentRootedObject AB;
static bool GetMemBuffer(JSContext *cx, unsigned argc, JS::Value *vp)
{
  if (sbrk(0) != LAST_SBRK)
  {
    LAST_SBRK = sbrk(0);
    AB = JS::RootedObject(R.cx, JS::NewArrayBufferWithUserOwnedContents(R.cx, (size_t)LAST_SBRK, (void *)0));
  }
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  args.rval().setObject(*AB);
  return true;
}

static bool ReallocFn(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  void *old_ptr = (void *)args[0].toInt32();
  size_t old_len = args[1].toInt32();
  size_t align = args[2].toInt32();
  size_t new_len = args[3].toInt32();
  void *ptr = cabi_realloc(old_ptr, old_len, align, new_len);
  args.rval().setInt32((uint32_t)ptr);
  return true;
}

#define FN_CNT_MAX 1024
#define FREE_LIST_MAX 1024

// Main (Wizer initialize)

int main() {}

extern "C" void __wasm_call_ctors();

static JSObject *EmbeddingResolveHook(JSContext *cx,
                                      JS::HandleValue modulePrivate,
                                      JS::HandleObject moduleRequest)
{
  // Extract module specifier string.
  JS::Rooted<JSString *> specifierString(
      cx, JS::GetModuleRequestSpecifier(cx, moduleRequest));
  if (!specifierString)
  {
    return nullptr;
  }

  JS::UniqueChars specChars = JS_EncodeStringToUTF8(cx, specifierString);
  if (!specChars)
  {
    return nullptr;
  }
  std::string filename(specChars.get());
  if (filename == R.source_name)
  {
    return R.mod;
  }
  else if (filename == "internal:bindings")
  {
    return R.mod_bindings;
  }
  else
  {
    if (R.import_wrappers.find(filename) == R.import_wrappers.end())
    {
      fprintf(stderr, "Import '%s' in %s is not defined as a world import. Only component-defined imports can be used.\n", filename.c_str(), R.source_name.c_str());
      R.init_err = Runtime::InitError::SourceLink;
      return nullptr;
    }
    return R.import_wrappers[filename];
  }
}

__attribute__((export_name("wizer.initialize"))) void init()
{
  uint32_t is_debug = atoi(getenv("DEBUG"));
  if (is_debug)
  {
    DEBUG = true;
  }
  log("(wizer) init");
  __wasm_call_ctors();
  if (!JS_Init())
  {
    R.init_err = Runtime::InitError::JSInit;
    return;
  }

  R.cx = JS_NewContext(JS::DefaultHeapMaxBytes);
  if (!R.cx)
  {
    R.init_err = Runtime::InitError::JSInit;
    return;
  }

  log("(wizer) init JS");
  if (!js::UseInternalJobQueues(R.cx) || !JS::InitSelfHostedCode(R.cx))
  {
    R.init_err = Runtime::InitError::JSInit;
    return;
  }
  JS::RealmOptions realm_options;
  realm_options.creationOptions()
      .setStreamsEnabled(true)
      .setWeakRefsEnabled(JS::WeakRefSpecifier::EnabledWithoutCleanupSome);

  JS::DisableIncrementalGC(R.cx);
  // JS_SetGCParameter(R.cx, JSGC_MAX_EMPTY_CHUNK_COUNT, 1);
  log("(wizer) init global");
  R.global = JS::PersistentRootedObject(R.cx, JS_NewGlobalObject(R.cx, &R.global_class, nullptr, JS::FireOnNewGlobalHook, realm_options));
  if (!R.global)
  {
    R.init_err = Runtime::InitError::Intrinsics;
    return;
  }

  log("(wizer) init standard classes");
  JSAutoRealm ar(R.cx, R.global);
  if (!JS::InitRealmStandardClasses(R.cx))
  {
    R.init_err = Runtime::InitError::Intrinsics;
    return;
  }

  log("(wizer) init builtins");
  if (!builtins::Console::create(R.cx, R.global))
  {
    R.init_err = Runtime::InitError::CustomIntrinsics;
    return;
  }
  if (!builtins::TextEncoder::init_class(R.cx, R.global))
  {
    R.init_err = Runtime::InitError::CustomIntrinsics;
    return;
  }
  if (!builtins::TextDecoder::init_class(R.cx, R.global))
  {
    R.init_err = Runtime::InitError::CustomIntrinsics;
    return;
  }
  if (!builtins::URL::init_class(R.cx, R.global))
  {
    R.init_err = Runtime::InitError::CustomIntrinsics;
    return;
  }

  JS::SetPromiseRejectionTrackerCallback(R.cx, rejection_tracker);

  R.unhandled_rejection_promises.init(R.cx, JS::NewSetObject(R.cx));
  if (!R.unhandled_rejection_promises)
  {
    R.init_err = Runtime::InitError::PromiseRejections;
    return;
  }

  // -- Extract sources from stdin --
  char env_name[100];

  log("(wizer) init env data");
  R.source_name = std::string(getenv("SOURCE_NAME"));

  uint32_t src_len = atoi(getenv("SOURCE_LEN"));

  char *code = (char *)malloc(src_len + 1);
  size_t read_len = 0, cur_len = 0;
  while ((cur_len = read(0, &code[read_len], src_len - read_len)))
    read_len += cur_len;
  if (read_len != src_len)
  {
    R.init_err = Runtime::InitError::SourceStdin;
    return;
  }
  code[src_len] = '\0';

  uint32_t bindings_len = atoi(getenv("BINDINGS_LEN"));
  char *bindings_code = (char *)malloc(bindings_len + 1);
  read_len = cur_len = 0;
  while ((cur_len = read(0, &bindings_code[read_len], bindings_len - read_len)))
    read_len += cur_len;
  if (read_len != bindings_len)
  {
    R.init_err = Runtime::InitError::SourceStdin;
    return;
  }
  bindings_code[bindings_len] = '\0';

  uint32_t import_wrapper_cnt = atoi(getenv("IMPORT_WRAPPER_CNT"));
  log("(wizer) load and compile dependency wrappers");
  for (size_t i = 0; i < import_wrapper_cnt; i++)
  {
    sprintf(&env_name[0], "IMPORT_WRAPPER%zu_NAME", i);
    char *import_wrapper_name = getenv(env_name);

    sprintf(&env_name[0], "IMPORT_WRAPPER%zu_LEN", i);
    uint32_t import_wrapper_len = atoi(getenv(env_name));
    char *import_wrapper_code = (char *)malloc(import_wrapper_len + 1);
    read_len = cur_len = 0;
    while ((cur_len = read(0, &import_wrapper_code[read_len], import_wrapper_len - read_len)))
      read_len += cur_len;
    if (read_len != import_wrapper_len)
    {
      R.init_err = Runtime::InitError::SourceStdin;
      return;
    }
    import_wrapper_code[import_wrapper_len] = '\0';

    {
      JS::CompileOptions compile_options(R.cx);
      compile_options.setFileAndLine(import_wrapper_name, 1);

      JS::SourceText<mozilla::Utf8Unit> moz_source;
      if (!moz_source.init(R.cx, import_wrapper_code, strlen(import_wrapper_code), JS::SourceOwnership::Borrowed))
      {
        R.init_err = Runtime::InitError::SourceCompile;
        return;
      }

      JSObject *mod_obj = JS::CompileModule(R.cx, compile_options, moz_source);
      if (!mod_obj)
      {
        R.init_err = Runtime::InitError::SourceCompile;
        return;
      }

      R.import_wrappers[import_wrapper_name] = JS::PersistentRootedObject(R.cx, mod_obj);
    }
  }

  // -- Perform module instantiation & execution --
  JS::SetModuleResolveHook(JS_GetRuntime(R.cx), EmbeddingResolveHook);
  log("(wizer) compile source module");
  {
    JS::CompileOptions compile_options(R.cx);
    compile_options.setFileAndLine(R.source_name.c_str(), 1);

    JS::SourceText<mozilla::Utf8Unit> moz_source;
    if (!moz_source.init(R.cx, code, strlen(code), JS::SourceOwnership::Borrowed))
    {
      R.init_err = Runtime::InitError::SourceCompile;
      return;
    }

    JSObject *mod_obj = JS::CompileModule(R.cx, compile_options, moz_source);
    if (!mod_obj)
    {
      R.init_err = Runtime::InitError::SourceCompile;
      return;
    }

    R.mod = JS::PersistentRootedObject(R.cx, mod_obj);
  }

  log("(wizer) compile bindings module");
  {
    JS::CompileOptions compile_options(R.cx);
    compile_options.setFileAndLine("internal:bindings", 1);

    JS::SourceText<mozilla::Utf8Unit> moz_source;
    if (!moz_source.init(R.cx, bindings_code, strlen(bindings_code), JS::SourceOwnership::Borrowed))
    {
      R.init_err = Runtime::InitError::BindingsCompile;
      return;
    }

    JSObject *mod_obj = JS::CompileModule(R.cx, compile_options, moz_source);
    if (!mod_obj)
    {
      R.init_err = Runtime::InitError::BindingsCompile;
      return;
    }

    R.mod_bindings = JS::PersistentRootedObject(R.cx, mod_obj);
  }

  log("(wizer) link");
  {
    if (!JS::ModuleLink(R.cx, R.mod_bindings))
    {
      R.init_err = Runtime::InitError::SourceLink;
      return;
    }
  }

  {
    JS::RootedValue rval(R.cx);

    // Execute the module bytecode.
    log("(wizer) execute the bindings module");
    if (!JS::ModuleEvaluate(R.cx, R.mod_bindings, &rval))
    {
      R.init_err = Runtime::InitError::BindingsExec;
      return;
    }

    JS::Rooted<JSObject *> eval_promise(R.cx);
    eval_promise.set(&rval.toObject());
    if (!JS::ThrowOnModuleEvaluationFailure(R.cx, eval_promise, JS::ModuleErrorBehaviour::ThrowModuleErrorsSync))
    {
      R.init_err = Runtime::InitError::BindingsExec;
      return;
    }

    // Execute the module bytecode.
    // TODO: configure whether to execute the top-level during wizering or not?
    log("(wizer) execute the source module");
    if (!JS::ModuleEvaluate(R.cx, R.mod, &rval))
    {
      R.init_err = Runtime::InitError::SourceExec;
      return;
    }

    eval_promise.set(&rval.toObject());
    if (!JS::ThrowOnModuleEvaluationFailure(R.cx, eval_promise, JS::ModuleErrorBehaviour::ThrowModuleErrorsSync))
    {
      R.init_err = Runtime::InitError::SourceExec;
      return;
    }

    // if (JS::GetPromiseState(eval_promise) == JS::PromiseState::Pending) {
    //   R.init_err = Runtime::InitError::SourceExec;
    //   return;
    // }
    // if (JS::GetPromiseState(eval_promise) == JS::PromiseState::Rejected) {
    //   R.init_err = Runtime::InitError::SourceExec;
    //   JS::Value result = JS::GetPromiseResult(eval_promise);

    //   return;
    // }
  }

  JS::RootedObject ns(R.cx, JS::GetModuleNamespace(R.cx, R.mod));
  JS::RootedObject ns_bindings(R.cx, JS::GetModuleNamespace(R.cx, R.mod_bindings));

  // -- Wire up the imports and exports and initialize the bindings --
  log("(wizer) retrieve and generate the export bindings");
  uint32_t export_cnt = atoi(getenv("EXPORT_CNT"));
  for (size_t i = 0; i < export_cnt; i++)
  {
    Runtime::CoreFn *fn = &R.fns.emplace_back();

    sprintf(&env_name[0], "EXPORT%zu_NAME", i);
    if (!JS_GetProperty(R.cx, ns_bindings, getenv(env_name), &fn->func))
    {
      R.init_err = Runtime::InitError::FnList;
      return;
    }

    // rudimentary data marshalling to parse the core ABI
    // export type from the env vars
    sprintf(&env_name[0], "EXPORT%zu_ARGS", i);
    char *arg_tys = getenv(env_name);
    int j = 0;
    char ch;
    if (arg_tys[0] == '*')
    {
      fn->paramptr = true;
      j++;
    }
    while (true)
    {
      ch = arg_tys[j];
      if (ch == '\0')
        break;
      if (strncmp(&arg_tys[j], "i32", 3) == 0)
      {
        fn->args.push_back(CoreVal::I32);
        j += 3;
      }
      else if (strncmp(&arg_tys[j], "i64", 3) == 0)
      {
        fn->args.push_back(CoreVal::I64);
        j += 3;
      }
      else if (strncmp(&arg_tys[j], "f32", 3) == 0)
      {
        fn->args.push_back(CoreVal::F32);
        j += 3;
      }
      else if (strncmp(&arg_tys[j], "f64", 3) == 0)
      {
        fn->args.push_back(CoreVal::F64);
        j += 3;
      }
      else
      {
        R.init_err = Runtime::InitError::TypeParse;
        return;
      }
      if (arg_tys[j] == ',')
      {
        j++;
      }
    }

    sprintf(&env_name[0], "EXPORT%zu_RET", i);
    arg_tys = getenv(env_name);
    j = 0;
    if (arg_tys[0] != '\0')
    {
      if (arg_tys[0] == '*')
      {
        fn->retptr = true;
        j++;
      }
      if (strncmp(&arg_tys[j], "i32", 3) == 0)
      {
        fn->ret.emplace(CoreVal::I32);
      }
      else if (strncmp(&arg_tys[j], "i64", 3) == 0)
      {
        fn->ret.emplace(CoreVal::I64);
      }
      else if (strncmp(&arg_tys[j], "f32", 3) == 0)
      {
        fn->ret.emplace(CoreVal::F32);
      }
      else if (strncmp(&arg_tys[j], "f64", 3) == 0)
      {
        fn->ret.emplace(CoreVal::F64);
      }
      else
      {
        R.init_err = Runtime::InitError::TypeParse;
        return;
      }
    }

    sprintf(&env_name[0], "EXPORT%zu_RETSIZE", i);
    fn->retsize = atoi(getenv(env_name));
  }

  uint32_t import_cnt = atoi(getenv("IMPORT_CNT"));

  JS::RootedVector<JS::Value> args(R.cx);
  if (!args.resize(2 + import_cnt))
  {
    R.init_err = Runtime::InitError::FnList;
    return;
  }

  log("(wizer) create the memory buffer JS object");
  JS::RootedObject mem(R.cx, JS_NewPlainObject(R.cx));
  if (!JS_DefineProperty(R.cx, mem, "buffer", GetMemBuffer,
                         nullptr, JSPROP_ENUMERATE))
  {
    R.init_err = Runtime::InitError::MemBuffer;
    return;
  }

  args[0].setObject(*mem);

  log("(wizer) create the realloc JS function");
  JSFunction *realloc_fn = JS_NewFunction(R.cx, ReallocFn, 0, 0, "realloc");
  if (!realloc_fn)
  {
    R.init_err = Runtime::InitError::ReallocFn;
    return;
  }
  args[1].setObject(*JS_GetFunctionObject(realloc_fn));

  log("(wizer) create the import JS functions");
  for (size_t i = 0; i < import_cnt; i++)
  {
    sprintf(&env_name[0], "IMPORT%zu_NAME", i);
    const char* name = getenv(env_name);
    sprintf(&env_name[0], "IMPORT%zu_ARGCNT", i);
    uint32_t argcnt = atoi(getenv(env_name));

    JSFunction *import_fn = coreabi_get_import(i, argcnt, name);
    if (!import_fn)
    {
      R.init_err = Runtime::InitError::ImportFn;
      return;
    }
    args[2 + i].setObject(*JS_GetFunctionObject(import_fn));
  }

  log("(wizer) call the binding initialization function");
  JS::RootedValue r(R.cx);
  JS::RootedValue set_mem_realloc(R.cx);
  JS_GetProperty(R.cx, ns_bindings, "$initBindings", &set_mem_realloc);
  if (!JS_CallFunctionValue(R.cx, nullptr, set_mem_realloc, args, &r))
  {
    R.init_err = Runtime::InitError::MemBindings;
    return;
  }

  log("(wizer) run jobs");
  js::RunJobs(R.cx);
  log("(wizer) gc");
  JS_MaybeGC(R.cx);

  if (JS_IsExceptionPending(R.cx))
  {
    R.init_err = Runtime::InitError::SourceExec;
    return;
  }
  log("(wizer) complete");
}

#define COMPONENT_RUNTIME_COREVAL_I32 0
#define COMPONENT_RUNTIME_COREVAL_I64 1
#define COMPONENT_RUNTIME_COREVAL_F32 2
#define COMPONENT_RUNTIME_COREVAL_F64 3

typedef struct
{
  uint8_t tag;
  union
  {
    uint32_t i32;
    uint64_t i64;
    float f32;
    double f64;
  } val;
} coreval;

__attribute__((export_name("check_init")))
Runtime::InitError
check_init()
{
  JSAutoRealm ar(R.cx, R.global);
  JS::RootedValue exc(R.cx);
  if (JS_GetPendingException(R.cx, &exc))
  {
    ReportAndClearException(R.cx);
  }
  return R.init_err;
}

__attribute__((export_name("call"))) uint32_t call(uint32_t fn_idx, void *argptr)
{
  Runtime::CoreFn *fn = &R.fns[fn_idx];
  R.cur_fn_idx = fn_idx;
  if (DEBUG)
  {
    fprintf(stderr, "(call) Function [%d] - ", fn_idx);
    fprintf(stderr, "(");
    if (fn->paramptr)
    {
      fprintf(stderr, "*");
    }
    bool first = true;
    for (int i = 0; i < fn->args.size(); i++)
    {
      if (first)
      {
        first = false;
      }
      else
      {
        fprintf(stderr, ", ");
      }
      switch (fn->args[i])
      {
      case CoreVal::I32:
        fprintf(stderr, "i32");
        break;
      case CoreVal::I64:
        fprintf(stderr, "i64");
        break;
      case CoreVal::F32:
        fprintf(stderr, "f32");
        break;
      case CoreVal::F64:
        fprintf(stderr, "f64");
        break;
      }
    }
    fprintf(stderr, ")");
    if (fn->ret.has_value())
    {
      fprintf(stderr, " -> ");
      if (fn->retptr)
      {
        fprintf(stderr, "*");
      }
      switch (fn->ret.value())
      {
      case CoreVal::I32:
        fprintf(stderr, "i32");
        break;
      case CoreVal::I64:
        fprintf(stderr, "i64");
        break;
      case CoreVal::F32:
        fprintf(stderr, "f32");
        break;
      case CoreVal::F64:
        fprintf(stderr, "f64");
        break;
      }
    }
    fprintf(stderr, "\n");
  }

  JSAutoRealm ar(R.cx, R.global);

  js::ResetMathRandomSeed(R.cx);

  // TODO: fixup post-calls for non post-calling functions
  if ((R.cur_fn_idx != -1 || R.free_list.size() != 0) && false)
  {
    log("(call) unexpected call state, was post_call previously called?");
    abort();
  }
  R.cur_fn_idx = fn_idx;

  JS::RootedVector<JS::Value> args(R.cx);
  if (!args.resize(fn->args.size() + (fn->retptr ? 1 : 0)))
  {
    log("(call) unable to allocate memory for array resize");
    abort();
  }

  log("(call) setting args");
  int argcnt = 0;
  if (fn->paramptr)
  {
    args[0].setInt32((uint32_t)argptr);
    argcnt = 1;
  }
  else if (fn->args.size() > 0)
  {
    uint32_t *curptr = static_cast<uint32_t *>(argptr);
    argcnt = fn->args.size();
    for (int i = 0; i < argcnt; i++)
    {
      switch (fn->args[i])
      {
      case CoreVal::I32:
        args[i].setInt32(*curptr);
        curptr += 1;
        break;
      case CoreVal::I64:
        args[i].setBigInt(JS::detail::BigIntFromUint64(R.cx, *(uint64_t *)(curptr)));
        curptr += 2;
        break;
      case CoreVal::F32:
        args[i].setNumber(*((float *)curptr));
        curptr += 1;
        break;
      case CoreVal::F64:
        args[i].setNumber(*((double *)curptr));
        curptr += 2;
        break;
      }
    }
  }

  void *retptr = nullptr;
  if (fn->retptr)
  {
    if (DEBUG)
    {
      fprintf(stderr, "(call) setting retptr at arg %d\n", argcnt);
    }
    retptr = JS_realloc(R.cx, 0, 0, fn->retsize);
    args[argcnt].setInt32((uint32_t)retptr);
  }

  log("(call) JS lowering call");
  JS::RootedValue r(R.cx);
  if (!JS_CallFunctionValue(R.cx, nullptr, fn->func, args, &r))
  {
    log("(call) runtime JS Error");
    ReportAndClearException(R.cx);
    abort();
  }

  // Handle singular returns
  if (!fn->retptr && fn->ret.has_value())
  {
    log("(call) singular return");
    retptr = cabi_realloc(0, 0, 4, fn->retsize);
    switch (fn->ret.value())
    {
    case CoreVal::I32:
      *((uint32_t *)retptr) = r.toInt32();
      break;
    case CoreVal::I64:
      if (!JS::detail::BigIntIsUint64(r.toBigInt(), (uint64_t *)retptr))
      {
        abort();
      }
      break;
    case CoreVal::F32:
      *((float *)retptr) = static_cast<float>(r.toDouble());
      break;
    case CoreVal::F64:
      *((double *)retptr) = r.toDouble();
      break;
    }
  }

  log("(call) end");

  // we always return a retptr (even if null)
  // the wrapper will drop it if not needed
  return (uint32_t)retptr;
}

__attribute__((export_name("post_call"))) void post_call(uint32_t fn_idx)
{
  if (DEBUG)
  {
    fprintf(stderr, "(post_call) Function [%d]\n", fn_idx);
  }
  // TODO: remove after jco upgrade
  // if (R.cur_fn_idx != fn_idx)
  // {
  //   log("(post_call) Unexpected call state, was call definitely called last?");
  //   abort();
  // }
  R.cur_fn_idx = -1;
  for (void *ptr : R.free_list)
  {
    log("(free list)");
    cabi_free(ptr);
  }
  R.free_list.clear();
  log("(post_call) jobs");
  js::RunJobs(R.cx);
  log("(post_call) maybe gc");
  JS_MaybeGC(R.cx);
  log("(post_call) end");
}
