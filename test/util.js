import { env } from 'node:process';
import { createServer } from 'node:net';

export const DEBUG_TRACING_ENABLED = isEnabledEnvVar(env.DEBUG_TRACING);
export const LOG_DEBUGGING_ENABLED = isEnabledEnvVar(env.LOG_DEBUGGING);
export const DEBUG_TEST_ENABLED = isEnabledEnvVar(env.DEBUG_TEST);

function isEnabledEnvVar(v) {
  return (
    typeof v === 'string' && ['1', 'yes', 'true'].includes(v.toLowerCase())
  );
}

export function maybeLogging(disableFeatures) {
  if (!LOG_DEBUGGING_ENABLED) return disableFeatures;
  if (disableFeatures && disableFeatures.includes('stdio')) {
    disableFeatures.splice(disableFeatures.indexOf('stdio'), 1);
  }
  return disableFeatures;
}
