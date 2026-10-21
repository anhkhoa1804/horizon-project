// Host test for audit item I-22: salinity is never derived from EC and missing samples never become zero.
#include "../src/shared/water_salinity.h"
#include <cassert>
#include <cmath>
#include <cstdio>
using namespace horizon;
int main() {
  // 1. Register value passes through as ppt (ppm / 1000), including a genuine zero.
  assert(fabsf(salinityPptFromRegister(true, 61.0f) - 0.061f) < 1e-6f);
  assert(salinityPptFromRegister(true, 0.0f) == 0.0f);
  // 2. Register failure -> missing, whatever the EC would have been (the old code returned EC*0.64).
  assert(std::isnan(salinityPptFromRegister(false, NAN)));
  assert(std::isnan(salinityPptFromRegister(false, 1234.0f)));
  assert(std::isnan(salinityPptFromRegister(true, NAN)));
  // 3. Aggregation ignores missing samples.
  float a[5] = {0.06f, NAN, 0.06f, 0.06f, 0.06f};  // 4 valid -> trimmed mean
  assert(fabsf(filteredAverageFinite(a, 5) - 0.06f) < 1e-6f);
  float b[3] = {NAN, 0.10f, 0.20f};                // 2 valid -> plain mean
  assert(fabsf(filteredAverageFinite(b, 3) - 0.15f) < 1e-6f);
  float c[4] = {NAN, NAN, NAN, NAN};               // none valid -> missing, never 0
  assert(std::isnan(filteredAverageFinite(c, 4)));
  assert(std::isnan(filteredAverageFinite(c, 0)));
  // 4. A genuine zero sample stays zero (not confused with missing).
  float d[4] = {0.0f, 0.0f, 0.0f, 0.0f};
  assert(filteredAverageFinite(d, 4) == 0.0f);
  // 5. Trimmed mean drops one min and one max with >=4 valid values.
  float e[5] = {0.0f, 1.0f, 1.0f, 1.0f, 9.0f};
  assert(fabsf(filteredAverageFinite(e, 5) - 1.0f) < 1e-6f);
  std::puts("water_salinity_host: all assertions passed");
  return 0;
}
