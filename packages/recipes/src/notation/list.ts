/**
 * The list notation (ADR 0032): items separated by commas, spaces or
 * both, optionally in square brackets, such as `5 2 4 6 1 3`, `5, 2, 4`
 * or LeetCode's `[4,2,6,1,3,null,7]`.
 */
import { z } from 'zod';

import { NotationError, quoted } from './error.ts';

/**
 * What a list holds: numbers; numbers and `null` for gaps, as in a level
 * order; or words.
 */
export type ListKind = 'number' | 'level' | 'word';

export type ListItem<K extends ListKind> = K extends 'number'
  ? number
  : K extends 'level'
    ? number | null
    : string;

/** A number as JSON writes one. */
export const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

/** A number as the notations write it, `-0` included. */
export const formatNumber = (n: number): string =>
  Object.is(n, -0) ? '-0' : String(n);

/** Reads a number token, or throws at `at`. */
export function numberAt(token: string, at: number, expected: string): number {
  if (!NUMBER.test(token))
    throw new NotationError(`Expected ${expected}, not ${quoted(token)}`, at);
  const n = Number(token);
  if (!Number.isFinite(n))
    throw new NotationError(`The number ${quoted(token)} is too large`, at);
  return n;
}

const SPACE = /\s/;
const SEPARATOR = /[\s,]/;
const TOKEN_END = /[\s,[\]]/;

/**
 * The list `text` writes. Each item is checked with `element` when given,
 * so that an item it rejects is reported at its token. Throws a
 * `NotationError`.
 */
export function parseList<K extends ListKind>(
  text: string,
  kind: K,
  element?: z.core.$ZodType,
): ListItem<K>[] {
  const n = text.length;
  let i = 0;
  while (i < n && SPACE.test(text[i]!)) i++;
  const bracketed = text[i] === '[';
  if (bracketed) i++;
  const items: ListItem<K>[] = [];
  for (;;) {
    while (i < n && SEPARATOR.test(text[i]!)) i++;
    if (i >= n) {
      if (bracketed) throw new NotationError('Expected "]" to end the list', n);
      return items;
    }
    if (text[i] === ']') {
      if (!bracketed)
        throw new NotationError('Unexpected "]": the list has no "["', i);
      return closed(text, i + 1, items);
    }
    if (text[i] === '[')
      throw new NotationError('Unexpected "[": items cannot be lists', i);
    const start = i;
    while (i < n && !TOKEN_END.test(text[i]!)) i++;
    const token = text.slice(start, i);
    const value = itemOf(token, start, kind);
    checkItem(value, token, start, element);
    items.push(value);
  }
}

/** The items, after checking that only spaces follow the "]" at `i - 1`. */
function closed<T>(text: string, i: number, items: T[]): T[] {
  let k = i;
  while (k < text.length && SPACE.test(text[k]!)) k++;
  if (k < text.length)
    throw new NotationError(
      `Expected the end of the list after "]", not ${quoted(tokenAt(text, k))}`,
      k,
    );
  return items;
}

function itemOf<K extends ListKind>(
  token: string,
  at: number,
  kind: K,
): ListItem<K> {
  if (kind === 'word') return token as ListItem<K>;
  if (kind === 'level' && token === 'null') return null as ListItem<K>;
  const expected = kind === 'level' ? 'a number or null' : 'a number';
  return numberAt(token, at, expected) as ListItem<K>;
}

function checkItem(
  value: unknown,
  token: string,
  at: number,
  element: z.core.$ZodType | undefined,
): void {
  if (element === undefined) return;
  const checked = z.safeParse(element, value);
  if (!checked.success)
    throw new NotationError(
      `Item ${quoted(token)}: ${checked.error.issues[0]?.message ?? 'invalid'}`,
      at,
    );
}

/** The token at `i`: up to the next space, comma or bracket. */
export function tokenAt(text: string, i: number): string {
  let k = i + 1;
  while (k < text.length && !TOKEN_END.test(text[k]!)) k++;
  return text.slice(i, k);
}

/**
 * The notation of `items`, separated by ", ", or undefined if a word has
 * a space, a comma or a bracket, which the notation cannot write.
 */
export function printList(
  items: readonly (number | null | string)[],
): string | undefined {
  const tokens: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      if (item === '' || /[\s,[\]]/.test(item)) return undefined;
      tokens.push(item);
    } else tokens.push(item === null ? 'null' : formatNumber(item));
  }
  return tokens.join(', ');
}
