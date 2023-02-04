#include "console.h"
#include "mozilla/Result.h"
#include "js/ForOfIterator.h"
#include "js/Id.h"
#include "jsfriendapi.h"

JS::Result<mozilla::Ok> ToSource(JSContext *cx, std::string &sourceOut, JS::HandleValue val,
                                 JS::MutableHandleObjectVector visitedObjects);

/**
 * Turn a handle of a Promise into a string which represents the promise.
 * - If the promise is pending this will return "Promise { <pending> }"
 * - If the promise is rejected this will return "Promise { <rejected> (rejected-value)}"
 *  where rejected-value would be the ToSource representation of the rejected value.
 * - If the promise is resolved this will return "Promise { resolved-value}"
 *  where resolved-value would be the ToSource representation of the resolved value.
 */
JS::Result<mozilla::Ok> PromiseToSource(JSContext *cx, std::string &sourceOut, JS::HandleObject obj,
                                        JS::MutableHandleObjectVector visitedObjects) {
  sourceOut += "Promise { ";
  JS::PromiseState state = JS::GetPromiseState(obj);
  switch (state) {
  case JS::PromiseState::Pending: {
    sourceOut += "<pending> }";
    break;
  }
  case JS::PromiseState::Fulfilled: {
    JS::RootedValue value(cx, JS::GetPromiseResult(obj));
    std::string source;
    MOZ_TRY(ToSource(cx, source, value, visitedObjects));
    sourceOut += source;
    sourceOut += " }";
    break;
  }
  case JS::PromiseState::Rejected: {
    sourceOut += "<rejected> ";
    JS::RootedValue value(cx, JS::GetPromiseResult(obj));
    std::string source;
    MOZ_TRY(ToSource(cx, source, value, visitedObjects));
    sourceOut += source;
    sourceOut += " }";
    break;
  }
  }
  return mozilla::Ok();
}

/**
 * Turn a handle of a Map into a string which represents the map.
 * Each key and value within the map will be converted into it's ToSource representation.
 */
JS::Result<mozilla::Ok> MapToSource(JSContext *cx, std::string &sourceOut, JS::HandleObject obj,
                                    JS::MutableHandleObjectVector visitedObjects) {
  sourceOut += "Map(";
  uint32_t size = JS::MapSize(cx, obj);
  sourceOut += std::to_string(size);
  sourceOut += ") { ";
  JS::Rooted<JS::Value> iterable(cx);
  if (!JS::MapEntries(cx, obj, &iterable)) {
    return JS::Result<mozilla::Ok>(JS::Error());
  }
  JS::ForOfIterator it(cx);
  if (!it.init(iterable)) {
    return JS::Result<mozilla::Ok>(JS::Error());
  }

  JS::RootedObject entry(cx);
  JS::RootedValue entry_val(cx);
  JS::RootedValue name_val(cx);
  JS::RootedValue value_val(cx);
  bool firstValue = true;
  while (true) {
    bool done;
    if (!it.next(&entry_val, &done)) {
      return JS::Result<mozilla::Ok>(JS::Error());
    }

    if (done) {
      break;
    }
    if (firstValue) {
      firstValue = false;
    } else {
      sourceOut += ", ";
    }

    entry = &entry_val.toObject();
    JS_GetElement(cx, entry, 0, &name_val);
    JS_GetElement(cx, entry, 1, &value_val);
    std::string name;
    MOZ_TRY(ToSource(cx, name, name_val, visitedObjects));
    sourceOut += name;
    sourceOut += " => ";
    std::string value;
    MOZ_TRY(ToSource(cx, value, value_val, visitedObjects));
    sourceOut += value;
  }
  sourceOut += " }";
  return mozilla::Ok();
}

/**
 * Turn a handle of a Set into a string which represents the set.
 * Each value within the set will be converted into it's ToSource representation.
 */
JS::Result<mozilla::Ok> SetToSource(JSContext *cx, std::string &sourceOut, JS::HandleObject obj,
                                    JS::MutableHandleObjectVector visitedObjects) {
  sourceOut += "Set(";
  uint32_t size = JS::SetSize(cx, obj);
  sourceOut += std::to_string(size);
  sourceOut += ") { ";
  JS::Rooted<JS::Value> iterable(cx);
  if (!JS::SetValues(cx, obj, &iterable)) {
    return JS::Result<mozilla::Ok>(JS::Error());
  }
  JS::ForOfIterator it(cx);
  if (!it.init(iterable)) {
    return JS::Result<mozilla::Ok>(JS::Error());
  }

  JS::RootedValue entry_val(cx);
  bool firstValue = true;
  while (true) {
    bool done;
    if (!it.next(&entry_val, &done)) {
      return JS::Result<mozilla::Ok>(JS::Error());
    }

    if (done) {
      break;
    }
    std::string entry;
    MOZ_TRY(ToSource(cx, entry, entry_val, visitedObjects));
    if (firstValue) {
      firstValue = false;
    } else {
      sourceOut += ", ";
    }
    sourceOut += entry;
  }
  sourceOut += " }";
  return mozilla::Ok();
}

