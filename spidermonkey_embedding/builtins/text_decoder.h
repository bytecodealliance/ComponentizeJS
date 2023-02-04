#ifndef COMPONENTIZE_BUILTIN_TEXT_DECODER_H
#define COMPONENTIZE_BUILTIN_TEXT_DECODER_H

#include "builtins.h"

namespace TextDecoder
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

  bool decode(JSContext *cx, unsigned argc, JS::Value *vp);

  bool encoding_get(JSContext *cx, unsigned argc, JS::Value *vp);

  bool constructor(JSContext *cx, unsigned argc, JS::Value *vp);
} // namespace TextDecoder

#endif
