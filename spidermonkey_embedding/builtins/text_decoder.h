#ifndef COMPONENTIZE_BUILTIN_TEXT_DECODER_H
#define COMPONENTIZE_BUILTIN_TEXT_DECODER_H

#include "builtin.h"

// TODO: remove these once the warnings are fixed
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Winvalid-offsetof"
#pragma clang diagnostic ignored "-Wdeprecated-enum-enum-conversion"
#include <js/experimental/TypedData.h>

#include <js/ArrayBuffer.h>

#include <js/Conversions.h>
#include <cstdio>
#include <assert.h>
#include <unistd.h>
#pragma clang diagnostic pop

namespace TextDecoder
{
  bool init_class(JSContext *cx, JS::HandleObject global);

  bool check_receiver(JSContext *cx, JS::HandleValue receiver, const char *method_name);

  bool decode(JSContext *cx, unsigned argc, JS::Value *vp);

  bool encoding_get(JSContext *cx, unsigned argc, JS::Value *vp);

  bool constructor(JSContext *cx, unsigned argc, JS::Value *vp);
} // namespace TextDecoder

#endif
