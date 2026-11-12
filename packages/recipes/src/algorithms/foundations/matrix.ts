/**
 * Square matrices of small integers, for the matrix modules: nested
 * arrays, or text with rows separated by semicolons and entries by spaces
 * or commas, such as "1 3; 7 5" (the list notation of ADR 0032, row by
 * row).
 */
import { z } from 'zod';

import { NotationError, parseIn } from '../../notation/error.ts';
import { parseList } from '../../notation/list.ts';

export type Matrix = readonly (readonly number[])[];

/** Entries stay small, so that every product is exact. */
export const MAX_ENTRY = 999;

const Entry = z.int().min(-MAX_ENTRY).max(MAX_ENTRY);

const FORM =
  'rows separated by semicolons, entries by spaces or commas, e.g. "1 3; 7 5"';

/** A square matrix field named `name`, as its rows or as text. */
export function matrixField(name: string, example: Matrix) {
  const rows = z
    .array(z.array(Entry).min(1).max(4))
    .min(1)
    .max(4)
    .superRefine((m, ctx) => {
      m.forEach((row, i) => {
        if (row.length !== m.length)
          ctx.addIssue({
            code: 'custom',
            path: [i],
            message: `${name} must be square: row ${i} has ${row.length} entries, but there are ${m.length} rows`,
          });
      });
    })
    .describe(
      `${name} as its rows, e.g. ${JSON.stringify(example)}; integers from ${-MAX_ENTRY} to ${MAX_ENTRY}.`,
    );
  const text = z
    .string()
    .transform((s, ctx) =>
      parseIn(s, ctx, parseRows, `Write ${name} as ${FORM}.`),
    )
    .pipe(rows)
    .describe(`${name} as text: ${FORM}.`);
  return z.union([text, rows]);
}

/** The rows `text` writes, each in the list notation. */
function parseRows(text: string): number[][] {
  let offset = 0;
  return text.split(';').map((part) => {
    const at = offset;
    offset += part.length + 1;
    if (part.trim() === '')
      throw new NotationError('Expected a row of entries', at);
    try {
      return parseList(part, 'number', Entry);
    } catch (e) {
      if (e instanceof NotationError)
        throw new NotationError(e.problem, at + e.at);
      throw e;
    }
  });
}
