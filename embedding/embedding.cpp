#include "embedding.h"

namespace builtins::web::console {

class Console : public BuiltinNoConstructor<Console> {
private:
public:
  static constexpr const char *class_name = "Console";
  enum LogType {
    Log,
    Info,
    Debug,
    Warn,
    Error,
  };
  enum Slots { Count };
  static const JSFunctionSpec methods[];
  static const JSPropertySpec properties[];
};

void builtin_impl_console_log(Console::LogType log_ty, const char *msg) {
  fprintf(stdout, "%s\n", msg);
  fflush(stdout);
}

} // builtins::web::console

extern "C"
{ 
  using componentize::embedding::Runtime;
  using componentize::embedding::cabi_free;
  using componentize::embedding::ReportAndClearException;
  using componentize::embedding::ComponentizeRuntime;
  using componentize::embedding::CoreVal;

  // These functions are used both internally and also exported for use directly by the splicer codegen
  __attribute__((noinline, export_name("coreabi_from_bigint64"))) int64_t from_bigint64(JS::MutableHandleValue handle)
  {
    JS::BigInt *arg0 = handle.toBigInt();
    uint64_t arg0_uint64;
    if (!JS::detail::BigIntIsUint64(arg0, &arg0_uint64))
    {
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

  // Allocation functions for the splicer
  __attribute__((optnone, export_name("coreabi_get_import")))
  JSFunction *
  coreabi_get_import(int32_t idx, int32_t argcnt, const char *name)
  {
    return JS_NewFunction(Runtime.cx, CoreAbiSampleI32, argcnt, 0, name);
  }

  __attribute__((export_name("cabi_realloc_adapter"))) void *cabi_realloc_adapter(void *ptr, size_t orig_size, size_t org_align, size_t new_size)
  {
    return JS_realloc(Runtime.cx, ptr, orig_size, new_size);
  }

  // This MUST override the StarlingMonkey core cabi_realloc export
  __attribute__((export_name("cabi_realloc"))) void *cabi_realloc(void *ptr, size_t orig_size, size_t org_align, size_t new_size)
  {
    void *ret = JS_realloc(Runtime.cx, ptr, orig_size, new_size);
    // track all allocations during a function "call" for freeing
    Runtime.free_list.push_back(ret);
    if (!ret)
    {
      LOG("(cabi_realloc) Unable to realloc");
      abort();
    }
    LOG("(cabi_realloc) [%d %zu %zu] %d\n", (uint32_t)ptr, orig_size, new_size, (uint32_t)ret);
    return ret;
  }

  __attribute__((export_name("call"))) uint32_t call(uint32_t fn_idx, void *argptr)
  {
    if (Runtime.first_call)
    {
      js::ResetMathRandomSeed(Runtime.cx);
      Runtime.first_call = false;
    }
    if (Runtime.cur_fn_idx != -1)
    {
      LOG("(call) unexpected call state, post_call was not called after last call");
      abort();
    }
    Runtime.cur_fn_idx = fn_idx;
    ComponentizeRuntime::CoreFn *fn = &Runtime.fns[fn_idx];
    if (Runtime.debug)
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
        fprintf(stderr, "%s", core_ty_str(fn->args[i]));
      }
      fprintf(stderr, ")");
      if (fn->ret.has_value())
      {
        fprintf(stderr, " -> ");
        if (fn->retptr)
        {
          fprintf(stderr, "*");
        }
        fprintf(stderr, "%s", core_ty_str(fn->ret.value()));
      }
      fprintf(stderr, "\n");
    }

    JSAutoRealm ar(Runtime.cx, Runtime.engine->global());

    JS::RootedVector<JS::Value> args(Runtime.cx);
    if (!args.resize(fn->args.size() + (fn->retptr ? 1 : 0)))
    {
      LOG("(call) unable to allocate memory for array resize");
      abort();
    }

    LOG("(call) setting args");
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
          args[i].setBigInt(JS::detail::BigIntFromUint64(Runtime.cx, *(uint64_t *)(curptr)));
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
      LOG("(call) setting retptr at arg %d\n", argcnt);
      retptr = JS_realloc(Runtime.cx, 0, 0, fn->retsize);
      args[argcnt].setInt32((uint32_t)retptr);
    }

    LOG("(call) JS lowering call");
    JS::RootedValue r(Runtime.cx);
    if (!JS_CallFunctionValue(Runtime.cx, nullptr, fn->func, args, &r))
    {
      LOG("(call) runtime JS Error");
      ReportAndClearException(Runtime.cx);
      abort();
    }

    // Handle singular returns
    if (!fn->retptr && fn->ret.has_value())
    {
      LOG("(call) singular return");
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
        *((float *)retptr) = r.isInt32() ? static_cast<float>(r.toInt32()) : static_cast<float>(r.toDouble());
        break;
      case CoreVal::F64:
        *((double *)retptr) = r.isInt32() ? static_cast<double>(r.toInt32()) : r.toDouble();
        break;
      }
    }

    LOG("(call) end");

    // we always return a retptr (even if null)
    // the wrapper will drop it if not needed
    return (uint32_t)retptr;
  }

  __attribute__((export_name("post_call"))) void post_call(uint32_t fn_idx)
  {
    LOG("(post_call) Function [%d]", fn_idx);
    if (Runtime.cur_fn_idx != fn_idx)
    {
      LOG("(post_call) Unexpected call state, post_call must only be called immediately after call");
      abort();
    }
    Runtime.cur_fn_idx = -1;
    for (void *ptr : Runtime.free_list)
    {
      cabi_free(ptr);
    }
    Runtime.free_list.clear();
    RootedValue result(Runtime.cx);
    Runtime.engine->run_event_loop(&result);
    LOG("(post_call) end");
  }

  __attribute__((export_name("check_init"))) ComponentizeRuntime::InitError check_init() {
    JSAutoRealm ar(Runtime.cx, Runtime.engine->global());
    JS::RootedValue exc(Runtime.cx);
    if (JS_GetPendingException(Runtime.cx, &exc))
    {
      ReportAndClearException(Runtime.cx);
    }
    return Runtime.init_err;
  }

  __attribute__((export_name("componentize.wizer")))
  void componentize_initialize() {
    uint32_t is_debug = atoi(getenv("DEBUG"));
    if (is_debug)
    {
      Runtime.debug = true;
    }

    __wizer_initialize();
    char env_name[100];
    LOG("(wizer) retrieve and generate the export bindings");
    RootedObject ns(Runtime.cx, &Runtime.engine->script_value().toObject());

    uint32_t export_cnt = atoi(getenv("EXPORT_CNT"));
    for (size_t i = 0; i < export_cnt; i++)
    {
      ComponentizeRuntime::CoreFn *fn = &Runtime.fns.emplace_back();

      sprintf(&env_name[0], "EXPORT%zu_NAME", i);
      RootedValue function_binding(Runtime.cx);
      if (!JS_GetProperty(Runtime.cx, ns, getenv(env_name), &function_binding))
      {
        Runtime.init_err = ComponentizeRuntime::InitError::FnList;
        return;
      }

      fn->func.init(Runtime.cx, function_binding);

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
          Runtime.init_err = ComponentizeRuntime::InitError::TypeParse;
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
          Runtime.init_err = ComponentizeRuntime::InitError::TypeParse;
          return;
        }
      }

      sprintf(&env_name[0], "EXPORT%zu_RETSIZE", i);
      fn->retsize = atoi(getenv(env_name));
    }
  }
}

