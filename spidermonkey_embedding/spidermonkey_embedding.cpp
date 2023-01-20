#include <cstdio>
#include <assert.h>
#include <unistd.h>

// TODO: remove these once the warnings are fixed
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Winvalid-offsetof"
#pragma clang diagnostic ignored "-Wdeprecated-enum-enum-conversion"
#include <jsapi.h>
#include <js/Array.h>
#include <js/Initialization.h>
#include <js/Exception.h>
#include <js/SourceText.h>
#include <jsfriendapi.h>
#include <js/Conversions.h>
#include <js/Modules.h>
#include <js/ArrayBuffer.h>
#include <js/BigInt.h>
#include <js/Promise.h>
#pragma clang diagnostic pop

#include "builtins/text_encoder.h"
#include "builtins/text_decoder.h"

#define FN_CNT_MAX 1024
#define FREE_LIST_MAX 1024

// init errors
#define INIT_OK 0
#define INIT_JSINIT 1
#define INIT_INTRINSICS 2
#define INIT_CUSTOM_INTRINSICS 3
#define INIT_SOURCE_STDIN 4
#define INIT_SOURCE_COMPILE 5
#define INIT_SOURCE_LINK 6
#define INIT_SOURCE_EXEC 7
#define INIT_FN_LIST 8
#define INIT_MEM_BUFFER 9
#define INIT_REALLOC_FN 10
#define INIT_MEM_BINDINGS 11
#define INIT_PROMISE_REJECTIONS 12
#define INIT_IMPORT_FN 12

// runtime errors
#define RUNTIME_OK 0
#define RUNTIME_BIGINT 1

uint8_t INIT_ERROR = INIT_OK;
uint8_t RUNTIME_ERROR = RUNTIME_OK;
JSContext *CX;
JS::PersistentRootedObject GLOBAL;
JS::PersistentRootedObject unhandledRejectedPromises;
JS::PersistentRootedObject MOD;
JS::PersistentRootedValue FN[FN_CNT_MAX];

static JSClass global_class = {"global", JSCLASS_GLOBAL_FLAGS, &JS::DefaultGlobalClassOps};

// Logging

__attribute__((import_module("wasi-logging2"), import_name("log"))) void __wasm_import_wasi_logging_log(int32_t, int32_t, int32_t, int32_t, int32_t);

void log_trace(const char *context, const char *msg)
{
  __wasm_import_wasi_logging_log(0, (int32_t)context, strlen(context), (int32_t)msg, strlen(msg));
}

void log_debug(const char *context, const char *msg)
{
  __wasm_import_wasi_logging_log(1, (int32_t)context, strlen(context), (int32_t)msg, strlen(msg));
}

void log_info(const char *context, const char *msg)
{
  __wasm_import_wasi_logging_log(2, (int32_t)context, strlen(context), (int32_t)msg, strlen(msg));
}

void log_warn(const char *context, const char *msg)
{
  __wasm_import_wasi_logging_log(3, (int32_t)context, strlen(context), (int32_t)msg, strlen(msg));
}

void log_error(const char *context, const char *msg)
{
  __wasm_import_wasi_logging_log(4, (int32_t)context, strlen(context), (int32_t)msg, strlen(msg));
}

// WASI Adapter Memory Override Fix
// Pending upstreaming via https://github.com/WebAssembly/wasi-libc/pull/377

static bool used = false;
extern char __heap_base;

#define PAGESIZE_2 (64 * 1024)

extern "C" void *sbrk(intptr_t increment)
{
  if (increment == 0)
  {
    if (!used)
    {
      used = true;
      size_t base = (size_t)&__heap_base;
      return (void *)((base + PAGESIZE_2 - 1) & ~(PAGESIZE_2 - 1));
    }
    return (void *)(__builtin_wasm_memory_grow(0, 0) * PAGESIZE_2);
  }
  if (increment < 0)
  {
    log_error("sbrk", "Bad sbrk call");
    abort();
  }
  return (void *)(__builtin_wasm_memory_grow(0, increment / PAGESIZE_2) * PAGESIZE_2);
}

// Import Splicing Functions

__attribute__((noinline))
int32_t
get_int32(JS::MutableHandleValue val)
{
  return val.toInt32();
}

__attribute__((noinline))
int64_t
get_int64(JS::MutableHandleValue val)
{
  JS::BigInt *arg0 = val.toBigInt();
  uint64_t arg0_uint64;
  if (!JS::detail::BigIntIsUint64(arg0, &arg0_uint64))
  {
    log_error("get_int64", "Not a valid int64");
    abort();
  }
  return arg0_uint64;
}

