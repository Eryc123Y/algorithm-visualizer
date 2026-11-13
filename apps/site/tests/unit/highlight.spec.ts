/**
 * Syntax colour at build time (roadmap 5.6): every language's tokens join
 * back into the code, whatever it is, and mark what a reader scans for.
 *
 * Run the properties bigger with `FUZZ_RUNS=2000 npx vitest run --project
 * site highlight`; replay a failure with its `FUZZ_SEED`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  fillCode,
  highlighted,
  languageOf,
  tokenize,
  type Language,
  type Token,
} from '../../src/docs/highlight.ts';

const settings = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 60),
  ...(process.env['FUZZ_SEED'] === undefined
    ? {}
    : { seed: Number(process.env['FUZZ_SEED']) }),
};

const LANGUAGES: readonly Language[] = [
  'html',
  'typst',
  'latex',
  'shell',
  'json',
  'mcp',
];

/** The tokens of a kind, as text. */
const of = (tokens: readonly Token[], kind: Token['kind']) =>
  tokens.filter((t) => t.kind === kind).map((t) => t.text);

describe('tokens', () => {
  it('join back into any code, in every language', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LANGUAGES),
        fc.string({
          unit: fc.constantFrom(...'<>/"\'=#{}[]\\%:- \nab1._@'.split('')),
          maxLength: 60,
        }),
        (language, code) => {
          const tokens = tokenize(code, language);
          expect(tokens.map((t) => t.text).join('')).toBe(code);
          for (const t of tokens) expect(t.text).not.toBe('');
        },
      ),
      settings,
    );
  });

  it('mark HTML elements, attributes and values', () => {
    const tokens = tokenize(
      '<script type="module" src="a.js"></script>\n<!-- x -->',
      'html',
    );
    expect(of(tokens, 'name')).toEqual(['script', 'script']);
    expect(of(tokens, 'key')).toEqual(['type', 'src']);
    expect(of(tokens, 'string')).toEqual(['"module"', '"a.js"']);
    expect(of(tokens, 'comment')).toEqual(['<!-- x -->']);
  });

  it('mark Typst functions, keys and strings', () => {
    const tokens = tokenize(
      '#import "@preview/algomotion:0.1.0": algomotion\n#algomotion("bst", (from: "8 3", key: 5))',
      'typst',
    );
    expect(of(tokens, 'name')).toEqual(['#import', '#algomotion']);
    expect(of(tokens, 'string')).toEqual([
      '"@preview/algomotion:0.1.0"',
      '"bst"',
      '"8 3"',
    ]);
    expect(of(tokens, 'key')).toEqual(['from', 'key']);
    expect(of(tokens, 'number')).toEqual(['5']);
  });

  it('mark LaTeX commands, arguments and comments, not escapes', () => {
    const tokens = tokenize(
      '\\usepackage{algomotion}\n\\algomotion[steps]{dijkstra}{A-B 4, 50\\%} % note',
      'latex',
    );
    expect(of(tokens, 'name')).toEqual(['\\usepackage', '\\algomotion']);
    expect(of(tokens, 'string')).toEqual(['algomotion', 'dijkstra']);
    expect(of(tokens, 'comment')).toEqual(['% note']);
  });

  it('mark a command, its options and quoted words', () => {
    const tokens = tokenize(
      "algomotion export dijkstra --input 'A-B 4' --out figures # all",
      'shell',
    );
    expect(of(tokens, 'name')).toEqual(['algomotion']);
    expect(of(tokens, 'key')).toEqual(['--input', '--out']);
    expect(of(tokens, 'string')).toEqual(["'A-B 4'"]);
    expect(of(tokens, 'comment')).toEqual(['# all']);
  });

  it('mark JSON keys apart from values, and a tool call’s name', () => {
    const tokens = tokenize(
      'algomotion_show {\n  "recipe": "bst",\n  "n": -1.5e2,\n  "ok": true\n}',
      'mcp',
    );
    expect(of(tokens, 'name')).toEqual(['algomotion_show', 'true']);
    expect(of(tokens, 'key')).toEqual(['"recipe"', '"n"', '"ok"']);
    expect(of(tokens, 'string')).toEqual(['"bst"']);
    expect(of(tokens, 'number')).toEqual(['-1.5e2']);
  });
});

describe('the language of a block', () => {
  it('is read from its first line', () => {
    expect(languageOf('<script type="module"></script>')).toBe('html');
    expect(languageOf('#import "@preview/x:0.1.0": x')).toBe('typst');
    expect(languageOf('#set page(width: 10cm)')).toBe('typst');
    expect(languageOf('\\usepackage{algomotion}')).toBe('latex');
    expect(languageOf('{"a": 1}')).toBe('json');
    expect(languageOf('algomotion_show {\n}')).toBe('mcp');
    expect(languageOf('npm install @algomotion/elements')).toBe('shell');
    expect(languageOf('play/#v=1')).toBeUndefined();
  });
});

describe('rendering', () => {
  it('escapes every token, as the build writes it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LANGUAGES),
        fc.string(),
        (language, code) => {
          document.body.innerHTML = `<code>${highlighted(code, language)}</code>`;
          expect(document.querySelector('code')!.textContent).toBe(code);
          expect(
            [...document.querySelectorAll('code *')].every(
              (el) =>
                el.tagName === 'SPAN' && /^tok-[a-z]+$/.test(el.className),
            ),
          ).toBe(true);
        },
      ),
      settings,
    );
  });

  it('builds the same spans in the browser as the build writes', () => {
    const code = '<algo-player algorithm="bst" input="5 3"></algo-player>';
    document.body.innerHTML = `<code id="a">${highlighted(code, 'html')}</code><code id="b">old</code>`;
    const b = document.querySelector('#b')!;
    fillCode(b, code, 'html');
    expect(b.innerHTML).toBe(document.querySelector('#a')!.innerHTML);
    fillCode(b, '<b>', undefined);
    expect(b.innerHTML).toBe('&lt;b&gt;');
  });
});
