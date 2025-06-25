import { resolve } from 'node:path';
import { platform } from 'node:process';

/** Whether the current platform is windows */
export const IS_WINDOWS = platform === 'win32';

/** Convert a path that to be usable on windows, if necessary */
export function maybeWindowsPath(path) {
  if (!path) return path;
  const resolvedPath = resolve(path);
  if (!IS_WINDOWS) return resolvedPath;

  // Strip any existing UNC prefix check both the format we add as well as what
  //  the windows API returns when using path.resolve
  let cleanPath = resolvedPath;
  while (cleanPath.startsWith('\\\\?\\') || cleanPath.startsWith('//?/')) {
    cleanPath = cleanPath.substring(4);
  }

  return '//?/' + cleanPath.replace(/\\/g, '/');
}
