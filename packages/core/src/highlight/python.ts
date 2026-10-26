/**
 * A small Python tokenizer for highlighting. It recognises what teaching
 * code needs (keywords, builtins, names being defined or called, strings
 * with prefixes and triple quotes, f- and t-strings, numbers, comments) and
 * leaves the rest plain. It never fails: unterminated strings end at their
 * line, or for triple quotes at the end of the code.
 */
import type { CodeToken, TokenKind } from './index.ts';
import {
  IDENTIFIER,
  interpolatedEnd,
  isLineBreak,
  lineEnd,
  matchAt,
  plainStringEnd,
  stringStart,
  type StringStart,
} from './python-strings.ts';

const KEYWORDS = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(
    ' ',
  ),
);

const BUILTINS = new Set(
  'abs all any bin bool bytearray bytes callable chr dict divmod enumerate filter float format frozenset getattr hasattr hash hex id input int isinstance issubclass iter len list map max min next object oct open ord pow print range repr reversed round set setattr slice sorted str sum super tuple type zip'.split(
    ' ',
  ),
);

// `1.` but not `1._x`: a dot followed by `_` belongs to an attribute.
const NUMBER =
  /(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.(?:\d[\d_]*)?)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?[jJ]?)/y;
const CALL = /\s*\(/y;

/** What the tokens before a name say about it. */
interface Context {
  /** After `def` or `class`: the name is being defined. */
  readonly defining: boolean;
  /** After `.`: the name is an attribute, never a builtin. */
  readonly afterDot: boolean;
}

const FRESH: Context = { defining: false, afterDot: false };

interface Scanned {
  readonly kind: TokenKind;
  readonly end: number;
  /** The context for the next name, or null to keep the current one. */
  readonly context: Context | null;
  /** An f-string that never ends: scan later ones as plain strings. */
  readonly unclosedFString?: true;
}

function nameKind(name: string, context: Context, called: boolean): TokenKind {
  if (KEYWORDS.has(name)) return 'keyword';
  if (context.defining) return 'function';
  if (!context.afterDot && BUILTINS.has(name)) return 'builtin';
  return called ? 'function' : 'plain';
}

function scanString(
  code: string,
  i: number,
  start: StringStart,
  fStrings: boolean,
): Scanned {
  const body = i + start.length;
  if (fStrings && start.fields) {
    const end = interpolatedEnd(code, body, start);
    if (end !== -1) return { kind: 'string', end, context: FRESH };
    const fallback = plainStringEnd(code, body, start.quote);
    return {
      kind: 'string',
      end: fallback,
      context: FRESH,
      unclosedFString: true,
    };
  }
  const end = plainStringEnd(code, body, start.quote);
  return { kind: 'string', end, context: FRESH };
}

function scanNameOrOther(code: string, i: number, context: Context): Scanned {
  const name = matchAt(IDENTIFIER, code, i)?.[0];
  if (name !== undefined) {
    const end = i + name.length;
    const called = matchAt(CALL, code, end) !== null;
    const defining = name === 'def' || name === 'class';
    return {
      kind: nameKind(name, context, called),
      end,
      context: { defining, afterDot: false },
    };
  }
  const c = code[i]!;
  // Spaces and `\` continuations keep the context for the next name.
  const continuation = c === '\\' && isLineBreak(code[i + 1]);
  const next = c === '.' ? { defining: false, afterDot: true } : FRESH;
  const keep = /\s/.test(c) || continuation;
  return { kind: 'plain', end: i + 1, context: keep ? null : next };
}

function scan(
  code: string,
  i: number,
  context: Context,
  fStrings: boolean,
): Scanned {
  const c = code[i]!;
  if (c === '#')
    return { kind: 'comment', end: lineEnd(code, i), context: FRESH };
  const start = stringStart(code, i);
  if (start !== undefined) return scanString(code, i, start, fStrings);
  // An ellipsis: its dots never start a number.
  if (code.startsWith('...', i))
    return { kind: 'plain', end: i + 3, context: FRESH };
  if (/[\d.]/.test(c) && matchAt(NUMBER, code, i))
    return { kind: 'number', end: NUMBER.lastIndex, context: FRESH };
  return scanNameOrOther(code, i, context);
}

/** Appends a token, merging adjacent plain text. */
function push(tokens: CodeToken[], kind: TokenKind, text: string): void {
  const last = tokens.at(-1);
  if (kind === 'plain' && last?.kind === 'plain')
    tokens[tokens.length - 1] = { kind, text: last.text + text };
  else tokens.push({ kind, text });
}

/** Tokenizes Python source; the token texts concatenate to `code`. */
export function tokenizePython(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let context = FRESH;
  // After an f-string that never ends, later ones are scanned as plain
  // strings, so that inputs full of unclosed f-strings stay linear.
  let fStrings = true;
  for (let i = 0; i < code.length;) {
    const scanned = scan(code, i, context, fStrings);
    push(tokens, scanned.kind, code.slice(i, scanned.end));
    context = scanned.context ?? context;
    if (scanned.unclosedFString) fStrings = false;
    i = scanned.end;
  }
  return tokens;
}
