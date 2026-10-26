/**
 * Lexical pieces of Python shared by the tokenizer: names, line breaks, and
 * where string literals end. Plain strings end at their closing quote; f-
 * and t-strings follow CPython 3.12+, where a replacement field may reuse
 * the quote, nest strings and span lines.
 */

/** A valid prefix (r u b f t br rb fr rf tr rt, any case) and the quote. */
const STRING_START =
  /(?:[rR][bBfFtT]|[bBfFtT][rR]|[rRuUbBfFtT])?('''|"""|'|")/y;
/** Names as CPython reads them: XID_Start or _, then XID_Continue. */
export const IDENTIFIER = /[\p{XID_Start}_]\p{XID_Continue}*/uy;
const LINE_BREAK = /[\r\n]/g;

/** Runs a sticky or global pattern at `at`; it sets the pattern's lastIndex. */
export const matchAt = (pattern: RegExp, code: string, at: number) => {
  pattern.lastIndex = at;
  return pattern.exec(code);
};

export const isLineBreak = (c: string | undefined) => c === '\n' || c === '\r';

/** Index of the next `\n` or `\r`, or the end of the code. */
export function lineEnd(code: string, from: number): number {
  LINE_BREAK.lastIndex = from;
  return LINE_BREAK.exec(code)?.index ?? code.length;
}

/** Index just past the `\` escape at `i`; a `\` before CRLF takes both. */
const skipEscape = (code: string, i: number) =>
  code[i + 1] === '\r' && code[i + 2] === '\n' ? i + 3 : i + 2;

/** The opening of a string literal: its prefix and quote. */
export interface StringStart {
  readonly quote: string;
  /** Length of prefix and quote together. */
  readonly length: number;
  readonly raw: boolean;
  /** f- and t-strings, where `{` opens a replacement field. */
  readonly fields: boolean;
}

/** The string literal that starts at `i`, if one does. */
export function stringStart(code: string, i: number): StringStart | undefined {
  const match = matchAt(STRING_START, code, i);
  if (match === null) return undefined;
  const quote = match[1]!;
  const prefix = match[0].slice(0, -quote.length);
  return {
    quote,
    length: match[0].length,
    raw: /[rR]/.test(prefix),
    fields: /[fFtT]/.test(prefix),
  };
}

/**
 * Index just past a string without fields whose body starts at `bodyStart`.
 * A single-quoted string that never closes ends before its line break; a
 * triple-quoted one at the end of the code.
 */
export function plainStringEnd(
  code: string,
  bodyStart: number,
  quote: string,
): number {
  let i = bodyStart;
  while (i < code.length) {
    if (code[i] === '\\') i = skipEscape(code, i);
    else if (code.startsWith(quote, i)) return i + quote.length;
    else if (quote.length === 1 && isLineBreak(code[i])) return i;
    else i += 1;
  }
  return code.length;
}

/** What the scanner is inside: a string body, a field, or a format spec. */
interface Frame {
  readonly kind: 'string' | 'field' | 'spec';
  /** For strings: the literal's opening. */
  readonly start: StringStart;
  /** For fields and specs: open brackets inside the expression. */
  readonly depth: number;
  /** For fields and specs: stack index of the string they belong to. */
  readonly owner: number;
}

const stringFrame = (start: StringStart): Frame => ({
  kind: 'string',
  start,
  depth: 0,
  owner: 0,
});
const fieldFrame = (start: StringStart, owner: number): Frame => ({
  kind: 'field',
  start,
  depth: 0,
  owner,
});

/** Replaces the innermost frame. */
const setTop = (stack: Frame[], frame: Frame) => {
  stack[stack.length - 1] = frame;
};

function stepString(stack: Frame[], f: Frame, code: string, i: number) {
  const { quote, raw, fields } = f.start;
  const c = code[i];
  if (c === '\\') {
    // Like CPython, `\N{` only starts a name: the quote still ends it.
    if (fields && !raw && code.startsWith('N{', i + 1)) return i + 3;
    // `\{` keeps the brace, which still opens a field.
    if (fields && (code[i + 1] === '{' || code[i + 1] === '}')) return i + 1;
    return skipEscape(code, i);
  }
  if (code.startsWith(quote, i)) {
    stack.pop();
    return i + quote.length;
  }
  if (quote.length === 1 && isLineBreak(c)) {
    stack.pop();
    return i;
  }
  if (fields && c === '{') {
    if (code[i + 1] === '{') return i + 2;
    stack.push(fieldFrame(f.start, stack.length - 1));
    return i + 1;
  }
  return i + 1;
}

function stepField(stack: Frame[], f: Frame, code: string, i: number) {
  const start = stringStart(code, i);
  if (start !== undefined) {
    stack.push(stringFrame(start));
    return i + start.length;
  }
  const c = code[i]!;
  if (c === '#') return lineEnd(code, i);
  if (c === '\\') return skipEscape(code, i);
  // Skip whole names, so a name ending in r, b, f or t never starts a string.
  const name = matchAt(IDENTIFIER, code, i);
  if (name !== null) return i + name[0].length;
  if ('([{'.includes(c)) setTop(stack, { ...f, depth: f.depth + 1 });
  else if (c === ')' || c === ']')
    setTop(stack, { ...f, depth: Math.max(0, f.depth - 1) });
  else if (c === '}') {
    if (f.depth === 0) stack.pop();
    else setTop(stack, { ...f, depth: f.depth - 1 });
  } else if (c === ':' && f.depth === 0) setTop(stack, { ...f, kind: 'spec' });
  return i + 1;
}

function stepSpec(stack: Frame[], f: Frame, code: string, i: number) {
  const c = code[i];
  if (c === '}') stack.pop();
  else if (c === '{') stack.push(fieldFrame(f.start, f.owner));
  else if (c === '\\') return skipEscape(code, i);
  // Spec text is literal, but the owning string's quote still ends it.
  else if (code.startsWith(f.start.quote, i)) {
    stack.length = f.owner;
    return i + f.start.quote.length;
  }
  return i + 1;
}

/**
 * Index just past an f- or t-string whose body starts at `bodyStart`, or -1
 * if it never ends. One pass with an explicit stack, so it is linear.
 */
export function interpolatedEnd(
  code: string,
  bodyStart: number,
  start: StringStart,
): number {
  const stack: Frame[] = [stringFrame(start)];
  let i = bodyStart;
  while (i < code.length) {
    const top = stack.at(-1)!;
    if (top.kind === 'string') i = stepString(stack, top, code, i);
    else if (top.kind === 'field') i = stepField(stack, top, code, i);
    else i = stepSpec(stack, top, code, i);
    if (stack.length === 0) return i;
  }
  return -1;
}
