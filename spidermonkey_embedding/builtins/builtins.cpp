#include "builtins.h"

#include <js/ArrayBuffer.h>
#include <js/experimental/TypedData.h>
#include <js/Conversions.h>

uint8_t *value_to_buffer(JSContext *cx, JS::HandleValue val, const char *val_desc, size_t *len)
{
  if (!val.isObject() ||
      !(JS_IsArrayBufferViewObject(&val.toObject()) || JS::IsArrayBufferObject(&val.toObject())))
  {
    // JS_ReportErrorNumberUTF8(cx, GetErrorMessage, nullptr, JSMSG_INVALID_BUFFER_ARG, val_desc,
    //                          val.type());
    return nullptr;
  }

  JS::RootedObject input(cx, &val.toObject());
  uint8_t *data;
  bool is_shared;

  if (JS_IsArrayBufferViewObject(input))
  {
    js::GetArrayBufferViewLengthAndData(input, len, &is_shared, &data);
  }
  else
  {
    JS::GetArrayBufferLengthAndData(input, len, &is_shared, &data);
  }

  return data;
}

bool ThrowIfNotConstructing(JSContext *cx, const JS::CallArgs &args,
                            const char *builtinName)
{
  if (args.isConstructing())
  {
    return true;
  }

  // JS_ReportErrorNumberASCII(cx, GetErrorMessage, nullptr, JSMSG_BUILTIN_CTOR_NO_NEW, builtinName);
  return false;
}

// TODO(performance): introduce a version that writes into an existing buffer, and use that
// with the hostcall buffer where possible.
// https://github.com/fastly/js-compute-runtime/issues/215
JS::UniqueChars encode(JSContext *cx, JS::HandleString str, size_t *encoded_len)
{
  JS::UniqueChars text = JS_EncodeStringToUTF8(cx, str);
  if (!text)
    return nullptr;

  // This shouldn't fail, since the encode operation ensured `str` is linear.
  JSLinearString *linear = JS_EnsureLinearString(cx, str);
  *encoded_len = JS::GetDeflatedUTF8StringLength(linear);
  return text;
}

JS::UniqueChars encode(JSContext *cx, JS::HandleValue val, size_t *encoded_len)
{
  JS::RootedString str(cx, JS::ToString(cx, val));
  if (!str)
    return nullptr;

  return encode(cx, str, encoded_len);
}

// SpecString encode(JSContext *cx, HandleValue val) {
//   SpecString slice(nullptr, 0, 0);
//   auto chars = encode(cx, val, &slice.len);
//   if (!chars)
//     return slice;
//   slice.data = (uint8_t *)chars.release();
//   slice.cap = slice.len;
//   return slice;
// }