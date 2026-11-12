/**
 * String matching with a finite automaton (ADR 0037; CLRS 32.3). State q
 * means that the last q characters read are the first q of the pattern.
 * The transition function δ is computed first, one state per step, as a
 * side table; the matcher then reads each text character once, and the
 * pattern is drawn aligned with the q characters the state says match.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  declareMatch,
  MatchFields,
  patternFits,
  record,
  shiftsFound,
} from './common.ts';

/** Most characters the automaton's alphabet holds. */
export const MAX_ALPHABET = 8;

/** The characters of the text and pattern, in order. */
export const alphabetOf = (text: string, pattern: string) =>
  [...new Set(text + pattern)].sort();

/** δ(q, a): the longest prefix of P that is a suffix of P[0 .. q − 1]a. */
function next(pattern: string, q: number, a: string): number {
  const read = pattern.slice(0, q) + a;
  let k = Math.min(pattern.length, q + 1);
  while (!read.endsWith(pattern.slice(0, k))) k--;
  return k;
}

export const finiteAutomatonMatcher = defineAlgorithm({
  id: 'finite-automaton-matcher',
  title: 'String matching with a finite automaton',
  topic: 'strings',
  summary:
    'Builds the automaton whose state is how many characters of the pattern the text read so far ends with, then reads the text once, one transition per character.',
  input: z
    .strictObject(MatchFields)
    .superRefine(patternFits)
    .superRefine(({ text, pattern }, ctx) => {
      const size = alphabetOf(text, pattern).length;
      if (size > MAX_ALPHABET)
        ctx.addIssue({
          code: 'custom',
          path: ['text'],
          message: `The text and pattern use ${size} different characters; the automaton's table takes at most ${MAX_ALPHABET}`,
        });
    }),
  examples: [
    { text: 'abababacaba', pattern: 'ababaca' },
    { text: 'aabaab', pattern: 'aab' },
  ],
  code: {
    pseudocode: `
      COMPUTE-TRANSITION-FUNCTION(P, Σ)
          m = P.length
          for q = 0 to m
              for each character a in Σ
                  k = min(m, q + 1)
                  while P[0 .. k - 1] is not a suffix of P[0 .. q - 1] a
                      k = k - 1
                  δ(q, a) = k  // @delta
          return δ

      FINITE-AUTOMATON-MATCHER(T, δ, m)
          n = T.length
          q = 0
          for i = 0 to n - 1
              q = δ(q, T[i])  // @read
              if q == m
                  append i - m + 1 to S  // @found
          return S  // @done
    `,
    python: `
      def transition_function(P, sigma):
          m = len(P)
          delta = {}
          for q in range(m + 1):
              for a in sigma:
                  k = min(m, q + 1)
                  while not (P[:q] + a).endswith(P[:k]):
                      k -= 1
                  delta[q, a] = k  # @delta
          return delta

      def automaton_matcher(T, delta, m):
          shifts, q = [], 0
          for i in range(len(T)):
              q = delta[q, T[i]]  # @read
              if q == m:
                  shifts.append(i - m + 1)  # @found
          return shifts  # @done
    `,
  },
  run({ text, pattern }, trace) {
    const handles = declareMatch(trace, text, pattern);
    const { T } = handles;
    const [n, m] = [text.length, pattern.length];
    const sigma = alphabetOf(text, pattern);
    const delta = trace.add('delta', {
      kind: 'table',
      place: 'side',
      label: 'δ',
      rows: m + 1,
      columns: sigma.length,
      initial: Array.from({ length: m + 1 }, () => sigma.map(() => null)),
      rowLabels: Array.from({ length: m + 1 }, (_, q) => String(q)),
      columnLabels: sigma,
    });
    const table = Array.from({ length: m + 1 }, (_, q) =>
      sigma.map((a) => next(pattern, q, a)),
    );
    table.forEach((row, q) => {
      const read = q === 0 ? 'nothing yet' : pattern.slice(0, q);
      trace.step(
        'delta',
        `State ${q}: the text read ends with ${read}. After one more character, the state is the longest prefix of P that the text then ends with: ${sigma.map((a, c) => `${a} gives ${row[c]}`).join(', ')}.`,
      );
      row.forEach((k, c) => delta.set({ cell: [q, c], value: k }));
      delta.highlight({ cells: row.map((_, c) => [q, c] as [number, number]) });
    });
    const found: number[] = [];
    let q = 0;
    for (let i = 0; i < n; i++) {
      const c = sigma.indexOf(text[i]!);
      const to = table[q]![c]!;
      trace.step(
        'read',
        `Read T[${i}] = ${text[i]}: δ(${q}, ${text[i]}) = ${to}, so the text read ends with the first ${to} character${to === 1 ? '' : 's'} of P.`,
      );
      delta.highlight({ cells: [[q, c]] });
      q = to;
      T.pointer({ name: 'i', index: i }).align({
        shift: i + 1 - q,
        matched: q,
      });
      if (q === m) {
        const s = i - m + 1;
        trace.step('found', `State ${m} is reached: ${s} is a valid shift.`);
        record(handles, s, m, found);
      }
    }
    trace.step('done', `The text is read once: ${shiftsFound(found)}.`);
    T.pointer({ name: 'i', index: null });
    return { results: found };
  },
});
