import { resolve } from 'node:path';
import { platform } from 'node:process';

export const isWindows = platform === 'win32';

export function maybeWindowsPath(path) {
  if (!path) return path;
  const resolvedPath = resolve(path);
  if (!isWindows) return resolvedPath;

  // Strip any existing UNC prefix check both the format we add as well as what
  //  the windows API returns when using path.resolve
  let cleanPath = resolvedPath;
  while (cleanPath.startsWith('\\\\?\\') || cleanPath.startsWith('//?/')) {
    cleanPath = cleanPath.substring(4);
  }

  return '//?/' + cleanPath.replace(/\\/g, '/');
}
