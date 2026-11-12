/**
 * LUP decomposition against the definitions. The final table holds L and
 * U, π the permutation, and PA = LU must hold exactly; partial pivoting
 * keeps every multiplier at most 1 in absolute value; the result is det A,
 * checked against the Leibniz formula; a singular matrix is reported; and
 * the solution of Ax = b, when b is given, satisfies it exactly.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  add,
  compareAbs,
  fromInt,
  mul,
  parse,
  rational,
  show,
  type Rational,
} from '../src/algorithms/math/rational.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Matrix = number[][];

/** det A by the Leibniz formula: a sum over every permutation. */
function leibniz(a: Matrix): number {
  const n = a.length;
  const perms = (k: number): number[][] =>
    k === 0
      ? [[]]
      : perms(k - 1).flatMap((p) =>
          Array.from({ length: k }, (_, i) => [
            ...p.slice(0, i),
            k - 1,
            ...p.slice(i),
          ]),
        );
  return perms(n).reduce((sum, p) => {
    let inversions = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) if (p[i]! > p[j]!) inversions++;
    const term = p.reduce((t, c, r) => t * a[r]![c]!, 1);
    return sum + (inversions % 2 === 0 ? term : -term);
  }, 0);
}

const same = (x: Rational, y: Rational) => x.n === y.n && x.d === y.d;

const matrices = fc
  .integer({ min: 1, max: 4 })
  .chain((n) =>
    fc.array(
      fc.array(fc.integer({ min: -9, max: 9 }), { minLength: n, maxLength: n }),
      { minLength: n, maxLength: n },
    ),
  );

/** The final L, U and π of a run that did not stop at a singular column. */
function factors(document: ReturnType<typeof runOk>['document']) {
  const trace = replay(document);
  const cells = stateOf(trace, 'A', 'table').data.map((row) =>
    row.map((c) => parse(String(c))),
  );
  const pi = stateOf(trace, 'pi', 'table').data[0]!.map((v) => Number(v) - 1);
  return { cells, pi, trace };
}

describe('lup-decomposition', () => {
  it('factors the example and finds its determinant', () => {
    const a = [
      [2, 0, 2, 1],
      [3, 3, 4, -2],
      [5, 5, 4, 2],
      [-1, -2, 3, -1],
    ];
    const { document, results } = runOk('lup-decomposition', { a });
    expect(results).toEqual([leibniz(a)]);
    // Rows 3, 1, 4, 2 of A become rows 1 to 4: three exchanges, det A = −104.
    expect(factors(document).pi).toEqual([2, 0, 3, 1]);
    expect(results).toEqual([-104]);
  });

  it('gives PA = LU with multipliers at most 1, and det A', () => {
    fc.assert(
      fc.property(matrices, (a) => {
        const n = a.length;
        const { document, results } = runOk('lup-decomposition', { a });
        expect(results).toEqual([leibniz(a)]);
        const ats = document.steps.map((s) => s.meta?.at);
        if (leibniz(a) === 0) {
          expect(ats.at(-1)).toBe('singular');
          return;
        }
        expect(ats).not.toContain('singular');
        const { cells, pi } = factors(document);
        expect([...pi].sort((x, y) => x - y)).toEqual(
          Array.from({ length: n }, (_, i) => i),
        );
        const l = (i: number, j: number) =>
          i === j ? fromInt(1) : i > j ? cells[i]![j]! : fromInt(0);
        const u = (i: number, j: number) =>
          i <= j ? cells[i]![j]! : fromInt(0);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            if (i > j)
              expect(compareAbs(cells[i]![j]!, fromInt(1))).toBeLessThanOrEqual(
                0,
              );
            let lu = fromInt(0);
            for (let k = 0; k < n; k++) lu = add(lu, mul(l(i, k), u(k, j)));
            expect(show(lu), `(${i}, ${j})`).toBe(
              show(fromInt(a[pi[i]!]![j]!)),
            );
          }
      }),
      fuzz,
    );
  });

  it('solves Ax = b exactly', () => {
    fc.assert(
      fc.property(
        matrices.chain((a) =>
          fc.tuple(
            fc.constant(a),
            fc.array(fc.integer({ min: -9, max: 9 }), {
              minLength: a.length,
              maxLength: a.length,
            }),
          ),
        ),
        ([a, b]) => {
          fc.pre(leibniz(a) !== 0);
          const { document } = runOk('lup-decomposition', { a, b });
          const x = stateOf(replay(document), 'S', 'table').data.map((row) =>
            parse(String(row[2])),
          );
          a.forEach((row, i) => {
            const ax = row.reduce(
              (s, v, j) => add(s, mul(fromInt(v), x[j]!)),
              fromInt(0),
            );
            expect(same(ax, fromInt(b[i]!))).toBe(true);
          });
        },
      ),
      fuzz,
    );
  });

  it('stops at a singular column', () => {
    const { document, results } = runOk('lup-decomposition', {
      a: '1 2; 2 4',
    });
    expect(results).toEqual([0]);
    expect(document.steps.at(-1)!.meta?.narration).toMatch(
      /column 2 at or below the diagonal is 0/,
    );
    expect(runOk('lup-decomposition', { a: '0' }).results).toEqual([0]);
  });

  it('takes A alone, solves 1 × 1, and skips solving when A is singular', () => {
    expect(runOk('lup-decomposition', '5').results).toEqual([5]);
    const one = runOk('lup-decomposition', { a: '4', b: '2' });
    expect(stateOf(replay(one.document), 'S', 'table').data[0]![2]).toBe('1/2');
    const singular = runOk('lup-decomposition', { a: '1 2; 2 4', b: '1 2' });
    expect(singular.results).toEqual([0]);
    expect(singular.document.steps.at(-1)!.meta?.narration).toMatch(
      /nothing to substitute/,
    );
    expect(
      singular.document.steps
        .map((s) => s.meta?.at)
        .filter((x) => x === 'forward'),
    ).toEqual([]);
  });

  it('marks no exchange when every pivot is in place', () => {
    const { document, results } = runOk('lup-decomposition', {
      a: '4 1; 2 3',
    });
    expect(results).toEqual([10]);
    expect(document.steps.map((s) => s.meta?.at)).toEqual([
      'start',
      'pivot',
      'multipliers',
      'update',
      'pivot',
      'done',
    ]);
    expect(document.steps[1]!.meta?.narration).toMatch(/already in place/);
    // π and A after the first column: L's 1/2 and the complement 5/2.
    const after = stateOf(replay(document), 'A', 'table', 4).data;
    expect(after).toEqual([
      ['4', '1'],
      ['1/2', '5/2'],
    ]);
  });

  it('reads b, and refuses one of the wrong length', () => {
    expect(
      runOk('lup-decomposition', { a: '2 1; 1 3', b: '3 4' }).results,
    ).toEqual([5]);
    expect(
      runError('lup-decomposition', { a: '2 1; 1 3', b: '3' }).message,
    ).toMatch(/2 entries/);
  });

  it('writes fractions exactly', () => {
    expect(show(rational(-4n, 6n))).toBe('−2/3');
    expect(same(parse('−2/3'), rational(2n, -3n))).toBe(true);
    expect(show(rational(5n))).toBe('5');
  });
});
