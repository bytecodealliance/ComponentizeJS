import { float32Param, float64Param, float32Result, float64Result } from 'local:floats/floats';

export const floats = {
  float32Param (x) {
    if (x === 3)
      return float32Param(3);
    return float32Param(x);
  },
  float64Param (x) {
    if (x === 3)
      return float64Param(3);
    return float64Param(x);
  },
  float32Result () {
    return float32Result();
  },
  float64Result () {
    return float64Result();
  },
  float64Result2 () {
    return 3;
  },
  float32Result2 () {
    return 3;
  },
};