/**
 * Turn a handle of an Object into a string which represents the object.
 * This function will go through every property on the object (including non-enumerable properties)
 * Each property name and property value within the object will be converted into it's ToSource
 * representation. Note: functions and methods within the object are not included in the output
 *
 * E.G. The object `{ a: 1, b: 2, c: 3, d(){}, get f(){}, g: function bar() {} }`
 *  would be represented as "{a: 1, b: {c: 2}, c: 3, f: undefined}"
 */
JS::Result<mozilla::Ok> ObjectToSource(JSContext *cx, std::string &sourceOut, JS::HandleObject obj,
                                       JS::MutableHandleObjectVector visitedObjects) {
  JS::RootedIdVector ids(cx);
  if (!js::GetPropertyKeys(cx, obj, 0, &ids)) {
    return JS::Result<mozilla::Ok>(JS::Error());
  }

  JS::RootedValue value(cx);
  size_t length = ids.length();
  if (length == 0) {
    sourceOut = "{}";
    return mozilla::Ok();
  } else {
    sourceOut += "{ ";
  }
  bool firstValue = true;
  for (size_t i = 0; i < length; ++i) {
    const auto &id = ids[i];
    if (!JS_GetPropertyById(cx, obj, id, &value)) {
      return JS::Result<mozilla::Ok>(JS::Error());
    }

    // commented out as functions on objects are part of the logging...
    // if (!value.isObject() || !JS_ObjectIsFunction(&value.toObject())) {
      if (firstValue) {
        firstValue = false;
      } else {
        sourceOut += ", ";
      }
      if (id.isSymbol()) {
        JS::RootedValue v(cx, SymbolValue(id.toSymbol()));
        std::string source;
        MOZ_TRY(ToSource(cx, source, v, visitedObjects));
        sourceOut += source;
      } else {
        JS::RootedValue idValue(cx, js::IdToValue(id));
        std::string source;
        MOZ_TRY(ToSource(cx, source, idValue, visitedObjects));
        sourceOut += source;
      }
      sourceOut += ": ";
      std::string source;
      MOZ_TRY(ToSource(cx, source, value, visitedObjects));
      sourceOut += source;
    // }
  }

  sourceOut += " }";
  return mozilla::Ok();
}

/**
 * Turn a handle of any value into a string which represents it.
 */
