#include "builtins.h"

#include <js/ArrayBuffer.h>

namespace TextEncoder
{
  namespace Slots
  {
    enum
    {
      Count
    };
  };

  const unsigned ctor_length = 0;

  bool check_receiver(JSContext *cx, JS::HandleValue receiver, const char *method_name);

  bool encode(JSContext *cx, unsigned argc, JS::Value *vp)
  {
    METHOD_HEADER(1)

    // Default to empty string if no input is given.
    if (args.get(0).isUndefined())
    {
      JS::RootedObject byte_array(cx, JS_NewUint8Array(cx, 0));
      if (!byte_array)
        return false;

      args.rval().setObject(*byte_array);
      return true;
    }

    size_t chars_len;
    JS::UniqueChars chars = encode(cx, args[0], &chars_len);

    auto *rawChars = chars.release();
    JS::RootedObject buffer(cx, JS::NewArrayBufferWithContents(cx, chars_len, rawChars));
    if (!buffer)
    {
      JS_free(cx, rawChars);
      return false;
    }

    JS::RootedObject byte_array(cx, JS_NewUint8ArrayWithBuffer(cx, buffer, 0, chars_len));
    if (!byte_array)
      return false;

    args.rval().setObject(*byte_array);
    return true;
  }

  bool encoding_get(JSContext *cx, unsigned argc, JS::Value *vp)
  {
    METHOD_HEADER(0)

    JS::RootedString str(cx, JS_NewStringCopyN(cx, "utf-8", 5));
    if (!str)
      return false;

    args.rval().setString(str);
    return true;
  }

  const JSFunctionSpec methods[] = {
    JS_FN("encode", encode, 1, JSPROP_ENUMERATE),
    JS_FS_END
  };

  const JSPropertySpec properties[] = {
      JS_PSG("encoding", encoding_get, JSPROP_ENUMERATE),
      JS_STRING_SYM_PS(toStringTag, "TextEncoder", JSPROP_READONLY),
      JS_PS_END};

  bool constructor(JSContext *cx, unsigned argc, JS::Value *vp);
  CLASS_BOILERPLATE(TextEncoder)

  bool constructor(JSContext *cx, unsigned argc, JS::Value *vp)
  {
    CTOR_HEADER("TextEncoder", 0);

    JS::RootedObject self(cx, JS_NewObjectForConstructor(cx, &class_, args));
    if (!self)
      return false;

    args.rval().setObject(*self);
    return true;
  }
} // namespace TextEncoder
