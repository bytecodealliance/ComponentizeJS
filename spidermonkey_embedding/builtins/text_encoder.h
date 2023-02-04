#ifndef COMPONENTIZE_BUILTIN_TEXT_ENCODER_H
#define COMPONENTIZE_BUILTIN_TEXT_ENCODER_H

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

  bool init_class(JSContext *cx, JS::HandleObject global);

  bool check_receiver(JSContext *cx, JS::HandleValue receiver, const char *method_name);

  bool encode(JSContext *cx, unsigned argc, JS::Value *vp);

  bool encoding_get(JSContext *cx, unsigned argc, JS::Value *vp);

  bool constructor(JSContext *cx, unsigned argc, JS::Value *vp);

} // namespace TextEncoder

#endif
