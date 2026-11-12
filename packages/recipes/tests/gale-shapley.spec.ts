/**
 * Gale–Shapley against a brute force over every perfect matching: the
 * matching drawn at the end is stable, and it is the best stable matching
 * for every proposer at once. The trace keeps the algorithm's promises:
 * each proposer asks down its list in order, never twice, and there are at
 * most n² − n + 1 proposals. The notation and the checks on the lists are
 * tested too.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { parsePreferences } from '../src/algorithms/graphs/gale-shapley.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Lists = [string, string[]][];

/** Every permutation of `xs`. */
function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]),
  );
}

/** Every stable matching, each as a map from proposer to receiver. */
function stableMatchings(proposers: Lists, receivers: Lists) {
  const pRank = new Map(proposers.map(([p, l]) => [p, l]));
  const rRank = new Map(receivers.map(([r, l]) => [r, l]));
  const ps = proposers.map(([p]) => p);
  return permutations(receivers.map(([r]) => r))
    .map((rs) => new Map(ps.map((p, k) => [p, rs[k]!])))
    .filter((m) => {
      const partnerOf = new Map([...m].map(([p, r]) => [r, p]));
      // No proposer and receiver both prefer each other to their partners.
      return ps.every((p) => {
        const list = pRank.get(p)!;
        return list.slice(0, list.indexOf(m.get(p)!)).every((r) => {
          const theirs = rRank.get(r)!;
          return theirs.indexOf(partnerOf.get(r)!) < theirs.indexOf(p);
        });
      });
    });
}

const lists = fc.integer({ min: 1, max: 5 }).chain((n) => {
  const ps = Array.from({ length: n }, (_, k) => `p${k}`);
  const rs = Array.from({ length: n }, (_, k) => `r${k}`);
  const ranking = (names: string[]) =>
    fc.shuffledSubarray(names, { minLength: n });
  return fc.record({
    proposers: fc
      .tuple(...ps.map(() => ranking(rs)))
      .map((ls) => ps.map((p, k): [string, string[]] => [p, ls[k]!])),
    receivers: fc
      .tuple(...rs.map(() => ranking(ps)))
      .map((ls) => rs.map((r, k): [string, string[]] => [r, ls[k]!])),
  });
});

/** The engaged pairs at the end, as a map from proposer to receiver. */
function matchingOf(document: ReturnType<typeof runOk>['document']) {
  const g = stateOf(replay(document), 'g', 'graph');
  return new Map(
    g.data.edges
      .filter((e) => g.marks.edgeMarks[e.id] === 'selected')
      .map((e) => [e.from, e.to]),
  );
}

