/**
 * Input written as text (ADR 0032), as the command line, the LaTeX
 * package and the player's `input` attribute receive it:
 *
 * 1. JSON is that value;
 * 2. text that is a JSON object once in braces is that object, so its
 *    outer braces may be left out;
 * 3. other text that starts with `{`, `[` or `"` is a JSON error;
 * 4. any other text is a string, which the input's schema reads as a
 *    notation, such as `5 2 4 6 1 3` or `A-B 4, B-C 2`;
 * 5. empty text is no input, so the algorithm runs on its first example.
 */
import { err, ok, type Diagnostic, type Result } from '@algomotion/spec';

export function readInput(
  text: string,
): Result<unknown, readonly Diagnostic[]> {
  const trimmed = text.trim();
  if (trimmed === '') return ok(undefined);
  let error: unknown;
  try {
    return ok(JSON.parse(trimmed));
  } catch (e) {
    error = e;
  }
  try {
    return ok(JSON.parse(`{${trimmed}}`));
  } catch (e) {
    // Text that starts with a key was meant as an object without braces.
    if (trimmed.startsWith('"')) error = e;
  }
  if (/^[[{"]/.test(trimmed))
    return err([
      {
        code: 'INVALID_JSON',
        path: '$.input',
        message: `The input is not JSON: ${error instanceof Error ? error.message : String(error)}`,
        hint: 'Text that starts with {, [ or " is read as JSON; the braces of an object may be left out. Other text is read as a notation, such as "5 2 4" or "A-B 4, B-C 2".',
      },
    ]);
  return ok(text);
}

/**
 * The text of an input that `readInput` reads back as the same value, for
 * share links (ADR 0040): a string that it reads as itself, such as a
 * notation, stays as it is, so links show `A-B 4, B-C 1`; anything else
 * is written as JSON. No input is no text.
 */
export function writeInput(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') {
    const read = readInput(value);
    if (read.ok && read.value === value) return value;
  }
  return JSON.stringify(value);
}
