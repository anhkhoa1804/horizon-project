#pragma once
// Salinity semantics for the water station (audit item I-22). Header-only, no Arduino dependencies,
// so it compiles on the host for tests.
//
// Rules:
//  * Salinity is the probe's own register value (REG_SALINITY_PPM, ppm) divided by 1000 -> ppt.
//  * If that register could not be read, salinity is MISSING (NaN -> "x" on the wire). It is never
//    estimated from EC. (Previously: ecMsCm * 0.64f, an unsupported approximation sent as a reading.)
//  * Minute aggregation ignores missing samples; if no valid sample exists the minute value is missing.
#include <math.h>
#include <stdint.h>

namespace horizon {

static inline float salinityPptFromRegister(bool registerOk, float registerPpm) {
  return (registerOk && isfinite(registerPpm)) ? registerPpm / 1000.0f : NAN;
}

// Trimmed mean over finite samples only (drop min and max when >= 4 valid samples).
static inline float filteredAverageFinite(const float *values, uint8_t count) {
  float sum = 0.0f, lo = 0.0f, hi = 0.0f;
  uint8_t n = 0;
  for (uint8_t i = 0; i < count; i++) {
    if (!isfinite(values[i])) continue;
    if (n == 0) { lo = hi = values[i]; }
    else { if (values[i] < lo) lo = values[i]; if (values[i] > hi) hi = values[i]; }
    sum += values[i];
    n++;
  }
  if (n == 0) return NAN;
  if (n < 4) return sum / n;
  return (sum - lo - hi) / (n - 2);
}

}  // namespace horizon
