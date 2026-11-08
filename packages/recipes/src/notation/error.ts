/**
 * What the notation parsers share (ADR 0032): the error they throw, which
 * points at a token of the text, and how that becomes a Zod issue.
 */
import { z } from 'zod';

/** The diagnostic code of an input written in a notation it breaks. */
export const INVALID_NOTATION = 'INVALID_NOTATION';

/**
 * Keys of a custom Zod issue's `params` that `inputDiagnostics` reads: the
 * diagnostic's code and its hint.
 */
export const CODE_PARAM = 'algovizCode';
export const HINT_PARAM = 'algovizHint';

/** A text that breaks its notation, at a position in it. */
export class NotationError extends Error {
  /** What is wrong, quoting the token, without a position. */
  readonly problem: string;
  /** The offset of the token in the text, from 0; the length for its end. */
  readonly at: number;

  constructor(problem: string, at: number) {
    super(problem);
    this.name = 'NotationError';
    this.problem = problem;
    this.at = at;
  }

  /** The problem and where it is, counted in characters from 1. */
  describe(text: string): string {
    return this.at >= text.length
      ? `${this.problem} (at the end)`
      : `${this.problem} (character ${this.at + 1})`;
  }
}

/** A token as messages quote it. */
export const quoted = (token: string): string => JSON.stringify(token);

/**
 * Runs `parse` on `text` inside a Zod transform: a `NotationError` becomes
 * an `INVALID_NOTATION` issue with `hint`; anything else is a bug.
 */
export function parseIn<T>(
  text: string,
  ctx: z.core.$RefinementCtx<string>,
  parse: (text: string) => T,
  hint: string,
): T {
  try {
    return parse(text);
  } catch (e) {
    if (!(e instanceof NotationError)) throw e;
    ctx.addIssue({
      code: 'custom',
      message: e.describe(text),
      params: { [CODE_PARAM]: INVALID_NOTATION, [HINT_PARAM]: hint },
    });
    return z.NEVER;
  }
}
