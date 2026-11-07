/**
 * The part of `node:path` the CLI uses, for the standalone executable,
 * with the results of `node:path/posix`. Backslashes also separate, as on
 * Windows, which accepts `/` in paths too; `join` writes `/`.
 */
const isSeparator = (c: string | undefined) => c === '/' || c === '\\';

/** Resolves `.` and `..` in segments, as `normalize` does. */
function resolveSegments(path: string, keepUp: boolean): string {
  const out: string[] = [];
  for (const segment of path.split(/[/\\]+/)) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out.at(-1) !== '..') out.pop();
      else if (keepUp) out.push('..');
    } else out.push(segment);
  }
  return out.join('/');
}

/** `normalize` of `node:path/posix`, for both separators. */
function normalize(path: string): string {
  if (path === '') return '.';
  const absolute = isSeparator(path[0]);
  const trailing = isSeparator(path.at(-1));
  const body = resolveSegments(path, !absolute);
  if (body === '') return absolute ? '/' : trailing ? './' : '.';
  return `${absolute ? '/' : ''}${body}${trailing ? '/' : ''}`;
}

export function join(...parts: readonly string[]): string {
  const joined = parts.filter((p) => p !== '').join('/');
  return joined === '' ? '.' : normalize(joined);
}

/** The path without separators at its end, unless it is all separators. */
function trimmed(path: string): string {
  let end = path.length;
  while (end > 1 && isSeparator(path[end - 1])) end--;
  return path.slice(0, end);
}

/** Where the last segment of a trimmed path starts. */
const lastSegment = (path: string) =>
  Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1;

export function basename(path: string, extension = ''): string {
  const t = trimmed(path);
  const base = t.length === 1 && isSeparator(t) ? '' : t.slice(lastSegment(t));
  return extension !== '' && base !== extension && base.endsWith(extension)
    ? base.slice(0, -extension.length)
    : base;
}

export function extname(path: string): string {
  const base = basename(path);
  const dot = base.lastIndexOf('.');
  return dot <= 0 || base === '..' ? '' : base.slice(dot);
}

/** Everything before the last segment's separator, as Node keeps it. */
export function dirname(path: string): string {
  if (path === '') return '.';
  const t = trimmed(path);
  const start = lastSegment(t);
  // No separator: a name in the current directory.
  if (start === 0) return '.';
  if (start === 1) return t[0]!;
  return t.slice(0, start - 1);
}
