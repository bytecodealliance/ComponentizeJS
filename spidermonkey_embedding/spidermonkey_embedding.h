#include <cstdio>
#include <assert.h>
#include <unistd.h>
#include <map>
#include <vector>
#include <optional>

// remove these once the warnings are fixed
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

#include "builtin.h"

struct JSErrorFormatString;

// const JSErrorFormatString js_ErrorFormatString[JSErrNum_Limit] = {
// #define MSG_DEF(name, count, exception, format) {#name, format, count, exception},
// #include "./error-numbers.msg"
// #undef MSG_DEF
// };
