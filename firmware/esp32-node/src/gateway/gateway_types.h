#pragma once

#include <stdint.h>

// This type must live in an included header rather than the .ino file: the
// Arduino build preprocessor generates function prototypes before sketch-level
// declarations, including the prototype for httpPostJson().
enum HttpPostOutcome : uint8_t {
  HTTP_POST_DELIVERED,
  HTTP_POST_TERMINAL_REJECTION,
  HTTP_POST_RETRY,
};
