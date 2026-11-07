/** The input every comparison sort takes. */
import { z } from 'zod';

/** Most values a sorting module takes, so every step stays readable. */
export const MAX_VALUES = 32;

export const SortInput = z.strictObject({
  values: z
    .array(z.number())
    .min(1)
    .max(MAX_VALUES)
    .describe('The numbers to sort, e.g. [5, 3, 8, 1, 9, 2, 7].'),
});
export type SortInput = z.output<typeof SortInput>;

/** The default example of the sorting modules. */
export const SAMPLE: SortInput = { values: [5, 3, 8, 1, 9, 2, 7] };

/** Indices from `lo` to `hi`, both included. */
export const range = (lo: number, hi: number): number[] =>
  Array.from({ length: Math.max(0, hi - lo + 1) }, (_, k) => lo + k);
