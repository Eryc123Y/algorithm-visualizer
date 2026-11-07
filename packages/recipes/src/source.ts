/** Code of modules, from indented template literals. */

/**
 * Drops a template literal's first line break and trailing space, and the
 * indentation all its non-blank lines share.
 */
export function dedent(code: string): string {
  const lines = code.replace(/^\n/, '').trimEnd().split('\n');
  const indent = Math.min(
    ...lines
      .filter((l) => l.trim())
      .map((l) => l.length - l.trimStart().length),
  );
  return lines.map((l) => l.slice(indent)).join('\n');
}