__attribute__((noinline)) float get_float32(JS::MutableHandleValue val)
{
  return val.toDouble();
}

__attribute__((noinline)) double get_float64(JS::MutableHandleValue val)
{
  return val.toDouble();
}

__attribute__((noinline)) void set_int32(JS::MutableHandleValue val, int32_t num)
{
  val.setInt32(num);
}

__attribute__((noinline)) void set_int64(JS::MutableHandleValue val, int64_t num)
{
  val.setBigInt(JS::detail::BigIntFromUint64(CX, num));
}

__attribute__((noinline)) void set_float32(JS::MutableHandleValue val, float num)
{
  val.setDouble(num);
}

__attribute__((noinline)) void set_float64(JS::MutableHandleValue val, double num)
{
  val.setDouble(num);
}

/*
 * These 4 "sample" functions are deconstructed after compilation and fully
 * removed. The generated code is then used to build a template for constructing
 * the generic binding functions from it. By always keeping these samples around we
 * can ensure this approach is resiliant to some degree of compiled output changes,
 * or at least throw a vaguely useful error when that is no longer the case.
 */
__attribute__((export_name("coreabi_sample_i32"))) bool CoreAbiSampleI32(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  int32_t arg0 = get_int32(args[0]);
  args.rval().setInt32(arg0);
  return true;
}

__attribute__((export_name("coreabi_sample_i64"))) bool CoreAbiSampleI64(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  int64_t arg1 = get_int64(args[1]);
  args.rval().setBigInt(JS::detail::BigIntFromUint64(cx, arg1));
  return true;
}

__attribute__((export_name("coreabi_sample_f32"))) bool CoreAbiSampleF32(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  float arg2 = get_float32(args[2]);
  args.rval().setDouble(arg2);
  return true;
}

__attribute__((export_name("coreabi_sample_f64"))) bool CoreAbiSampleF64(JSContext *cx, unsigned argc, JS::Value *vp)
{
  JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
  double arg3 = get_float64(args[3]);
  args.rval().setDouble(arg3);
  return true;
}

/*
 * This function will get generated imports spliced into its branching
 * after compilation.
 */
__attribute__((export_name("coreabi_get_import")))
JSFunction *coreabi_get_import(int32_t idx, const char *name)
{
  switch (idx) {
    case 0:
      return JS_NewFunction(CX, CoreAbiSampleI32, 1, 0, name);
  }
  // log_error("coreabi_get_import", "Unable to find import function");
  abort();
}

// Exception Handling

// Note requires an AutoRealm
bool ReportAndClearException(JSContext *cx)
{
  JS::ExceptionStack stack(cx);
  if (!JS::StealPendingExceptionStack(cx, &stack))
  {
    // log_error("err", "Uncatchable exception thrown, out of memory or something");
    return false;
  }

  JS::ErrorReportBuilder report(cx);
  if (!report.init(cx, stack, JS::ErrorReportBuilder::WithSideEffects))
  {
    // log_error("err", "Couldn't build error report");
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
    if (!JS::SetAdd(cx, unhandledRejectedPromises, promiseVal))
    {
      log_error("rejection_tracker", "Adding an unhandled rejected promise to the promise rejection tracker failed");
    }
    return;
  }
  case JS::PromiseRejectionHandlingState::Handled:
  {
    bool deleted = false;
    if (!JS::SetDelete(cx, unhandledRejectedPromises, promiseVal, &deleted))
    {
      log_error("rejection_tracker", "Removing an handled rejected promise from the promise rejection tracker failed");
    }
  }
  }
}

// Binding Functions

__attribute__((export_name("cabi_realloc"))) void *cabi_realloc(void *ptr, size_t orig_size, size_t org_align, size_t new_size)
{
  void *ret = realloc(ptr, new_size);
  if (!ret)
  {
    log_error("cabi_realloc", "Unable to realloc");
    abort();
  }
  return ret;
}

