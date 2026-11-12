/**
 * The four string matchers (ADR 0037) against independent references:
 * every shift by brute force; π by its definition, tried prefix by
 * prefix; δ built from π, as the KMP automaton, rather than from
 * suffixes; and each Rabin–Karp window's value computed whole with
 * BigInt rather than rolled. Random texts come from small alphabets, so
 * that matches, overlaps and spurious hits happen.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algomotion/core';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** Every shift at which the pattern occurs. */
function shiftsOf(text: string, pattern: string): number[] {
  const out: number[] = [];
  for (let s = 0; s + pattern.length <= text.length; s++)
    if (text.slice(s, s + pattern.length) === pattern) out.push(s);
  return out;
}

/** π by definition: the longest proper prefix that is also a suffix. */
function piOf(p: string): number[] {
  return [...p].map((_, q) => {
    const head = p.slice(0, q + 1);
    for (let k = q; k > 0; k--) if (head.endsWith(p.slice(0, k))) return k;
    return 0;
  });
}

/** δ as the KMP automaton: built from π, not from suffixes. */
function deltaOf(p: string, sigma: readonly string[]): number[][] {
  const pi = piOf(p);
  const rows: number[][] = [];
  for (let q = 0; q <= p.length; q++)
    rows.push(
      sigma.map((a) => {
        if (q < p.length && p[q] === a) return q + 1;
        return q === 0 ? 0 : rows[pi[q - 1]!]![sigma.indexOf(a)]!;
      }),
    );
  return rows;
}

const shiftsDrawn = (trace: Trace) =>
  stateOf(trace, 'shifts', 'array').data.map((e) => e.value);

/** The text positions of every occurrence, settled at the end. */
const settledDrawn = (trace: Trace) => {
  const t = stateOf(trace, 'T', 'array');
  return t.data
    .map((e, k) => (t.marks.settled.includes(e.id) ? k : -1))
    .filter((k) => k >= 0);
};

const covered = (shifts: number[], m: number) =>
  [
    ...new Set(
      shifts.flatMap((s) => Array.from({ length: m }, (_, k) => s + k)),
    ),
  ].sort((a, b) => a - b);

/** A text and a pattern over a few letters, the pattern no longer. */
const textAndPattern = (letters: string) =>
  fc
    .tuple(
      fc.string({
        unit: fc.constantFrom(...letters),
        minLength: 1,
        maxLength: 24,
      }),
      fc.string({
        unit: fc.constantFrom(...letters),
        minLength: 1,
        maxLength: 10,
      }),
    )
    .filter(([t, p]) => p.length <= t.length)
    .map(([text, pattern]) => ({ text, pattern }));

const MATCHERS = [
  'naive-string-matcher',
  'rabin-karp',
  'finite-automaton-matcher',
  'kmp',
];

