/**
 * Syntax colour for the site's code blocks (roadmap 5.6), at build time
 * and without a runtime highlighter: a small tokenizer for each language
 * the site shows (HTML, Typst, LaTeX, shell, JSON, and an MCP call, a
 * tool's name and its JSON). It returns tokens, so the build writes them
 * as escaped spans and the browser builds the same spans with DOM calls
 * when the playground changes a snippet. Tokens always join back into the
 * code they came from.
 */

export type Language = 'html' | 'typst' | 'latex' | 'shell' | 'json' | 'mcp';

/**
 * What a token is, as a class: `name` is what the line is about (an
 * element, a command, a function, a program), `key` an attribute or a
 * key, `string` the values a reader writes, `comment` and `number`.
 */
export type TokenKind = 'name' | 'key' | 'string' | 'number' | 'comment';

export interface Token {
  readonly text: string;
  readonly kind?: TokenKind;
}

interface Rule {
  readonly pattern: RegExp;
  /** The kind of each capture group, in order; none for plain text. */
  readonly kinds: readonly (TokenKind | undefined)[];
}

const rule = (pattern: RegExp, ...kinds: (TokenKind | undefined)[]): Rule => ({
  pattern: new RegExp(pattern.source, 'y'),
  kinds,
});

const JSON_RULES: readonly Rule[] = [
  rule(/("(?:[^"\\\n]|\\.)*")(\s*:)/, 'key', undefined),
  rule(/("(?:[^"\\\n]|\\.)*")/, 'string'),
  rule(/(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/, 'number'),
  rule(/(true|false|null)\b/, 'name'),
];

const RULES: Readonly<Record<Language, readonly Rule[]>> = {
  html: [
    rule(/(<!--[\s\S]*?-->)/, 'comment'),
    rule(/(<\/?)([A-Za-z][\w-]*)/, undefined, 'name'),
    rule(/(\s)([A-Za-z_:][\w:.-]*)(=)/, undefined, 'key', undefined),
    rule(/("[^"]*"|'[^']*')/, 'string'),
  ],
  typst: [
    rule(/(\/\/[^\n]*)/, 'comment'),
    rule(/(#[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*)/, 'name'),
    rule(/([A-Za-z_][\w-]*)(:)(?!\/)/, 'key', undefined),
    rule(/("(?:[^"\\\n]|\\.)*")/, 'string'),
    rule(/(-?\d+(?:\.\d+)?(?:pt|em|cm|mm|in|%)?)\b/, 'number'),
  ],
  latex: [
    rule(/((?<!\\)%[^\n]*)/, 'comment'),
    rule(/(\\[A-Za-z@]+)/, 'name'),
    rule(/(\\.)/, undefined),
    // The argument after a command's name, or a key's value in [...].
    rule(/(\{)([^{}\\\n]*)(\})/, undefined, 'string', undefined),
    rule(/(\[)([A-Za-z-]+)(=)/, undefined, 'key', undefined),
  ],
  shell: [
    rule(/(#[^\n]*)/, 'comment'),
    rule(/((?:^|(?<=\n))[A-Za-z][\w.-]*)/, 'name'),
    rule(/('[^']*'|"(?:[^"\\]|\\.)*")/, 'string'),
    rule(/(\s)(--?[A-Za-z][\w-]*)/, undefined, 'key'),
  ],
  json: JSON_RULES,
  mcp: [rule(/((?:^|(?<=\n))[a-z_]+)(?=\s)/, 'name'), ...JSON_RULES],
};

/** `code` as tokens of `language`; joined, they are `code` again. */
export function tokenize(code: string, language: Language): Token[] {
  const rules = RULES[language];
  const tokens: Token[] = [];
  let plain = '';
  const push = (text: string, kind?: TokenKind) => {
    if (text === '') return;
    if (kind === undefined) {
      plain += text;
      return;
    }
    if (plain !== '') tokens.push({ text: plain });
    plain = '';
    tokens.push({ text, kind });
  };
  let at = 0;
  outer: while (at < code.length) {
    for (const { pattern, kinds } of rules) {
      pattern.lastIndex = at;
      const match = pattern.exec(code);
      if (match === null || match[0] === '') continue;
      kinds.forEach((kind, k) => push(match[k + 1] ?? '', kind));
      at += match[0].length;
      continue outer;
    }
    push(code[at]!);
    at++;
  }
  if (plain !== '') tokens.push({ text: plain });
  return tokens;
}

/**
 * The language of a code block, by its first line: markup, a Typst or a
 * LaTeX line, JSON, an MCP call or a command. Undefined for anything
 * else, such as an address, which is shown plain.
 */
export function languageOf(code: string): Language | undefined {
  const first = code.trimStart();
  if (first.startsWith('<')) return 'html';
  if (/^#(import|set|show|let|[A-Za-z_][\w-]*\()/.test(first)) return 'typst';
  if (first.startsWith('\\') || first.startsWith('%')) return 'latex';
  if (/^[[{]/.test(first)) return 'json';
  if (/^[a-z]+_[a-z_]+\s+[[{]/.test(first)) return 'mcp';
  if (
    /^(algomotion|npm|npx|node|typst|latexmk|pdflatex|lualatex|cd|git|curl|wrangler|claude|codex)\b/.test(
      first,
    )
  )
    return 'shell';
  return undefined;
}

/** Escapes text for an element's content. */
const escape = (value: string): string =>
  value.replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!,
  );

/**
 * `code` as the content of a `<code>` element: its tokens as escaped
 * text, each kind in a `tok-<kind>` span. Plain text without a language.
 */
export function highlighted(code: string, language?: Language): string {
  if (language === undefined) return escape(code);
  return tokenize(code, language)
    .map((t) =>
      t.kind === undefined
        ? escape(t.text)
        : `<span class="tok-${t.kind}">${escape(t.text)}</span>`,
    )
    .join('');
}

/** Fills `element` with `code`'s tokens as text and spans, no markup. */
export function fillCode(
  element: Element,
  code: string,
  language?: Language,
): void {
  const doc = element.ownerDocument;
  if (language === undefined) {
    element.textContent = code;
    return;
  }
  element.replaceChildren(
    ...tokenize(code, language).map((t) => {
      if (t.kind === undefined) return t.text;
      const span = doc.createElement('span');
      span.className = `tok-${t.kind}`;
      span.textContent = t.text;
      return span;
    }),
  );
}
