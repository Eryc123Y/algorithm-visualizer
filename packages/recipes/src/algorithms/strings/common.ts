/**
 * What the string matchers share (ADR 0037): their input, a text of 1 to
 * 24 letters and digits and a pattern of 1 to 10 no longer than it; the
 * text array with the pattern under it; and the side array of the valid
 * shifts found.
 */
import { z } from 'zod';

import type { Trace } from '../../trace.ts';

/** Most characters of the text, and of the pattern. */
export const MAX_TEXT = 24;
export const MAX_PATTERN = 10;

const chars = (max: number, what: string, example: string) =>
  z
    .string()
    .regex(
      new RegExp(`^[A-Za-z0-9]{1,${max}}$`),
      `The ${what} is 1 to ${max} letters and digits`,
    )
    .describe(
      `The ${what}: 1 to ${max} letters and digits, e.g. "${example}".`,
    );

export const MatchFields = {
  text: chars(MAX_TEXT, 'text', 'acaabc'),
  pattern: chars(MAX_PATTERN, 'pattern', 'aab'),
};

/** The pattern fits in the text. */
export function patternFits(
  { text, pattern }: { text: string; pattern: string },
  ctx: z.RefinementCtx,
): void {
  if (pattern.length > text.length)
    ctx.addIssue({
      code: 'custom',
      path: ['pattern'],
      message: `The pattern has ${pattern.length} characters, more than the text's ${text.length}`,
    });
}

export const MatchInput = z.strictObject(MatchFields).superRefine(patternFits);

/** The text with the pattern under it, and the side list of shifts. */
export function declareMatch(trace: Trace, text: string, pattern: string) {
  const T = trace.add('T', {
    kind: 'array',
    label: 'T and P',
    initial: [...text],
    pattern: [...pattern],
  });
  const shifts = trace.add('shifts', {
    kind: 'array',
    place: 'side',
    label: 'valid shifts',
    initial: [],
  });
  return { T, shifts };
}

type Handles = ReturnType<typeof declareMatch>;

/** Records an occurrence at shift `s`: its text settled, `s` listed. */
export function record(
  { T, shifts }: Handles,
  s: number,
  m: number,
  found: number[],
): void {
  for (let k = s; k < s + m; k++) T.settle({ index: k });
  shifts.insert({ index: found.length, element: s });
  found.push(s);
}

/** The closing words: the shifts found, or that there are none. */
export const shiftsFound = (found: readonly number[]) =>
  found.length === 0
    ? 'the pattern does not occur in the text'
    : found.length === 1
      ? `the pattern occurs once, with shift ${found[0]}`
      : `the pattern occurs ${found.length} times, with shifts ${found.slice(0, -1).join(', ')} and ${found.at(-1)}`;
