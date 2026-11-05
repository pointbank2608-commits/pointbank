// Production release opt-in; explicit false remains the operator kill switch.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function learningBuildEnvironment(source) {
  const env = { ...source };
  if (env.VERCEL_ENV === 'production' && env.VITE_LEARNING_SENSORS_ENABLED === undefined) {
    env.VITE_LEARNING_SENSORS_ENABLED = 'true';
  }
  return env;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!process.env.npm_execpath) throw new Error('Run through npm run build:vercel');
  const env = learningBuildEnvironment(process.env);
  console.log(`[learning-sensors] collection in this build: ${env.VITE_LEARNING_SENSORS_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
