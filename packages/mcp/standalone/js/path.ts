/**
 * The part of `node:path` the CLI uses, for the standalone executable.
 * Paths get the results of `node:path/posix`, and on Windows those of
 * `node:path/win32` in what matters to the CLI: backslashes separate too,
 * and a drive (`C:`) or a share (`\\server\share`) stays at the front.
 * `join` writes `/`, which Windows accepts.
 */
const isSeparator = (c: string | undefined) => c === '/' || c === '\\';

/** A Windows drive or UNC share at the front of a path, or nothing. */
const PREFIX = /^(?:[A-Za-z]:|[/\\]{2}[^/\\]+[/\\][^/\\]+)/;

/** Splits off the drive or share, which `..` never removes. */
function split(path: string): { prefix: string; rest: string } {
  const prefix = PREFIX.exec(path)?.[0] ?? '';
  return { prefix, rest: path.slice(prefix.length) };
}

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

/** `normalize` of `node:path/posix`, keeping a drive or share in front. */
function normalize(path: string): string {
  const parts = split(path);
  // Written with /, as join writes every separator.
  const prefix = parts.prefix.replaceAll('\\', '/');
  const { rest } = parts;
  // A share is a root; a bare drive (`C:out`) is relative to its directory.
  const absolute = isSeparator(rest[0]) || prefix.length > 2;
  const trailing = isSeparator(rest.at(-1));
  const body = resolveSegments(rest, !absolute);
  if (body === '')
    return (
      prefix + (absolute ? '/' : prefix !== '' ? '' : trailing ? './' : '.')
    );
  return `${prefix}${absolute ? '/' : ''}${body}${trailing ? '/' : ''}`;
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
  const t = trimmed(split(path).rest);
  const base =
    t === '' || (t.length === 1 && isSeparator(t))
      ? ''
      : t.slice(lastSegment(t));
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
  const { prefix, rest } = split(path);
  const t = trimmed(rest);
  const start = lastSegment(t);
  // No separator: a name in the current directory, or in the drive's.
  if (start === 0) return prefix === '' ? '.' : prefix;
  // The root, of the drive or share if there is one.
  if (start === 1) return prefix + t[0]!;
  return prefix + t.slice(0, start - 1);
}
