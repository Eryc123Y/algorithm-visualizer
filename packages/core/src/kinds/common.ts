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
