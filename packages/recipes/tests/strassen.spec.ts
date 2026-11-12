/**
 * Strassen's method against independent references: C against the plain
 * row-by-column product, and each P against the plain product of its two
 * factors, formed from quadrants directly rather than through S.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algomotion/core';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

type M = number[][];

const multiply = (x: M, y: M): M =>
  x.map((row) =>
    y[0]!.map((_, j) => row.reduce((s, v, k) => s + v * y[k]![j]!, 0)),
  );
const add = (x: M, y: M, sign = 1): M =>
  x.map((row, i) => row.map((v, j) => v + sign * y[i]![j]!));
const quarter = (m: M, q: string): M => {
  const h = m.length / 2;
  const r = q[0] === '1' ? 0 : h;
  const c = q[1] === '1' ? 0 : h;
  return m.slice(r, r + h).map((row) => row.slice(c, c + h));
};

/** P1..P7 from their definitions in quadrants, without S. */
function products(a: M, b: M): M[] {
  const A = (q: string) => quarter(a, q);
  const B = (q: string) => quarter(b, q);
  return [
    multiply(A('11'), add(B('12'), B('22'), -1)),
    multiply(add(A('11'), A('12')), B('22')),
    multiply(add(A('21'), A('22')), B('11')),
    multiply(A('22'), add(B('21'), B('11'), -1)),
    multiply(add(A('11'), A('22')), add(B('11'), B('22'))),
    multiply(add(A('12'), A('22'), -1), add(B('21'), B('22'))),
    multiply(add(A('11'), A('21'), -1), add(B('11'), B('12'))),
  ];
}

const cells = (trace: Trace, name: string) =>
  stateOf(trace, name, 'table').data;
/** A level table's columns, S1..S10 then P1..P7, each as a list. */
const columns = (trace: Trace, name: string) => {
  const rows = cells(trace, name);
  return rows[0]!.map((_, k) => rows.map((row) => row[k]));
};

function check(trace: Trace, a: M, b: M): void {
  expect(cells(trace, 'C')).toEqual(multiply(a, b));
  const c = stateOf(trace, 'C', 'table');
  expect(c.marks.settled).toHaveLength(a.length * a.length);
  if (a.length === 1) return;
  const rows = columns(trace, 'SP').slice(10);
  expect(rows).toEqual(products(a, b).map((p) => p.flat()));
}

const matrix = (n: number) =>
  fc.array(
    fc.array(fc.integer({ min: -20, max: 20 }), { minLength: n, maxLength: n }),
    {
      minLength: n,
      maxLength: n,
    },
  );
const pair = fc
  .constantFrom(1, 2, 4)
  .chain((n) => fc.record({ a: matrix(n), b: matrix(n) }));

describe('strassen', () => {
  it('multiplies the examples, with 7 products per call', () => {
    const doc = runOk('strassen', undefined).document;
    const trace = replay(doc);
    check(
      trace,
      [
        [1, 3],
        [7, 5],
      ],
      [
        [6, 8],
        [4, 2],
      ],
    );
    expect(cells(trace, 'C')).toEqual([
      [18, 14],
      [62, 66],
    ]);
    expect(doc.steps).toHaveLength(1 + 10 + 7 + 4);
  });

  it('recurses once per product of a 4×4 run, and clears each inner table', () => {
    const a = [
      [1, 2, 0, 1],
      [3, 1, 2, 0],
      [0, 1, 1, 2],
      [2, 0, 1, 1],
    ];
    const b = [
      [1, 0, 2, 1],
      [0, 1, 1, 0],
      [2, 1, 0, 1],
      [1, 2, 1, 0],
    ];
    const doc = runOk('strassen', { a, b }).document;
    const trace = replay(doc);
    check(trace, a, b);
    expect(doc.steps).toHaveLength(1 + 10 + 7 * (1 + 10 + 7 + 4) + 4);
    // The last inner call computed P7 = S9 · S10 of the outer level.
    const outer = columns(trace, 'SP') as number[][];
    const s9 = outer[8]!;
    const s10 = outer[9]!;
    const p7 = multiply(
      [s9.slice(0, 2), s9.slice(2)] as M,
      [s10.slice(0, 2), s10.slice(2)] as M,
    );
    expect(
      columns(trace, 'SP1')
        .slice(10)
        .map((r) => r[0]),
    ).toEqual(
      products(
        [s9.slice(0, 2), s9.slice(2)] as M,
        [s10.slice(0, 2), s10.slice(2)] as M,
      ).map((p) => p[0]![0]),
    );
    expect(outer[16]).toEqual(p7.flat());
    expect(stateOf(trace, 'calls', 'stack').data).toEqual([]);
  });

  it('multiplies 1×1 matrices in one step', () => {
    const doc = runOk('strassen', { a: [[-3]], b: [[7]] }).document;
    expect(doc.steps).toHaveLength(1);
    expect(cells(replay(doc), 'C')).toEqual([[-21]]);
  });

  it('matches the plain product on random matrices', () => {
    fc.assert(
      fc.property(pair, ({ a, b }) => {
        check(replay(runOk('strassen', { a, b }).document), a, b);
      }),
      fuzz,
    );
  });

  it('takes matrices as rows separated by semicolons', () => {
    const run = runOk('strassen', { a: '1 3; 7 5', b: '[6, 8]; [4, 2]' });
    expect(cells(replay(run.document), 'C')).toEqual([
      [18, 14],
      [62, 66],
    ]);
    expect(
      runError('strassen', { a: '1 3; 7 x', b: '1 0; 0 1' }),
    ).toMatchObject({ code: 'INVALID_NOTATION', path: '$.input.a' });
    expect(
      runError('strassen', { a: '1 3; 7 x', b: '1 0; 0 1' }).message,
    ).toContain('character 8');
  });

  it('names an empty row in the text form, and keeps -0 out of the tables', () => {
    for (const a of ['1 2;', '', '1 2; ; 3 4'])
      expect(runError('strassen', { a, b: '1 0; 0 1' })).toMatchObject({
        code: 'INVALID_NOTATION',
        path: '$.input.a',
      });
    const trace = replay(
      runOk('strassen', {
        a: [
          [-0, 0],
          [0, -0],
        ],
        b: [
          [-0, 1],
          [1, -0],
        ],
      }).document,
    );
    for (const name of ['SP', 'C'])
      for (const v of cells(trace, name).flat())
        expect(Object.is(v, -0), `${name} holds -0`).toBe(false);
  });

  it('takes square matrices of size 1, 2 or 4, both of one size', () => {
    expect(runError('strassen', { a: [[1, 2]], b: [[1]] })).toMatchObject({
      path: '$.input.a[0]',
    });
    const three = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    expect(runError('strassen', { a: three, b: three }).path).toBe('$.input.a');
    expect(
      runError('strassen', {
        a: [[1]],
        b: [
          [1, 0],
          [0, 1],
        ],
      }).path,
    ).toBe('$.input.b');
    expect(runError('strassen', { a: [[1000]], b: [[1]] }).path).toBe(
      '$.input.a[0][0]',
    );
  });
});

recipe(
  'strassen',
  pair,
  (input) => runOk('strassen', input).document,
  (trace, { a, b }) => check(trace, a, b),
);
