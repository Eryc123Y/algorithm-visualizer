/**
 * The snippets of a documentation page (roadmap 3.4): one run of a module
 * written for each output, from the same short input (ADR 0032). Each is
 * the shortest form that output reads, so a reader can copy it as is.
 */
import { readInput, writeInput } from '@algomotion/recipes';
import { shareFragment } from '@algomotion/spec';

import type { Locale } from './locale.ts';
import { CHROME } from './text/chrome.ts';
import { SNIPPET_NOTES } from './text/snippets.ts';

export interface Snippet {
  readonly id: 'web' | 'typst' | 'latex' | 'cli' | 'mcp' | 'link';
  /** Where the snippet goes, as a heading. */
  readonly label: string;
  readonly code: string;
  /** One sentence on what else it needs. */
  readonly note: string;
}

const isFields = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * An input as text (ADR 0032, section 4): a notation as it is, an object
 * as JSON without its outer braces, anything else as JSON.
 */
export function inputText(input: unknown): string {
  if (isFields(input) && Object.keys(input).length > 0)
    return Object.entries(input)
      .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
      .join(', ');
  return writeInput(input) ?? '';
}

/** Typst's keywords, which a dictionary key must quote. */
const TYPST_KEYWORDS = new Set([
  'none',
  'auto',
  'true',
  'false',
  'not',
  'and',
  'or',
  'in',
  'let',
  'set',
  'show',
  'context',
  'if',
  'else',
  'for',
  'while',
  'break',
  'continue',
  'return',
  'import',
  'include',
  'as',
]);

/** A JSON value as a Typst value: strings, arrays and dictionaries. */
export function typstValue(value: unknown): string {
  if (value === null || value === undefined) return 'none';
  if (typeof value === 'string') return typstString(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (Array.isArray(value)) {
    const items = value.map(typstValue);
    return items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`;
  }
  const pairs = Object.entries(value as Record<string, unknown>).map(
    ([key, v]) =>
      `${/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) && !TYPST_KEYWORDS.has(key) ? key : typstString(key)}: ${typstValue(v)}`,
  );
  return pairs.length === 0 ? '(:)' : `(${pairs.join(', ')})`;
}

const typstString = (text: string): string =>
  `"${text.replace(/[\\"\n\r\t]/g, (c) => TYPST_ESCAPES[c]!)}"`;

const TYPST_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/**
 * Input text as the LaTeX package's argument: `%` and `#` escaped, and
 * braces too when they would not pair up as TeX needs.
 */
export function latexText(text: string): string {
  const escaped = text.replace(/[%#]/g, (c) => `\\${c}`);
  return balanced(text) ? escaped : escaped.replace(/[{}]/g, (c) => `\\${c}`);
}

/** Whether every brace closes one opened before it. */
function balanced(text: string): boolean {
  let depth = 0;
  for (const c of text) {
    if (c === '{') depth++;
    else if (c === '}' && --depth < 0) return false;
  }
  return depth === 0;
}

/** Text as one word of a POSIX shell. */
export const shellQuote = (text: string): string =>
  `'${text.replaceAll("'", "'\\''")}'`;

const attribute = (text: string): string =>
  text.replace(
    /[&"<]/g,
    (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;' })[c]!,
  );

/** JSON that cannot close the `<script>` element it sits in. */
const scriptJson = (value: unknown): string =>
  JSON.stringify(value, null, 2).replaceAll('<', '\\u003c');

/**
 * A Beamer frame that shows module `id`, titled `title`, on the input
 * `text`, one overlay per step, in `locale`.
 */
export const slidesCode = (
  title: string,
  id: string,
  text: string,
  locale: Locale = 'en',
): string =>
  `\\begin{frame}{${latexText(title)}}
  \\centering
  \\algomotion[steps${locale === 'en' ? '' : `, lang=${locale}`}]{${id}}{${latexText(text)}}
\\end{frame}`;

/**
 * The snippets of module `id` run on `input`, for a page `depth` folders
 * below the site's root, whose share page is `play/`; `step` is a step of
 * the run that the notes use as their example. Outside English, each
 * snippet asks its output for `locale` (ADR 0045), and its heading and
 * note are in that language.
 */
export async function snippetsFor(
  id: string,
  input: unknown,
  depth: number,
  step = '-1',
  locale: Locale = 'en',
): Promise<Snippet[]> {
  const text = inputText(input);
  const lang = locale === 'en' ? undefined : locale;
  // A notation, or other text the player reads as it is, goes in the
  // attribute; an object goes in inline JSON, as people write it.
  const asText = typeof input === 'string' && readInput(input).ok;
  const langAttribute = lang === undefined ? '' : ` lang="${lang}"`;
  const player = asText
    ? `<algo-player algorithm="${attribute(id)}" input="${attribute(text)}"${langAttribute}></algo-player>`
    : `<algo-player algorithm="${attribute(id)}"${langAttribute}>\n  <script type="application/json">\n${scriptJson(input).replace(/^/gm, '    ')}\n  </script>\n</algo-player>`;
  const written = writeInput(input);
  const fragment = await shareFragment({
    algorithm: id,
    ...(written === undefined ? {} : { input: written }),
    ...(lang === undefined ? {} : { lang }),
  });
  const root = '../'.repeat(depth);
  const codes: Readonly<Record<Snippet['id'], string>> = {
    web: `<script type="module" src="algomotion-player.js"></script>\n${player}`,
    typst: `#import "@local/algomotion:1.0.0": algomotion\n#algomotion(${typstString(id)}, ${typstValue(input)}${lang === undefined ? '' : `, lang: ${typstString(lang)}`})`,
    latex: `\\usepackage{algomotion}\n\\algomotion${lang === undefined ? '' : `[lang=${lang}]`}{${id}}{${latexText(text)}}`,
    cli: `algomotion export ${id} --input ${shellQuote(text)}${lang === undefined ? '' : ` --lang ${lang}`} --out figures`,
    mcp: `algomotion_show ${JSON.stringify({ recipe: id, input, ...(lang === undefined ? {} : { locale: lang }) }, null, 2)}`,
    link: fragment.ok ? `${root}play/#${fragment.value}` : `${root}play/`,
  };
  const ids = ['web', 'typst', 'latex', 'cli', 'mcp', 'link'] as const;
  return ids.map((snippet) => ({
    id: snippet,
    label: CHROME[locale].snippets[snippet],
    code: codes[snippet],
    note: SNIPPET_NOTES[locale][snippet](step),
  }));
}
