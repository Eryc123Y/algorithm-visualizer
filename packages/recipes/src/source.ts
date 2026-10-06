/** Python source for a recipe, from an indented template literal. */
export function python(code: string): { language: string; code: string } {
  const lines = code.replace(/^\n/, '').trimEnd().split('\n');
  const indent = Math.min(
    ...lines
      .filter((l) => l.trim())
      .map((l) => l.length - l.trimStart().length),
  );
  return {
    language: 'python',
    code: lines.map((l) => l.slice(indent)).join('\n'),
  };
}