namespace componentize::embedding
{
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

  void cabi_free(void *ptr)
  {
    LOG("(cabi_free) %d", (uint32_t)ptr);
    JS_free(Runtime.cx, ptr);
  }

  const char *core_ty_str(CoreVal ty)
  {
    switch (ty)
    {
    case CoreVal::I32:
      return "i32";
    case CoreVal::I64:
      return "i64";
    case CoreVal::F32:
      return "f32";
    case CoreVal::F64:
      return "f64";
    }
  }

  // Note requires an AutoRealm
  bool ReportAndClearException(JSContext *cx)
  {
    JS::ExceptionStack stack(cx);
    if (!JS::StealPendingExceptionStack(cx, &stack))
    {
      LOG("(err) Uncatchable exception thrown");
      return false;
    }

    JS::ErrorReportBuilder report(cx);
    if (!report.init(cx, stack, JS::ErrorReportBuilder::WithSideEffects))
    {
      LOG("(err) Couldn't build error report");
      return false;
    }

    JS::PrintError(stderr, report, false);
    return true;
  }

  void *LAST_SBRK;
  JS::PersistentRootedObject AB;
  static bool GetMemBuffer(JSContext *cx, unsigned argc, JS::Value *vp)
  {
    if (sbrk(0) != LAST_SBRK)
    {
      LAST_SBRK = sbrk(0);
      #ifdef DEBUG
        void* base = (void*)64;
      #else
        void* base = 0;
      #endif
      JS::RootedObject mem_buffer(cx, JS::NewArrayBufferWithUserOwnedContents(cx, (size_t)LAST_SBRK, base));
      AB.init(cx, mem_buffer);
    }
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    args.rval().setObject(*AB);
    return true;
  }

  bool install(api::Engine *engine)
  {
    Runtime.engine = engine;
    Runtime.cx = engine->cx();

    char env_name[100];

    Runtime.source_name = std::string(getenv("SOURCE_NAME"));

    // -- Wire up the imports  --
    uint32_t import_cnt = atoi(getenv("IMPORT_CNT"));

    JS::RootedObject import_bindings(Runtime.cx, JS::NewArrayObject(Runtime.cx, 2 + import_cnt));

    LOG("(wizer) create the memory buffer JS object");
    JS::RootedObject mem(Runtime.cx, JS_NewPlainObject(Runtime.cx));
    if (!JS_DefineProperty(Runtime.cx, mem, "buffer", GetMemBuffer,
                          nullptr, JSPROP_ENUMERATE))
    {
      return false;
    }

    JS_SetElement(Runtime.cx, import_bindings, 0, mem);

    LOG("(wizer) create the realloc JS function");
    JSFunction *realloc_fn = JS_NewFunction(Runtime.cx, ReallocFn, 0, 0, "realloc");
    if (!realloc_fn)
    {
      return false;
    }
    JS::RootedObject function_obj(Runtime.cx, JS_GetFunctionObject(realloc_fn));
    JS_SetElement(Runtime.cx, import_bindings, 1, function_obj);

    LOG("(wizer) create the %d import JS functions", import_cnt);
    for (size_t i = 0; i < import_cnt; i++)
    {
      sprintf(&env_name[0], "IMPORT%zu_NAME", i);
      const char *name = getenv(env_name);
      sprintf(&env_name[0], "IMPORT%zu_ARGCNT", i);
      uint32_t argcnt = atoi(getenv(env_name));

      JSFunction *import_fn = coreabi_get_import(i, argcnt, name);
      if (!import_fn)
      {
        return false;
      }
      JS::RootedObject function_obj(Runtime.cx, JS_GetFunctionObject(import_fn));
      JS_SetElement(Runtime.cx, import_bindings, 2 + i, function_obj);
    }

    LOG("(wizer) setting the binding global");
    if (!JS_DefineProperty(engine->cx(), engine->global(), "$bindings", import_bindings, 0)) {
      return false;
    }

    LOG("(wizer) complete");
    
    return true;
  }

} // namespace componentize