void *LAST_SBRK;
JS::PersistentRootedObject AB;
static bool GetMemBuffer(JSContext *cx, unsigned argc, JS::Value *vp)
{
  if (sbrk(0) != LAST_SBRK)
  {
    LAST_SBRK = sbrk(0);
    AB = JS::RootedObject(CX, JS::NewArrayBufferWithUserOwnedContents(CX, (size_t)LAST_SBRK, (void *)0));
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

  args.rval().setInt32((uint32_t)cabi_realloc(old_ptr, old_len, align, new_len));
  return true;
}

// Main (Wizer initialize)

int main() {}

extern "C" void __wasm_call_ctors();

__attribute__((export_name("wizer.initialize"))) void init()
{
  __wasm_call_ctors();
  if (!JS_Init())
  {
    INIT_ERROR = INIT_JSINIT;
    return;
  }

  CX = JS_NewContext(JS::DefaultHeapMaxBytes);
  if (!CX)
  {
    INIT_ERROR = INIT_JSINIT;
    return;
  }

  if (!js::UseInternalJobQueues(CX) || !JS::InitSelfHostedCode(CX))
  {
    INIT_ERROR = INIT_JSINIT;
    return;
  }
  // TODO: check if we should set a different creation zone.
  JS::RealmOptions realm_options;
  realm_options.creationOptions()
      // .setFreezeBuiltins(true)
      .setStreamsEnabled(true)
      .setReadableByteStreamsEnabled(true)
      .setBYOBStreamReadersEnabled(true)
      .setReadableStreamPipeToEnabled(true)
      .setWritableStreamsEnabled(true)
      .setWeakRefsEnabled(JS::WeakRefSpecifier::EnabledWithoutCleanupSome);

  JS::DisableIncrementalGC(CX);
  // JS_SetGCParameter(CX, JSGC_MAX_EMPTY_CHUNK_COUNT, 1);

  GLOBAL = JS::PersistentRootedObject(CX, JS_NewGlobalObject(CX, &global_class, nullptr, JS::FireOnNewGlobalHook, realm_options));
  if (!GLOBAL)
  {
    INIT_ERROR = INIT_INTRINSICS;
    return;
  }

  JSAutoRealm ar(CX, GLOBAL);
  if (!JS::InitRealmStandardClasses(CX))
  {
    INIT_ERROR = INIT_INTRINSICS;
    return;
  }

  if (!TextEncoder::init_class(CX, GLOBAL))
  {
    INIT_ERROR = INIT_CUSTOM_INTRINSICS;
    return;
  }
  if (!TextDecoder::init_class(CX, GLOBAL))
  {
    INIT_ERROR = INIT_CUSTOM_INTRINSICS;
    return;
  }

  JS::SetPromiseRejectionTrackerCallback(CX, rejection_tracker);

  unhandledRejectedPromises.init(CX, JS::NewSetObject(CX));
  if (!unhandledRejectedPromises)
  {
    INIT_ERROR = INIT_PROMISE_REJECTIONS;
    return;
  }

  uint32_t src_len = atoi(getenv("SOURCE_LEN"));

  char *code = (char *)malloc(src_len + 1);

  if (read(0, code, src_len) != src_len)
  {
    INIT_ERROR = INIT_SOURCE_STDIN;
    return;
  }
  code[src_len] = '\0';

  JS::CompileOptions compile_options(CX);
  compile_options.setFileAndLine(getenv("SOURCE_NAME"), 1);

  JS::SourceText<mozilla::Utf8Unit> moz_source;
  if (!moz_source.init(CX, code, strlen(code), JS::SourceOwnership::Borrowed))
  {
    INIT_ERROR = INIT_SOURCE_COMPILE;
    return;
  }

  JSObject *mod_obj = JS::CompileModule(CX, compile_options, moz_source);
  if (!mod_obj)
  {
    INIT_ERROR = INIT_SOURCE_COMPILE;
    return;
  }

  MOD = JS::PersistentRootedObject(CX, mod_obj);

  if (!JS::ModuleLink(CX, MOD))
  {
    INIT_ERROR = INIT_SOURCE_LINK;
    return;
  }

  // Result value, used for top-level await.
  JS::RootedValue rval(CX);

  // Execute the module bytecode.
  if (!JS::ModuleEvaluate(CX, MOD, &rval))
  {
    INIT_ERROR = INIT_SOURCE_EXEC;
    return;
  }

  JS::RootedObject ns(CX, JS::GetModuleNamespace(CX, MOD));

  uint32_t export_cnt = atoi(getenv("EXPORT_CNT"));
  char env_name[100];
  for (size_t i = 0; i < export_cnt; i++)
  {
    sprintf(&env_name[0], "EXPORT%zu", i);
    if (!JS_GetProperty(CX, ns, getenv(env_name), &FN[i]))
    {
      INIT_ERROR = INIT_FN_LIST;
      return;
    }
  }

  uint32_t import_cnt = atoi(getenv("IMPORT_CNT"));

  JS::RootedVector<JS::Value> args(CX);
  if (!args.resize(2 + import_cnt))
  {
    INIT_ERROR = INIT_FN_LIST;
    return;
  }

  JS::RootedObject mem(CX, JS_NewPlainObject(CX));
  if (!JS_DefineProperty(CX, mem, "buffer", GetMemBuffer,
                         nullptr, JSPROP_ENUMERATE))
  {
    INIT_ERROR = INIT_MEM_BUFFER;
    return;
  }

  args[0].setObject(*mem);

  JSFunction *realloc_fn = JS_NewFunction(CX, ReallocFn, 0, 0, "realloc");
  if (!realloc_fn)
  {
    INIT_ERROR = INIT_REALLOC_FN;
    return;
  }
  args[1].setObject(*JS_GetFunctionObject(realloc_fn));

  for (size_t i = 0; i < import_cnt; i++)
  {
    sprintf(&env_name[0], "IMPORT%zu", i);
    JSFunction *import_fn = coreabi_get_import(i, getenv(env_name));
    if (!import_fn)
    {
      INIT_ERROR = INIT_IMPORT_FN;
      return;
    }
    args[2 + i].setObject(*JS_GetFunctionObject(import_fn));
  }

  JS::RootedValue set_mem_realloc(CX);
  JS_GetProperty(CX, ns, "initBindings", &set_mem_realloc);
  JS::RootedValue r(CX);
  if (!JS_CallFunctionValue(CX, nullptr, set_mem_realloc, args, &r))
  {
    INIT_ERROR = INIT_MEM_BINDINGS;
    return;
  }

  js::RunJobs(CX);
  JS_MaybeGC(CX);

  // TODO: Run task queue / TLA / get top-level exec runtime error?
  JS::RootedValue exc(CX);
  if (JS_GetPendingException(CX, &exc))
  {
    ReportAndClearException(CX);
    INIT_ERROR = INIT_SOURCE_EXEC;
    return;
  }
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

void *free_list[FREE_LIST_MAX];
size_t free_list_len = 0;
uint32_t LAST_FN_IDX = -1;

// char s[10];
// sprintf(s, "%d", src_len);

__attribute__((export_name("check_init")))
uint8_t
check_init()
{
  JSAutoRealm ar(CX, GLOBAL);
  switch (INIT_ERROR)
  {
  case INIT_SOURCE_COMPILE:
  case INIT_SOURCE_EXEC:
  case INIT_MEM_BINDINGS:
    ReportAndClearException(CX);
  }
  return INIT_ERROR;
}

__attribute__((export_name("call"))) void call(uint32_t fn, uint32_t retptr, uint32_t corearg_cnt, coreval *coreargs)
{
  log_trace("call", "start");

  JSAutoRealm ar(CX, GLOBAL);

  if (LAST_FN_IDX != -1 || free_list_len != 0)
  {
    log_error("call", "Unexpected call state, was post_call previously called?");
    abort();
  }
  LAST_FN_IDX = fn;

  JS::RootedVector<JS::Value> args(CX);
  if (!args.resize(corearg_cnt + 1))
  {
    log_error("call", "Unable to allocate memory for array resize");
    abort();
  }

  for (int i = 0; i < corearg_cnt; i++)
  {
    switch (coreargs[i].tag)
    {
    case COMPONENT_RUNTIME_COREVAL_I32:
      args[i].setInt32(coreargs[i].val.i32);
      break;
    case COMPONENT_RUNTIME_COREVAL_I64:
      args[i].setBigInt(JS::detail::BigIntFromUint64(CX, coreargs[i].val.i64));
      break;
    case COMPONENT_RUNTIME_COREVAL_F32:
      args[i].setNumber(coreargs[i].val.f32);
      break;
    case COMPONENT_RUNTIME_COREVAL_F64:
      args[i].setNumber(coreargs[i].val.f64);
      break;
    }
  }

  args[corearg_cnt].setInt32(retptr);

  JS::RootedValue r(CX);
  if (!JS_CallFunctionValue(CX, nullptr, FN[fn], args, &r))
  {
    log_error("call", "Runtime JS Error");
    ReportAndClearException(CX);
    // TODO error synthesis for errorable
    // basically runtime errors are aborts
    // unless you have an explicit result return
    // in which case the runtime error is recreated fully!
    abort();
  }

  log_trace("call", "end");
}

__attribute__((export_name("post_call"))) void post_call(uint32_t fn)
{
  log_trace("post_call", "start");
  if (LAST_FN_IDX != fn)
  {
    log_error("post_call", "Unexpected call state, was call definitely called last?");
    abort();
  }
  LAST_FN_IDX = -1;
  for (size_t i = 0; i < free_list_len; i++)
  {
    JS_free(CX, free_list[i]);
  }
  free_list_len = 0;
  log_trace("post_call", "jobs");
  js::RunJobs(CX);
  log_trace("post_call", "maybe gc");
  JS_MaybeGC(CX);
  log_trace("post_call", "end");
}