JS::Result<mozilla::Ok> ToSource(JSContext *cx, std::string &sourceOut, JS::HandleValue val,
                                 JS::MutableHandleObjectVector visitedObjects) {

  auto type = val.type();
  switch (type) {
  case JS::ValueType::Undefined: {
    sourceOut += "undefined";
    return mozilla::Ok();
  }
  case JS::ValueType::Null: {
    sourceOut += "null";
    return mozilla::Ok();
  }
  case JS::ValueType::Object: {
    JS::RootedObject obj(cx, &val.toObject());

    for (const auto &curObject : visitedObjects) {
      if (obj.get() == curObject) {
        sourceOut += "<Circular>";
        return mozilla::Ok();
      }
    }

    if (!visitedObjects.emplaceBack(obj)) {
      return JS::Result<mozilla::Ok>(JS::Error());
    }

    if (JS_ObjectIsFunction(obj)) {
      sourceOut += "[";
      sourceOut += JS::InformalValueTypeName(val);
      // TODO figure out function naming
      // sourceOut += " ";
      // JS::RootedValue name_val(cx);
      // if (!JS_GetProperty(cx, obj, "name", &name_val))
      //   return JS::Result<mozilla::Ok>(JS::Error());
      // if (!name_val.isString())
      //   return JS::Result<mozilla::Ok>(JS::Error());
      // JS::RootedString name_str(cx, name_val.toString());
      // JS::UniqueChars specChars = JS_EncodeStringToUTF8(cx, name_str);
      // sourceOut.append(specChars.get());
      sourceOut += "]";
      return mozilla::Ok();
    }
    js::ESClass cls;
    if (!JS::GetBuiltinClass(cx, obj, &cls)) {
      return JS::Result<mozilla::Ok>(JS::Error());
    }

    if (cls == js::ESClass::Array || cls == js::ESClass::Date || cls == js::ESClass::Error ||
        cls == js::ESClass::RegExp) {
      JS::RootedString source(cx, JS_ValueToSource(cx, val));
      size_t message_len;
      auto msg = encode(cx, source, &message_len);
      if (!msg) {
        return JS::Result<mozilla::Ok>(JS::Error());
      }
      std::string sourceString(msg.get(), message_len);
      sourceOut += sourceString;
      return mozilla::Ok();
    } else if (cls == js::ESClass::Set) {
      std::string sourceString;
      MOZ_TRY(SetToSource(cx, sourceString, obj, visitedObjects));
      sourceOut += sourceString;
      return mozilla::Ok();
    } else if (cls == js::ESClass::Map) {
      std::string sourceString;
      MOZ_TRY(MapToSource(cx, sourceString, obj, visitedObjects));
      sourceOut += sourceString;
      return mozilla::Ok();
    } else if (cls == js::ESClass::Promise) {
      std::string sourceString;
      MOZ_TRY(PromiseToSource(cx, sourceString, obj, visitedObjects));
      sourceOut += sourceString;
      return mozilla::Ok();
    } else {
      if (JS::IsWeakMapObject(obj)) {
        std::string sourceString = "WeakMap { <items unknown> }";
        sourceOut += sourceString;
        return mozilla::Ok();
      }
      auto cls = JS::GetClass(obj);
      std::string className(cls->name);
      if (className == "WeakSet") {
        std::string sourceString = "WeakSet { <items unknown> }";
        sourceOut += sourceString;
        return mozilla::Ok();
      }
      std::string sourceString;
      MOZ_TRY(ObjectToSource(cx, sourceString, obj, visitedObjects));
      sourceOut += sourceString;
      return mozilla::Ok();
    }
  }
  case JS::ValueType::String: {
    size_t message_len;
    auto msg = encode(cx, val, &message_len);
    if (!msg) {
      return JS::Result<mozilla::Ok>(JS::Error());
    }
    std::string sourceString(msg.get(), message_len);
    sourceOut += sourceString;
    return mozilla::Ok();
  }
  default: {
    JS::RootedString source(cx, JS_ValueToSource(cx, val));
    size_t message_len;
    auto msg = encode(cx, source, &message_len);
    if (!msg) {
      return JS::Result<mozilla::Ok>(JS::Error());
    }
    std::string sourceString(msg.get(), message_len);
    sourceOut += sourceString;
    return mozilla::Ok();
  }
  }
}

namespace builtins {

template <const char *prefix, uint8_t prefix_len, bool log_stderr>
static bool console_out(JSContext *cx, unsigned argc, JS::Value *vp) {
  JS::CallArgs args = CallArgsFromVp(argc, vp);
  std::string fullLogLine = "";
  auto length = args.length();
  JS::RootedObjectVector visitedObjects(cx);
  for (int i = 0; i < length; i++) {
    JS::HandleValue arg = args.get(i);
    std::string source = "";
    auto result = ToSource(cx, source, arg, &visitedObjects);
    if (result.isErr()) {
      return false;
    }
    std::string message = source;
    if (fullLogLine.length()) {
      fullLogLine += " ";
      fullLogLine += message;
    } else {
      fullLogLine += message;
    }
  }

  FILE* stdio = log_stderr ? stderr : stdout;
  if (prefix_len > 0) {
    fprintf(stdio, "%s: %s\n", prefix, fullLogLine.c_str());
  } else {
    fprintf(stdio, "%s\n", fullLogLine.c_str());
  }
  fflush(stdio);

  args.rval().setUndefined();
  return true;
}

static constexpr char PREFIX_NONE[] = "";
// static constexpr char PREFIX_LOG[] = "Log";
// static constexpr char PREFIX_DEBUG[] = "Debug";
// static constexpr char PREFIX_INFO[] = "Info";
// static constexpr char PREFIX_WARN[] = "Warn";
// static constexpr char PREFIX_ERROR[] = "Error";

const JSFunctionSpec Console::methods[] = {
    JS_FN("log", (console_out<PREFIX_NONE, 0, false>), 1, JSPROP_ENUMERATE),
    JS_FN("debug", (console_out<PREFIX_NONE, 0, false>), 1, JSPROP_ENUMERATE),
    JS_FN("info", (console_out<PREFIX_NONE, 0, false>), 1, JSPROP_ENUMERATE),
    JS_FN("warn", (console_out<PREFIX_NONE, 0, true>), 1, JSPROP_ENUMERATE),
    JS_FN("error", (console_out<PREFIX_NONE, 0, true>), 1, JSPROP_ENUMERATE),
    JS_FS_END};

const JSPropertySpec Console::properties[] = {JS_PS_END};

bool Console::create(JSContext *cx, JS::HandleObject global) {
  JS::RootedObject console(cx, JS_NewPlainObject(cx));
  if (!console)
    return false;
  if (!JS_DefineProperty(cx, global, "console", console, JSPROP_ENUMERATE))
    return false;
  return JS_DefineFunctions(cx, console, methods);
}
} // namespace builtins