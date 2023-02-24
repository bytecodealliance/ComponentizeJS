/*
 * Our own version of spidermonkey/js/friend/ErrorNumbers.msg
 * where we can add our own custom error messages for use within the runtime
 */

/*
 * This is our JavaScript error message file.
 *
 * The format for each JS error message is:
 *
 * MSG_DEF(<SYMBOLIC_NAME>, <ARGUMENT_COUNT>, <EXCEPTION_NAME>,
 *         <FORMAT_STRING>)
 *
 * where ;
 * <SYMBOLIC_NAME> is a legal C identifer that will be used in the
 * JS engine source.
 *
 * <ARGUMENT_COUNT> is an integer literal specifying the total number of
 * replaceable arguments in the following format string.
 *
 * <EXCEPTION_NAME> is an enum JSExnType value, defined in js/ErrorReport.h.
 *
 * <FORMAT_STRING> is a string literal, optionally containing sequences
 * {X} where X  is an integer representing the argument number that will
 * be replaced with a string value when the error is reported.
 *
 * e.g.
 *
 * MSG_DEF(JSMSG_NOT_A_SUBSPECIES, 2, JSEXN_TYPEERROR,
 *         "{0} is not a member of the {1} family")
 *
 * can be used:
 *
 * JS_ReportErrorNumberASCII(JSMSG_NOT_A_SUBSPECIES, "Rhino", "Monkey");
 *
 * to report:
 *
 * "TypeError: Rhino is not a member of the Monkey family"
 */

// clang-format off
MSG_DEF(JSMSG_NOT_AN_ERROR,                                    0, JSEXN_ERR, "<Error #0 is reserved>")
MSG_DEF(JSMSG_BUILTIN_CTOR_NO_NEW,                             1, JSEXN_TYPEERR, "calling a builtin {0} constructor without new is forbidden")
MSG_DEF(JSMSG_ILLEGAL_CTOR,                                    0, JSEXN_TYPEERR, "Illegal constructor")
MSG_DEF(JSMSG_INVALID_INTERFACE,                               2, JSEXN_TYPEERR, "'{0}' called on an object that does not implement interface {1}")
MSG_DEF(JSMSG_INCOMPATIBLE_INSTANCE,                           2, JSEXN_TYPEERR, "Method {0} called on receiver that's not an instance of {1}")
MSG_DEF(JSMSG_INVALID_BUFFER_ARG,                              2, JSEXN_TYPEERR, "{0} must be of type ArrayBuffer or ArrayBufferView but got \"{1}\"")
MSG_DEF(JSMSG_INVALID_COMPRESSION_FORMAT,                      1, JSEXN_TYPEERR, "'format' has to be \"deflate\", \"deflate-raw\", or \"gzip\", but got \"{0}\"")
// clang-format on
