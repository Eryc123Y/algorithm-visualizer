/**
 * The operation-list notation (ADR 0032): a data structure's operations,
 * as exercises write them, such as `insert 4, delete 3, search 7`.
 *
 * - Calls are separated by commas or line breaks; empty calls are skipped.
 * - A call is the operation's name, then its arguments separated by
 *   spaces, in the order the operation declares them.
 * - An argument is a number if it reads as one and the argument takes
 *   numbers, otherwise a word.
 */
import { z } from 'zod';

import { NotationError, quoted } from './error.ts';
import { formatNumber, NUMBER } from './list.ts';

/** An operation as the notation needs it: its name and its arguments. */
export interface OperationShape {
  readonly name: string;
  /** Arguments in the order the operation declares them. */
  readonly args: Readonly<Record<string, z.core.$ZodType>>;
}

export type NotatedCall = { readonly op: string } & Record<string, unknown>;

interface Token {
  readonly text: string;
  readonly at: number;
}

/** Reads calls of `operations`; throws a `NotationError`. */
export function parseOperations(
  text: string,
  operations: readonly OperationShape[],
): NotatedCall[] {
  const byName = new Map(operations.map((op) => [op.name, op]));
  return callsOf(text).map((tokens) => {
    const [name, ...args] = tokens as [Token, ...Token[]];
    const op = byName.get(name.text);
    if (op === undefined)
      throw new NotationError(
        `Unknown operation ${quoted(name.text)}; use ${listOf(operations.map((o) => o.name))}`,
        name.at,
      );
    return callOf(op, name, args, text);
  });
}

/** The tokens of each call, skipping empty ones. */
function callsOf(text: string): Token[][] {
  const calls: Token[][] = [];
  let tokens: Token[] = [];
  const pattern = /[^\s,]+|[,\n\r]/g;
  for (const match of text.matchAll(pattern)) {
    if (/^[,\n\r]$/.test(match[0])) {
      if (tokens.length > 0) calls.push(tokens);
      tokens = [];
    } else tokens.push({ text: match[0], at: match.index });
  }
  if (tokens.length > 0) calls.push(tokens);
  return calls;
}

function callOf(
  op: OperationShape,
  name: Token,
  args: readonly Token[],
  text: string,
): NotatedCall {
  const keys = Object.keys(op.args);
  if (args.length > keys.length) {
    const extra = args[keys.length]!;
    throw new NotationError(
      `${quoted(op.name)} takes ${countOf(keys)}, not ${quoted(extra.text)}`,
      extra.at,
    );
  }
  const call: Record<string, unknown> = { op: op.name };
  keys.forEach((key, k) => {
    const schema = op.args[key]!;
    const token = args[k];
    if (token === undefined) {
      if (z.safeParse(schema, undefined).success) return;
      const last = args.at(-1) ?? name;
      throw new NotationError(
        `${quoted(op.name)} needs its ${key} after ${quoted(text.slice(name.at, last.at + last.text.length))}`,
        last.at + last.text.length,
      );
    }
    call[key] = argument(schema, key, token);
  });
  return call as NotatedCall;
}

/** An argument's value: a number where it reads as one and fits. */
function argument(schema: z.core.$ZodType, key: string, token: Token): unknown {
  const asNumber = NUMBER.test(token.text)
    ? z.safeParse(schema, Number(token.text))
    : undefined;
  if (asNumber?.success) return asNumber.data;
  const asWord = z.safeParse(schema, token.text);
  if (asWord.success) return asWord.data;
  // A number's problem, such as a range, if the argument takes numbers at
  // all; otherwise the word's.
  const issue =
    asNumber !== undefined && takesNumbers(schema)
      ? asNumber.error.issues[0]
      : asWord.error.issues[0];
  throw new NotationError(
    `The ${key} ${quoted(token.text)}: ${issue?.message ?? 'invalid'}`,
    token.at,
  );
}

/** Whether some number passes `schema`'s type check, if not its range. */
function takesNumbers(schema: z.core.$ZodType): boolean {
  const probe = z.safeParse(schema, 0);
  return probe.success || probe.error.issues[0]?.code !== 'invalid_type';
}

/**
 * The notation of `calls`, or undefined if one has an argument the
 * notation cannot write: a word with a space or comma, a word that would
 * read as a number, or an argument left out before one that is given.
 */
export function printOperations(
  calls: readonly NotatedCall[],
  operations: readonly OperationShape[],
): string | undefined {
  const byName = new Map(operations.map((op) => [op.name, op]));
  const printed: string[] = [];
  for (const call of calls) {
    const op = byName.get(call.op);
    if (op === undefined) return undefined;
    const tokens = [op.name];
    let gap = false;
    for (const [key, schema] of Object.entries(op.args)) {
      const value = call[key];
      if (value === undefined) {
        gap = true;
        continue;
      }
      const token = tokenOf(value, schema);
      if (gap || token === undefined) return undefined;
      tokens.push(token);
    }
    printed.push(tokens.join(' '));
  }
  return printed.join(', ');
}

function tokenOf(value: unknown, schema: z.core.$ZodType): string | undefined {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value !== 'string' || !/^[^\s,]+$/.test(value)) return undefined;
  // A word that reads as a number the argument takes would come back as one.
  if (NUMBER.test(value) && z.safeParse(schema, Number(value)).success)
    return undefined;
  return value;
}

const countOf = (keys: readonly string[]) =>
  keys.length === 0
    ? 'no arguments'
    : `${keys.length === 1 ? 'one argument' : `${keys.length} arguments`} (${keys.join(', ')})`;

const listOf = (names: readonly string[]) =>
  names.length === 1
    ? names[0]!
    : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
