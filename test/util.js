import { env } from 'node:process';
import { createServer } from 'node:net';

export const DEBUG_TRACING_ENABLED = isEnabledEnvVar(env.DEBUG_TRACING);
export const LOG_DEBUGGING_ENABLED = isEnabledEnvVar(env.LOG_DEBUGGING);
export const WEVAL_TEST_ENABLED = isEnabledEnvVar(env.WEVAL_TEST);
export const DEBUG_TEST_ENABLED = isEnabledEnvVar(env.DEBUG_TEST);

function isEnabledEnvVar(v) {
  return (
    typeof v === 'string' && ['1', 'yes', 'true'].includes(v.toLowerCase())
  );
}

// Utility function for getting a random port
export async function getRandomPort() {
  return await new Promise((resolve) => {
    const server = createServer();
    server.listen(0, function () {
      const port = this.address().port;
      server.on('close', () => resolve(port));
      server.close();
    });
  });
}

export function maybeLogging(disableFeatures) {
  if (!LOG_DEBUGGING_ENABLED) return disableFeatures;
  if (disableFeatures && disableFeatures.includes('stdio')) {
    disableFeatures.splice(disableFeatures.indexOf('stdio'), 1);
  }
  return disableFeatures;
}
