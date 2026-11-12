/**
 * Recurrences of divide and conquer, T(n) = a T(n/b) + f(n) with f(n) a
 * power of n: as text, such as "T(n) = 3T(n/4) + n^2", or as their parts.
 */
import { z } from 'zod';

import { NotationError, parseIn, quoted } from '../../notation/error.ts';

export interface Recurrence {
  /** How many subproblems a call makes, 1 to 4. */
  readonly a: number;
  /** How much smaller each is, 2 to 4. */
  readonly b: number;
  /** The exponent of f(n) = n^d, 0 to 3. */
  readonly d: number;
}

export const LIMITS = { a: 4, b: 4, d: 3 } as const;

const Parts = z
  .strictObject({
    a: z.int().min(1).max(LIMITS.a).describe('Subproblems per call.'),
    b: z.int().min(2).max(LIMITS.b).describe('Each is n/b in size.'),
    d: z
      .int()
      .min(0)
      .max(LIMITS.d)
      .describe('Dividing and combining costs n^d.'),
  })
  .describe('The recurrence T(n) = a T(n/b) + n^d by its parts.');

const FORM =
  'T(n) = a T(n/b) + f(n), where f(n) is 1, n, n^2 or n^3, e.g. "T(n) = 3T(n/4) + n^2"';

/** The recurrence field: its parts, or text. */
export const recurrenceField = z.union([
  z
    .string()
    .transform((s, ctx) => parseIn(s, ctx, parseRecurrence, `Write ${FORM}.`))
    .pipe(Parts)
    .describe(`The recurrence as text: ${FORM}.`),
  Parts,
]);

const PATTERN =
  /^\s*T\s*\(\s*n\s*\)\s*=\s*(\d*)\s*T\s*\(\s*n\s*\/\s*(\d+)\s*\)\s*\+\s*(\S.*?)\s*$/;

/** The parts `text` writes, or a `NotationError`. */
export function parseRecurrence(text: string): Recurrence {
  const match = PATTERN.exec(text);
  if (match === null) {
    const at = /^\s*T\s*\(\s*n\s*\)\s*=/.test(text) ? text.indexOf('=') + 1 : 0;
    throw new NotationError(
      `Expected a recurrence such as "T(n) = 2T(n/2) + n"`,
      at,
    );
  }
  const [, a = '', b = '', f = ''] = match;
  const cost = f.replaceAll(/\s+/g, '');
  const d =
    cost === '1'
      ? 0
      : cost === 'n'
        ? 1
        : /^n\^\d$/.test(cost)
          ? Number(cost.slice(2))
          : cost === 'n²'
            ? 2
            : cost === 'n³'
              ? 3
              : undefined;
  if (d === undefined)
    throw new NotationError(
      `Expected f(n) to be 1, n, n^2 or n^3, not ${quoted(f)}`,
      text.lastIndexOf(f),
    );
  return { a: a === '' ? 1 : Number(a), b: Number(b), d };
}

/** The recurrence as text, e.g. "T(n) = 3T(n/4) + n²". */
export const formatRecurrence = ({ a, b, d }: Recurrence): string =>
  `T(n) = ${a === 1 ? '' : a}T(n/${b}) + ${power(d)}`;

/** n^d as the narrations write it: 1, n, n², n³. */
export const power = (d: number, base = 'n'): string =>
  d === 0 ? '1' : `${base}${['', '', '²', '³'][d]}`;
