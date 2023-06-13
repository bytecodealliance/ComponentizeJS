import { float32Param, float64Param, float32Result, float64Result } from 'local:floats/floats';

export const floats = {
  float32Param (x) {
    return float32Param(x);
  },
  float64Param (x) {
    return float64Param(x);
  },
  float32Result () {
    return float32Result();
  },
  float64Result () {
    return float64Result();
  },
};
