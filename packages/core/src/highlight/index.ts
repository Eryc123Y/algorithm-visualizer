/**
 * Syntax highlighting of `source.code`: code → lines of classified tokens.
 *
 * Highlighting is pure and DOM-free like layout (ADR 0003), so every painter
 * (the player, and later Typst or TikZ output) shows the same classes, and a
 * theme decides how each class looks. Languages without a tokenizer stay
 * plain.
 */
import { tokenizePseudocode } from './pseudocode.ts';
import { tokenizePython } from './python.ts';

/** What a token is, for colouring. Anything unclassified is `plain`. */
export type TokenKind =
  | 'plain'
  | 'keyword'
  | 'builtin'
  | 'function'
  | 'string'
  | 'number'
  | 'comment';

export interface CodeToken {
  readonly kind: TokenKind;
  readonly text: string;
}

/** The tokens of one source line, without the line break. */
export type CodeLine = readonly CodeToken[];

/** Splits a whole source text into tokens; their texts concatenate to it. */
export type Tokenizer = (code: string) => readonly CodeToken[];

// A Map, so that names such as `constructor` never reach Object.prototype.
const tokenizers = new Map<string, Tokenizer>([
  ['pseudocode', tokenizePseudocode],
  ['python', tokenizePython],
  ['py', tokenizePython],
]);

/** Languages with highlighting, by the names `source.language` may use. */
export const highlightedLanguages: readonly string[] = [...tokenizers.keys()];

/**
 * Highlights `code` and splits it into lines at `\n`, as the protocol counts
 * them, so line `k` of the result is line `k + 1` of the source. The `\r` of
 * a CRLF line end is dropped. Unknown languages give one plain token per
 * non-empty line.
 */
export function highlightCode(code: string, language?: string): CodeLine[] {
  const tokenize =
    language === undefined ? undefined : tokenizers.get(language);
  const tokens = tokenize
    ? tokenize(code)
    : [{ kind: 'plain' as const, text: code }];
  return splitLines(tokens);
}

/**
 * Whether one line holds code: something besides spaces and comments. The
 * line is highlighted on its own, so a line inside a string that spans
 * lines counts as code.
 */
export function isCodeLine(line: string, language?: string): boolean {
  return highlightCode(line, language).some((tokens) =>
    tokens.some((t) => t.kind !== 'comment' && t.text.trim() !== ''),
  );
}

/** Cuts tokens at line breaks, dropping the breaks and empty pieces. */
function splitLines(tokens: readonly CodeToken[]): CodeLine[] {
  const lines: CodeToken[][] = [[]];
  for (const { kind, text } of tokens)
    text.split('\n').forEach((piece, k) => {
      if (k > 0) {
        dropCarriageReturn(lines.at(-1)!);
        lines.push([]);
      }
      if (piece !== '') lines.at(-1)!.push({ kind, text: piece });
    });
  return lines;
}

/** Drops the `\r` of a CRLF from the end of a finished line. */
function dropCarriageReturn(line: CodeToken[]): void {
  const last = line.at(-1);
  if (last === undefined || !last.text.endsWith('\r')) return;
  const text = last.text.slice(0, -1);
  if (text === '') line.pop();
  else line[line.length - 1] = { ...last, text };
}
