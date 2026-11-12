/**
 * Rabin–Karp (ADR 0037; CLRS 32.2). Characters are digits in radix d: 10
 * for a string of digits, 26 for lower-case letters (a = 0). The pattern
 * and each window of the text are read as numbers modulo a prime q; a
 * window whose value equals the pattern's is checked character by
 * character, which tells a valid shift from a spurious hit.
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

/** The radix and digit values of a text and pattern, or undefined. */
export function digitsOf(
  text: string,
  pattern: string,
): { d: number; digit: (c: string) => number } | undefined {
  const all = text + pattern;
  if (/^[0-9]+$/.test(all)) return { d: 10, digit: (c) => Number(c) };
  if (/^[a-z]+$/.test(all))
    return { d: 26, digit: (c) => c.charCodeAt(0) - 97 };
  return undefined;
}

const isPrime = (q: number) => {
  for (let k = 2; k * k <= q; k++) if (q % k === 0) return false;
  return q >= 2;
};

/** Remainder that is never negative. */
const mod = (x: number, q: number) => ((x % q) + q) % q;

export const rabinKarp = defineAlgorithm({
  id: 'rabin-karp',
  title: 'Rabin–Karp',
  topic: 'strings',
  summary:
    'Reads the pattern and each window of the text as numbers modulo a prime, sliding the window in constant time, and checks the characters only where the two numbers agree.',
  input: z
    .strictObject({
      ...MatchFields,
      q: z
        .int()
        .min(2)
        .max(997)
        .default(13)
        .describe('The prime modulus, from 2 to 997 (default 13).'),
    })
    .superRefine(patternFits)
    .superRefine(({ text, pattern, q }, ctx) => {
      if (digitsOf(text, pattern) === undefined)
        ctx.addIssue({
          code: 'custom',
          path: ['text'],
          message:
            'Rabin–Karp reads characters as digits: write the text and pattern in digits only, or in lower-case letters only',
        });
      if (!isPrime(q))
        ctx.addIssue({
          code: 'custom',
          path: ['q'],
          message: `${q} is not a prime`,
        });
    }),
  examples: [
    { text: '2359023141526739921', pattern: '31415', q: 13 },
    { text: 'abracadabra', pattern: 'abra', q: 11 },
  ],
  code: {
    pseudocode: `
      RABIN-KARP-MATCHER(T, P, d, q)
          n = T.length
          m = P.length
          h = d^(m - 1) mod q
          p = 0
          t = 0
          for i = 0 to m - 1
              p = (d · p + P[i]) mod q
              t = (d · t + T[i]) mod q  // @hash
          for s = 0 to n - m
              if p == t  // @window
                  if P[0 .. m - 1] == T[s .. s + m - 1]  // @verify
                      append s to S  // @found
                  else count a spurious hit  // @spurious
              if s < n - m
                  t = (d · (t - T[s] · h) + T[s + m]) mod q  // @roll
          return S  // @done
    `,
    python: `
      def rabin_karp(T, P, d, q):
          n, m = len(T), len(P)
          h = pow(d, m - 1, q)
          p = t = 0
          for i in range(m):
              p = (d * p + P[i]) % q
              t = (d * t + T[i]) % q  # @hash
          shifts = []
          for s in range(n - m + 1):
              if p == t:  # @window
                  if P == T[s:s + m]:  # @verify
                      shifts.append(s)  # @found
                  else:
                      pass  # a spurious hit  # @spurious
              if s < n - m:
                  t = (d * (t - T[s] * h) + T[s + m]) % q  # @roll
          return shifts  # @done
    `,
  },
  run({ text, pattern, q }, trace) {
    const handles = declareMatch(trace, text, pattern);
    const { T } = handles;
    const [n, m] = [text.length, pattern.length];
    const { d, digit } = digitsOf(text, pattern)!;
    const windows = n - m + 1;
    const values = trace.add('hash', {
      kind: 'table',
      place: 'side',
      label: `values mod ${q}`,
      rows: windows + 1,
      columns: 2,
      initial: Array.from({ length: windows + 1 }, () => [null, null]),
      rowLabels: ['p', ...Array.from({ length: windows }, (_, s) => `t${s}`)],
      columnLabels: ['value', 'check'],
    });
    let h = 1;
    for (let k = 1; k < m; k++) h = (h * d) % q;
    let p = 0;
    let t = 0;
    for (let i = 0; i < m; i++) {
      p = mod(d * p + digit(pattern[i]!), q);
      t = mod(d * t + digit(text[i]!), q);
    }
    const window = (s: number) => Array.from({ length: m }, (_, k) => s + k);
    trace.step(
      'hash',
      `Read P and the first window of T as ${m}-digit numbers in radix ${d}, modulo ${q}: p = ${p} and t0 = ${t}. A step of the window will remove its first digit, worth h = ${d} to the power ${m - 1}, modulo ${q}, which is ${h}.`,
    );
    values
      .set({ cell: [0, 0], value: p })
      .set({ cell: [1, 0], value: t })
      .highlight({
        cells: [
          [0, 0],
          [1, 0],
        ],
      });
    T.highlight({ indices: window(0) });
    const found: number[] = [];
    let spurious = 0;
    for (let s = 0; s < windows; s++) {
      trace.step(
        'window',
        t === p
          ? `Shift ${s}: t${s} = ${t} equals p = ${p}, so the characters must be checked.`
          : `Shift ${s}: t${s} = ${t} is not p = ${p}, so shift ${s} is not valid; no character is compared.`,
      );
      T.align({ shift: s }).pointer({ name: 's', index: s });
      T.highlight({ indices: window(s) });
      values.highlight({
        cells: [
          [0, 0],
          [s + 1, 0],
        ],
      });
      if (t === p) {
        let j = 0;
        while (j < m && pattern[j] === text[s + j]) j++;
        const valid = j === m;
        trace.step(
          'verify',
          valid
            ? `The ${m} characters match one by one.`
            : `P[${j}] is ${pattern[j]} but T[${s + j}] is ${text[s + j]}.`,
        );
        for (let k = 0; k <= Math.min(j, m - 1); k++) T.check({ j: k });
        if (valid) {
          trace.step('found', `${s} is a valid shift.`);
          values.set({ cell: [s + 1, 1], value: 'match' });
          record(handles, s, m, found);
        } else {
          trace.step(
            'spurious',
            `The values agree but the strings differ: a spurious hit, and shift ${s} is not valid.`,
          );
          values.set({ cell: [s + 1, 1], value: 'spurious' });
          spurious++;
        }
      }
      if (s < windows - 1) {
        const dropped = digit(text[s]!);
        const added = digit(text[s + m]!);
        const before = t;
        t = mod(d * (t - dropped * h) + added, q);
        trace.step(
          'roll',
          `Slide the window: take away the leading digit ${dropped} times h, shift the rest up one place, and bring in ${added}: t${s + 1} = (${d} · (${before} − ${dropped} · ${h}) + ${added}) mod ${q} = ${t}.`,
        );
        values
          .set({ cell: [s + 2, 0], value: t })
          .highlight({ cells: [[s + 2, 0]] });
        T.highlight({ indices: window(s + 1) });
      }
    }
    trace.step(
      'done',
      `Every window tried: ${shiftsFound(found)}${spurious === 0 ? ', with no spurious hit' : `, after ${spurious} spurious hit${spurious === 1 ? '' : 's'}`}.`,
    );
    T.pointer({ name: 's', index: null });
    return { results: found };
  },
});
