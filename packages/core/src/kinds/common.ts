/**
 * Helpers shared by reducers.
 */
import { LIMITS } from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';

const fieldName = (path: readonly PropertyKey[]) =>
  path
    .map((key) => (typeof key === 'number' ? `[${key}]` : String(key)))
    .join('');

/**
 * Checks that the index at each action path is below `limit`. `what` names
 * the structure in messages, e.g. "an array".
 */
export function checkRange(
  what: string,
  length: number,
  limit: number,
  ...indices: readonly (readonly [readonly PropertyKey[], number])[]
): ReduceError | undefined {
  for (const [path, index] of indices) {
    if (index >= limit) {
      return {
        code: 'OUT_OF_RANGE',
        path,
        message: `${fieldName(path)}=${index} is out of range for ${what} of length ${length}`,
        hint:
          limit === 0
            ? `The ${what.replace(/^an? /, '')} is empty.`
            : `Valid values are 0 to ${limit - 1}.`,
      };
    }
  }
  return undefined;
}

export const emptyError = (what: string, operation: string): ReduceError => ({
  code: 'EMPTY',
  path: [],
  message: `Cannot ${operation}: the ${what} is empty`,
  hint: `Only ${operation} when the ${what} has elements.`,
});

/** Rejects growing a structure that already holds `count` elements past the limit. */
export function checkCapacity(
  what: string,
  count: number,
  limit: number = LIMITS.elementsPerStructure,
): ReduceError | undefined {
  if (count < limit) return undefined;
  return {
    code: 'LIMIT_EXCEEDED',
    path: [],
    message: `A ${what} may hold at most ${limit} elements`,
    hint: 'Remove elements before adding more, or visualize a smaller input.',
  };
}

export const notFound = (
  path: readonly PropertyKey[],
  id: string,
  what: string,
): ReduceError => ({
  code: 'NOT_FOUND',
  path,
  message: `No ${what} with id "${id}"`,
  hint: `Refer to an existing ${what}; it may have been removed earlier.`,
});

/** Inserts `item` before position `index`. */
export const insertAt = <T>(
  list: readonly T[],
  index: number,
  item: T,
): T[] => [...list.slice(0, index), item, ...list.slice(index)];

export const removeAt = <T>(list: readonly T[], index: number): T[] =>
  list.filter((_, k) => k !== index);

/** Object without `key`; used for maps of pointers. */
export const without = <V>(
  record: Readonly<Record<string, V>>,
  key: string,
): Record<string, V> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

/**
 * Where an element at position `k` is after a structure changes shape, or
 * undefined if it was removed. Marks that name positions for one step
 * (highlight, compare, swap) use it to stay on the elements they marked.
 */
export type Reindex = (k: number) => number | undefined;

export const afterInsert =
  (at: number): Reindex =>
  (k) =>
    k >= at ? k + 1 : k;

export const afterRemove =
  (at: number): Reindex =>
  (k) =>
    k === at ? undefined : k > at ? k - 1 : k;

/** Moves positions with their elements, dropping those that are gone. */
export const reindex = (positions: readonly number[], f: Reindex): number[] =>
  positions.flatMap((k) => {
    const moved = f(k);
    return moved === undefined ? [] : [moved];
  });

/** Moves a pair of positions, or drops it if either element is gone. */
export function reindexPair(
  pair: readonly [number, number] | null,
  f: Reindex,
): [number, number] | null {
  if (pair === null) return null;
  const [a, b] = [f(pair[0]), f(pair[1])];
  return a === undefined || b === undefined ? null : [a, b];
}