describe('string matching', () => {
  it('finds CLRS-style examples, overlapping ones included', () => {
    for (const id of MATCHERS) {
      expect(runOk(id, { text: 'acaabc', pattern: 'aab' }).results, id).toEqual(
        [2],
      );
      expect(runOk(id, { text: 'aaaaa', pattern: 'aa' }).results, id).toEqual([
        0, 1, 2, 3,
      ]);
      expect(runOk(id, { text: 'abc', pattern: 'abd' }).results, id).toEqual(
        [],
      );
    }
  });

  it('agree with brute force on random texts', () => {
    fc.assert(
      fc.property(textAndPattern('ab'), ({ text, pattern }) => {
        const want = shiftsOf(text, pattern);
        for (const id of MATCHERS) {
          const { document, results } = runOk(id, { text, pattern });
          expect(results, id).toEqual(want);
          const trace = replay(document);
          expect(shiftsDrawn(trace), id).toEqual(want);
          expect(settledDrawn(trace), id).toEqual(
            covered(want, pattern.length),
          );
        }
      }),
      fuzz,
    );
  });

  it('shows each occurrence with the pattern over it, fully matched', () => {
    fc.assert(
      fc.property(textAndPattern('ab'), ({ text, pattern }) => {
        const want = shiftsOf(text, pattern);
        for (const id of MATCHERS) {
          const trace = replay(runOk(id, { text, pattern }).document);
          const steps = trace.visualization.steps;
          const found = steps.flatMap((step, k) =>
            step.meta?.id === 'found' ? [k + 1] : [],
          );
          expect(found, id).toHaveLength(want.length);
          found.forEach((frame, k) => {
            const p = stateOf(trace, 'T', 'array', frame).pattern!;
            expect(p.shift, `${id} occurrence ${k}`).toBe(want[k]);
            expect(p.matched, `${id} occurrence ${k}`).toHaveLength(
              pattern.length,
            );
          });
          // Every comparison shows the pair it compares.
          steps.forEach((step, k) => {
            if (step.meta?.id !== 'compare') return;
            const p = stateOf(trace, 'T', 'array', k + 1).pattern!;
            expect(p.compared, `${id} step ${k}`).not.toBe(null);
          });
        }
      }),
      fuzz,
    );
  });

  it('computes π as its definition says, drawn beside the text', () => {
    fc.assert(
      fc.property(textAndPattern('abc'), ({ text, pattern }) => {
        const trace = replay(runOk('kmp', { text, pattern }).document);
        expect(stateOf(trace, 'pi', 'array').data.map((e) => e.value)).toEqual(
          piOf(pattern),
        );
      }),
      fuzz,
    );
    // CLRS's example pattern.
    const trace = replay(
      runOk('kmp', { text: 'bacbabababacaab', pattern: 'ababaca' }).document,
    );
    expect(stateOf(trace, 'pi', 'array').data.map((e) => e.value)).toEqual([
      0, 0, 1, 2, 3, 0, 1,
    ]);
  });

  it('builds the same δ as the KMP automaton', () => {
    fc.assert(
      fc.property(textAndPattern('abc'), ({ text, pattern }) => {
        const sigma = [...new Set(text + pattern)].sort();
        const trace = replay(
          runOk('finite-automaton-matcher', { text, pattern }).document,
        );
        expect(stateOf(trace, 'delta', 'table').data).toEqual(
          deltaOf(pattern, sigma),
        );
      }),
      fuzz,
    );
  });

  it('rolls each window to the value computed whole, and counts spurious hits', () => {
    fc.assert(
      fc.property(
        textAndPattern('0123'),
        fc.constantFrom(2, 3, 5, 7, 11, 13),
        ({ text, pattern }, q) => {
          const value = (s: string) => Number(BigInt(s) % BigInt(q));
          const trace = replay(
            runOk('rabin-karp', { text, pattern, q }).document,
          );
          const rows = stateOf(trace, 'hash', 'table').data;
          const p = value(pattern);
          expect(rows[0]![0]).toBe(p);
          const shifts = shiftsOf(text, pattern);
          for (let s = 0; s + pattern.length <= text.length; s++) {
            const t = value(text.slice(s, s + pattern.length));
            expect(rows[s + 1]![0], `t${s}`).toBe(t);
            const verdict =
              t !== p ? null : shifts.includes(s) ? 'match' : 'spurious';
            expect(rows[s + 1]![1], `t${s}`).toBe(verdict);
          }
        },
      ),
      fuzz,
    );
  });

  it('rolls windows of letters in radix 26 too', () => {
    fc.assert(
      fc.property(
        textAndPattern('abc'),
        fc.constantFrom(5, 7, 11, 13),
        ({ text, pattern }, q) => {
          const value = (s: string) =>
            Number(
              [...s].reduce(
                (v, c) => (v * 26n + BigInt(c.charCodeAt(0) - 97)) % BigInt(q),
                0n,
              ),
            );
          const trace = replay(
            runOk('rabin-karp', { text, pattern, q }).document,
          );
          const rows = stateOf(trace, 'hash', 'table').data;
          for (let s = 0; s + pattern.length <= text.length; s++)
            expect(rows[s + 1]![0], `t${s}`).toBe(
              value(text.slice(s, s + pattern.length)),
            );
        },
      ),
      fuzz,
    );
  });

  it('reads letters in radix 26 with a = 0', () => {
    const trace = replay(
      runOk('rabin-karp', { text: 'abracadabra', pattern: 'abra', q: 11 })
        .document,
    );
    // abra = 0·26³ + 1·26² + 17·26 + 0 = 1118, and 1118 mod 11 = 7.
    expect(stateOf(trace, 'hash', 'table').data[0]![0]).toBe(7);
  });

  it('refuses what it cannot match', () => {
    expect(runError('kmp', { text: 'ab', pattern: 'abc' }).message).toMatch(
      /more than the text/,
    );
    expect(
      runError('naive-string-matcher', { text: 'a b', pattern: 'a' }).message,
    ).toMatch(/letters and digits/);
    expect(
      runError('rabin-karp', { text: 'Ab1', pattern: 'b' }).message,
    ).toMatch(/digits only/);
    expect(
      runError('rabin-karp', { text: '123', pattern: '2', q: 12 }).message,
    ).toMatch(/not a prime/);
    expect(
      runError('finite-automaton-matcher', { text: 'abcdefghi', pattern: 'a' })
        .message,
    ).toMatch(/at most 8/);
  });
});
