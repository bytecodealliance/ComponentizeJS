import { env } from 'node:process';
import { spawn } from 'node:child_process';

async function main() {
  if (env.PREPACK_SKIP_BUILD) {
    console.error(`SKIP_BUILD set, skipping prepack build step`);
    return;
  }
  await spawn('npm', ['run', 'build'], { stdio: 'inherit' });
}

await main();