describe('gale-shapley', () => {
  it('accepts, trades up and rejects in the example', () => {
    const { document, results } = runOk('gale-shapley', {
      proposers: 'a: x y z, b: x z y, c: y x z',
      receivers: 'x: c b a, y: a c b, z: b a c',
    });
    expect(matchingOf(document)).toEqual(
      new Map([
        ['a', 'y'],
        ['b', 'z'],
        ['c', 'x'],
      ]),
    );
    // a→x; b→x, x leaves a; a→y; c→y, rejected; c→x, x leaves b; b→z.
    expect(results).toEqual([6]);
    expect(document.steps.map((s) => s.meta?.at)).toEqual([
      'start',
      ...['accept', 'trade', 'accept', 'reject', 'trade', 'accept'].flatMap(
        (at) => ['propose', at],
      ),
      'done',
    ]);
  });

  it('gives everyone their first choice when the choices differ', () => {
    const { document, results } = runOk('gale-shapley', {
      proposers: 'a: x y z, b: y x z, c: x z y',
      receivers: 'x: b a c, y: a b c, z: a b c',
    });
    expect(matchingOf(document)).toEqual(
      new Map([
        ['a', 'x'],
        ['b', 'y'],
        ['c', 'z'],
      ]),
    );
    expect(results).toEqual([4]);
  });

  it('finds a stable matching, the best for every proposer', () => {
    fc.assert(
      fc.property(lists, ({ proposers, receivers }) => {
        const { document, results } = runOk('gale-shapley', {
          proposers,
          receivers,
        });
        const got = matchingOf(document);
        const stable = stableMatchings(proposers, receivers);
        expect(
          stable.some((m) => [...m].every(([p, r]) => got.get(p) === r)),
        ).toBe(true);
        for (const [p, list] of proposers) {
          const best = Math.min(...stable.map((m) => list.indexOf(m.get(p)!)));
          expect(list.indexOf(got.get(p)!), p).toBe(best);
        }
        // Each proposer asked a prefix of its list, ending at its partner.
        const n = proposers.length;
        const asked = stateOf(replay(document), 'P', 'table').marks.settled;
        proposers.forEach(([p, list], row) => {
          const cols = asked.filter(([r]) => r === row).map(([, c]) => c);
          expect(cols.sort((a, b) => a - b)).toEqual(
            Array.from({ length: list.indexOf(got.get(p)!) + 1 }, (_, c) => c),
          );
        });
        expect(results[0]).toBeGreaterThanOrEqual(n);
        expect(results[0]).toBeLessThanOrEqual(n * n - n + 1);
      }),
      fuzz,
    );
  });

  it('keeps every step within its action limit with 8 on each side', () => {
    // Every proposer has the same list, and every receiver ranks the
    // proposers in reverse: each later proposer displaces an earlier one,
    // n(n + 1)/2 proposals in all.
    const ps = Array.from({ length: 8 }, (_, k) => `p${k}`);
    const rs = Array.from({ length: 8 }, (_, k) => `r${k}`);
    const { document, results } = runOk('gale-shapley', {
      proposers: ps.map((p) => [p, rs]),
      receivers: rs.map((r) => [r, [...ps].reverse()]),
    });
    expect(results).toEqual([36]);
    for (const step of document.steps)
      expect(step.actions.length).toBeLessThanOrEqual(100);
  });

  it('reads the notation, with or without commas', () => {
    expect(parsePreferences('a: x y, b: y x')).toEqual([
      ['a', ['x', 'y']],
      ['b', ['y', 'x']],
    ]);
    expect(parsePreferences('a:x y b:y x')).toEqual([
      ['a', ['x', 'y']],
      ['b', ['y', 'x']],
    ]);
    expect(() => parsePreferences('x y, a: x y')).toThrow(/name and a colon/);
    expect(() => parsePreferences(':x y')).toThrow(/name and a colon/);
    expect(() => parsePreferences('a:x:y')).toThrow(/cannot contain a colon/);
    expect(
      runOk('gale-shapley', {
        proposers: { a: ['x', 'y'], b: ['y', 'x'] },
        receivers: { x: ['a', 'b'], y: ['b', 'a'] },
      }).results,
    ).toEqual([2]);
  });

  it('refuses lists that do not rank the other side', () => {
    const run = (proposers: string, receivers: string) =>
      runError('gale-shapley', { proposers, receivers }).message;
    expect(run('a: x y, b: y x', 'x: a b')).toMatch(/as many/);
    expect(run('a: x, b: x', 'x: a b, y: a b')).toMatch(/rank y/);
    expect(run('a: x x, b: y x', 'x: a b, y: a b')).toMatch(
      /list names "x" twice/,
    );
    expect(run('a: x z, b: y x', 'x: a b, y: a b')).toMatch(/"z"/);
    expect(run('a: x y, a: y x', 'x: a b, y: a b')).toMatch(/appears twice/);
    expect(run('a: a b, b: a b', 'a: a b, b: a b')).toMatch(/both sides/);
    expect(run('a:, b: y x', 'x: a b, y: a b')).toMatch(/does not rank x/);
    expect(run('abcdefghi: x', 'x: abcdefghi')).toMatch(/1 to 8/);
    const nine = Array.from({ length: 9 }, (_, k) => k);
    expect(
      run(
        nine
          .map((k) => `p${k}: ${nine.map((j) => `r${j}`).join(' ')}`)
          .join(', '),
        nine
          .map((k) => `r${k}: ${nine.map((j) => `p${j}`).join(' ')}`)
          .join(', '),
      ),
    ).toMatch(/8/);
    expect(
      runError('gale-shapley', {
        proposers: { 1: ['x'] },
        receivers: { x: ['1'] },
      }).message,
    ).toMatch(/losing the order/);
  });

  it('points each refusal at the list at fault', () => {
    const at = (proposers: string, receivers: string) =>
      runError('gale-shapley', { proposers, receivers }).path;
    expect(at('a: x z, b: y x', 'x: a b, y: a b')).toBe(
      '$.input.proposers[0][1]',
    );
    expect(at('a: x y, b: y x', 'x: a, y: a b')).toBe(
      '$.input.receivers[0][1]',
    );
    expect(at('a: x! y, b: y x', 'x: a b, y: a b')).toBe(
      '$.input.proposers[0][1][0]',
    );
  });

  it('narrates one pair, and places on the lists', () => {
    const said = (proposers: string, receivers: string) =>
      runOk('gale-shapley', { proposers, receivers }).document.steps.map(
        (s) => s.meta?.narration ?? '',
      );
    expect(said('a: x', 'x: a').at(-1)).toBe(
      'No proposer is free: the engaged pair forms a stable matching, the best one for every proposer, after 1 proposal.',
    );
    const three = said(
      'a: x y z, b: x z y, c: y x z',
      'x: c b a, y: a c b, z: b a c',
    );
    expect(three).toContain(
      'x ranks b second and its partner a third: it leaves a, who is free again, for b.',
    );
    expect(three).toContain(
      'y ranks its partner a first and c second: it rejects c, who stays free.',
    );
    expect(three).toContain(
      'c is free and proposes to x, the second on its list.',
    );
  });
});
