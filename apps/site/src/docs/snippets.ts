/**
 * The snippets of a documentation page (roadmap 3.4): one run of a module
 * written for each output, from the same short input (ADR 0032). Each is
 * the shortest form that output reads, so a reader can copy it as is.
 */
import { readInput, writeInput } from '@algoviz/recipes';
import { shareFragment } from '@algoviz/spec';

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
 * The snippets of module `id` run on `input`, for a page `depth` folders
 * below the site's root, whose share page is `play/`; `step` is a step of
 * the run that the notes use as their example.
 */
export async function snippetsFor(
  id: string,
  input: unknown,
  depth: number,
  step = '-1',
): Promise<Snippet[]> {
  const text = inputText(input);
  // A notation, or other text the player reads as it is, goes in the
  // attribute; an object goes in inline JSON, as people write it.
  const asText = typeof input === 'string' && readInput(input).ok;
  const player = asText
    ? `<algo-player algorithm="${attribute(id)}" input="${attribute(text)}"></algo-player>`
    : `<algo-player algorithm="${attribute(id)}">\n  <script type="application/json">\n${scriptJson(input).replace(/^/gm, '    ')}\n  </script>\n</algo-player>`;
  const fragment = await shareFragment({
    algorithm: id,
    ...(writeInput(input) === undefined ? {} : { input: writeInput(input)! }),
  });
  const root = '../'.repeat(depth);
  return [
    {
      id: 'web',
      label: 'On a web page',
      code: `<script type="module" src="algoviz-player.js"></script>\n${player}`,
      note: 'The player is one script, the standalone bundle; until it is on a CDN, build it with npm run build -w @algoviz/elements.',
    },
    {
      id: 'typst',
      label: 'In Typst',
      code: `#import "@preview/algoviz:0.1.0": algoviz\n#algoviz(${typstString(id)}, ${typstValue(input)})`,
      note: `Draws the last frame; step: "${step}" draws that step instead.`,
    },
    {
      id: 'latex',
      label: 'In LaTeX',
      code: `\\usepackage{algoviz}\n\\algoviz{${id}}{${latexText(text)}}`,
      note: `Compile with -shell-escape the first time; [step=${step}] picks the step drawn.`,
    },
    {
      id: 'cli',
      label: 'On the command line',
      code: `algoviz export ${id} --input ${shellQuote(text)} --out figures`,
      note: `Writes an SVG of every frame into figures/; --step ${step} writes only that step.`,
    },
    {
      id: 'mcp',
      label: 'To a model, through MCP',
      code: `algoviz_show ${JSON.stringify({ recipe: id, input }, null, 2)}`,
      note: `The call a model makes to show this run in the conversation; "frame": "${step}" opens it on that step.`,
    },
    {
      id: 'link',
      label: 'As a share link',
      code: fragment.ok ? `${root}play/#${fragment.value}` : `${root}play/`,
      note: 'Opens this run in the share page; the run travels in the link after the #.',
    },
  ];
}
