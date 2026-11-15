/**
 * Every module translated so far shows a reader no English in Chinese
 * (ADR 0045): its narration, section and document titles are in Chinese,
 * and its labels, notes and annotations hold no English word but code.
 */
import { describe, expect, it } from 'vitest';

import {
  algorithms,
  runModule,
  summaryOf,
  titleOf,
  type Algorithm,
} from '../src/index.ts';
import { PENDING_ZH } from './zh-pending.ts';

const CJK = /[\u{4e00}-\u{9fff}]/u;
const WORD = /[A-Za-z]{2,}/g;

/** The structure or algorithm a module belongs to: `bst` for `bst.delete`. */
const familyOf = (a: Algorithm) => a.id.split('.')[0]!;

/** Every word of a module's code, in every language: code, not English. */
function codeWords(a: Algorithm): Set<string> {
  const words = Object.values(a.code).flatMap(
    (snippet) => snippet.code.match(WORD) ?? [],
  );
  return new Set(words.map((w) => w.toLowerCase()));
}

/** The text fields a reader sees, outside the code, with where they are. */
function texts(
  node: unknown,
  path = '$',
  out: { path: string; key: string; text: string }[] = [],
) {
  if (Array.isArray(node))
    node.forEach((x, k) => texts(x, `${path}[${k}]`, out));
  else if (node !== null && typeof node === 'object')
    for (const [key, value] of Object.entries(node)) {
      if (key === 'sources' || key === 'source') continue;
      if (
        typeof value === 'string' &&
        ['narration', 'title', 'label', 'text'].includes(key)
      )
        out.push({ path: `${path}.${key}`, key, text: value });
      else texts(value, `${path}.${key}`, out);
    }
  return out;
}

const translated = algorithms.filter((a) => !PENDING_ZH.has(familyOf(a)));

describe('the list of modules still to translate', () => {
  it('names only modules that exist', () => {
    const families = new Set(algorithms.map(familyOf));
    for (const id of PENDING_ZH) expect(families).toContain(id);
  });
});

describe.each(translated.map((a) => [a.id, a] as const))(
  '%s in Chinese',
  (_, algorithm) => {
    it('has a Chinese title and summary', () => {
      expect(titleOf(algorithm, 'zh')).toMatch(CJK);
      expect(summaryOf(algorithm, 'zh')).toMatch(CJK);
    });

    it('shows no English in any example’s run', () => {
      const code = codeWords(algorithm);
      for (const example of algorithm.examples) {
        const run = runModule(algorithm, example, { locale: 'zh' });
        if (!run.ok) throw new Error(JSON.stringify(run.error));
        const english = texts(run.value.document).flatMap(
          ({ path, key, text }) => {
            if (key === 'narration' || key === 'title')
              return CJK.test(text) ? [] : [`${path}: ${text}`];
            const words = (text.match(WORD) ?? []).filter(
              (w) => !code.has(w.toLowerCase()),
            );
            return words.length === 0 ? [] : [`${path}: ${text}`];
          },
        );
        expect(english).toEqual([]);
      }
    });
  },
);
