/**
 * A tokenizer for pseudocode in CLRS conventions (ADR 0017): keywords such
 * as `for … to`, `while` and `elseif`, the constants `NIL`, `TRUE` and
 * `FALSE`, procedure names in capitals joined by hyphens
 * (`INSERTION-SORT`), numbers, strings and `//` comments. Everything else,
 * including operators, is plain.
 *
 * It never fails and stays linear: every scan moves forward, and strings
 * and comments end at their line.
 */
import type { CodeToken, TokenKind } from './index.ts';

const KEYWORDS = new Set(
  'and downto each else elseif error for if in not or repeat return to until while'.split(
    ' ',
  ),
);

const CONSTANTS = new Set(['NIL', 'TRUE', 'FALSE']);

// Names in any script, as in `v.π`; digits and `_` after the first letter.
const NAME = /[\p{L}_][\p{L}\p{N}_]*/uy;
const CAPITALS = /^[A-Z][A-Z0-9]*$/;
const NUMBER = /\d+(?:\.\d+)?/y;

function matchAt(re: RegExp, code: string, i: number): string | undefined {
  re.lastIndex = i;
  return re.exec(code)?.[0];
}

/** The end of a string that starts at `i`: its closing quote, or the line end. */
function stringEnd(code: string, i: number): number {
  for (let j = i + 1; j < code.length; j++) {
    const c = code[j];
    if (c === '"') return j + 1;
    if (c === '\n' || c === '\r') return j;
    // An escape keeps the next character, unless it ends the line.
    if (c === '\\' && code[j + 1] !== '\n' && code[j + 1] !== '\r') j++;
  }
  return code.length;
}

function lineEnd(code: string, i: number): number {
  let j = i;
  while (j < code.length && code[j] !== '\n' && code[j] !== '\r') j++;
  return j;
}

/**
 * Extends a name in capitals over `-PART`s in capitals, so `B-TREE-INSERT`
 * is one name; `MAX-1` stops before the minus.
 */
function capitalsEnd(code: string, end: number): number {
  for (;;) {
    if (code[end] !== '-') return end;
    const part = matchAt(NAME, code, end + 1);
    if (part === undefined || !CAPITALS.test(part)) return end;
    end += 1 + part.length;
  }
}

interface Scanned {
  readonly kind: TokenKind;
  readonly end: number;
}

/**
 * Whether capitals joined by hyphens name a procedure: some part has two
 * letters, so that `PARENT` and `B-TREE` do, but the variables `A`, `L1`
 * and `A-B` (A minus B) do not.
 */
const isProcedure = (name: string) =>
  name.split('-').some((part) => part.replace(/[0-9]/g, '').length >= 2);

/** A name, which after a `.` is an attribute and always plain. */
function scanName(
  code: string,
  i: number,
  name: string,
  afterDot: boolean,
): Scanned {
  const end = i + name.length;
  if (afterDot) return { kind: 'plain', end };
  if (KEYWORDS.has(name)) return { kind: 'keyword', end };
  if (!CAPITALS.test(name)) return { kind: 'plain', end };
  const procedureEnd = capitalsEnd(code, end);
  if (procedureEnd === end && CONSTANTS.has(name))
    return { kind: 'keyword', end };
  // Otherwise every part has one letter, so none is a keyword or a
  // constant, and the run is plain; taking it whole keeps the scan linear.
  const kind = isProcedure(code.slice(i, procedureEnd)) ? 'function' : 'plain';
  return { kind, end: procedureEnd };
}

function scan(code: string, i: number, afterDot: boolean): Scanned {
  const c = code[i]!;
  if (code.startsWith('//', i))
    return { kind: 'comment', end: lineEnd(code, i) };
  if (c === '"') return { kind: 'string', end: stringEnd(code, i) };
  if (c === '∞') return { kind: 'number', end: i + 1 };
  const number = matchAt(NUMBER, code, i);
  if (number !== undefined) return { kind: 'number', end: i + number.length };
  const name = matchAt(NAME, code, i);
  if (name !== undefined) return scanName(code, i, name, afterDot);
  // A character outside the basic plane is two code units; keep them together.
  const width = (code.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
  return { kind: 'plain', end: i + width };
}

/** Appends a token, merging adjacent plain text. */
function push(tokens: CodeToken[], kind: TokenKind, text: string): void {
  const last = tokens.at(-1);
  if (kind === 'plain' && last?.kind === 'plain')
    tokens[tokens.length - 1] = { kind, text: last.text + text };
  else tokens.push({ kind, text });
}

/** Tokenizes pseudocode; the token texts concatenate to `code`. */
export function tokenizePseudocode(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let afterDot = false;
  for (let i = 0; i < code.length;) {
    const { kind, end } = scan(code, i, afterDot);
    const text = code.slice(i, end);
    push(tokens, kind, text);
    afterDot = text === '.';
    i = end;
  }
  return tokens;
}
