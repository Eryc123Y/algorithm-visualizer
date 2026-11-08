/**
 * What the two hash tables share (ADR 0023): the hash function
 * h(k) = k mod m with a non-negative remainder, and the starting table,
 * given as its size and the keys inserted into it in order.
 */
import { z } from 'zod';
import { listField } from '../../notation/schema.ts';

/** Most buckets or slots a table has, so it fits on one screen. */
export const MAX_SLOTS = 16;

/** k mod m, from 0 to m - 1 even for a negative k. */
export const mod = (k: number, m: number): number => ((k % m) + m) % m;

/** A key: an integer, so that its remainder is a bucket. */
export const Key = z.int();

/** The starting table: its size and the keys inserted in order. */
export const tableFrom = (maxKeys: number, example: string) =>
  z
    .strictObject({
      size: z
        .int()
        .min(1)
        .max(MAX_SLOTS)
        .describe(`The number of slots m, from 1 to ${MAX_SLOTS}.`),
      keys: listField(
        z
          .array(Key)
          .max(maxKeys)
          .describe(`Integer keys inserted in this order, e.g. ${example}.`),
        'number',
      ),
    })
    .describe('The starting table: its size, and the keys inserted into it.');

export interface TableFrom {
  readonly size: number;
  readonly keys: readonly number[];
}
