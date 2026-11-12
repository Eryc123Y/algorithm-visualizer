/**
 * LUP decomposition (CLRS 28.1): a permutation P, a unit lower-triangular
 * L and an upper-triangular U with PA = LU, computed in place in A with
 * partial pivoting. Column by column, the entry of largest absolute value
 * at or below the diagonal becomes the pivot, its row is exchanged into
 * place (and π records it), the entries below the pivot are divided by it
 * to give a column of L, and the lower-right block is updated to its
 * Schur complement. With a right-hand side b, forward and back
 * substitution then solve Ax = b.
 *
 * Entries are exact fractions, so a zero pivot is never a rounding
 * artefact; the result is det A, an integer.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { parseIn } from '../../notation/error.ts';
import type { Handle } from '../../recorder.ts';
import type { Trace } from '../../trace.ts';
import { parseList } from '../../notation/list.ts';
import { MAX_ENTRY, matrixField, type Matrix } from '../foundations/matrix.ts';
import {
  compareAbs,
  div,
  fromInt,
  isZero,
  mul,
  show,
  sub,
  type Rational,
} from './rational.ts';

const EXAMPLE: Matrix = [
  [2, 0, 2, 1],
  [3, 3, 4, -2],
  [5, 5, 4, 2],
  [-1, -2, 3, -1],
];

const Entry = z.int().min(-MAX_ENTRY).max(MAX_ENTRY);

const VECTOR_FORM = 'numbers separated by spaces or commas, e.g. "1 2 3 4"';

const Vector = z.union([
  z
    .string()
    .transform((s, ctx) =>
      parseIn(
        s,
        ctx,
        (t) => parseList(t, 'number', Entry),
        `Write b as ${VECTOR_FORM}.`,
      ),
    )
    .pipe(z.array(Entry)),
  z.array(Entry),
]);

const ordinal = (k: number) => String(k + 1);

/** `y1 … y3`, or `y1` alone. */
const span = (v: string, from: number, to: number) =>
  from === to ? `${v}${from}` : `${v}${from} … ${v}${to}`;

export const lup = defineAlgorithm({
  id: 'lup-decomposition',
  title: 'LUP decomposition',
  topic: 'math',
  summary:
    'Factors a square matrix as PA = LU by Gaussian elimination with partial pivoting, in place, and solves Ax = b by forward and back substitution when b is given.',
  input: z
    .strictObject({
      a: matrixField('A', EXAMPLE),
      b: Vector.optional().describe(
        `A right-hand side, one entry per row of A, to solve Ax = b: ${VECTOR_FORM}, or an array.`,
      ),
    })
    .superRefine(({ a, b }, ctx) => {
      if (b !== undefined && b.length !== a.length)
        ctx.addIssue({
          code: 'custom',
          path: ['b'],
          message: `b must have ${a.length} entries, one per row of A, not ${b.length}`,
        });
    }),
  main: 'a',
  examples: [
    { a: EXAMPLE.map((row) => [...row]) },
    { a: EXAMPLE.map((row) => [...row]), b: [1, 2, 3, 4] },
  ],
  code: {
    pseudocode: `
      LUP-DECOMPOSITION(A, n)
          let π[1 : n] be a new array
          for i = 1 to n
              π[i] = i  // @start
          for k = 1 to n
              p = 0
              for i = k to n  // @pivot
                  if |a_ik| > p
                      p = |a_ik|
                      k' = i
              if p = 0
                  error "singular matrix"  // @singular
              exchange π[k] with π[k']  // @swap
              exchange row k of A with row k'
              for i = k + 1 to n
                  a_ik = a_ik / a_kk  // @multipliers
              for i = k + 1 to n
                  for j = k + 1 to n
                      a_ij = a_ij - a_ik a_kj  // @update
          return A and π  // @done

      LUP-SOLVE(A, π, b, n)  // A holds L below its diagonal and U on and above
          for i = 1 to n
              y_i = b_π[i] - (the sum of a_ij y_j over j < i)  // @forward
          for i = n downto 1
              x_i = (y_i - (the sum of a_ij x_j over j > i)) / a_ii  // @back
          return x
    `,
    python: `
      def lup_decomposition(a):
          n = len(a)
          pi = list(range(n))  # @start
          for k in range(n):
              kk = max(range(k, n), key=lambda i: abs(a[i][k]))  # @pivot
              if a[kk][k] == 0:
                  raise ValueError("singular matrix")  # @singular
              pi[k], pi[kk] = pi[kk], pi[k]  # @swap
              a[k], a[kk] = a[kk], a[k]
              for i in range(k + 1, n):
                  a[i][k] /= a[k][k]  # @multipliers
              for i in range(k + 1, n):
                  for j in range(k + 1, n):
                      a[i][j] -= a[i][k] * a[k][j]  # @update
          return a, pi  # @done

      def lup_solve(a, pi, b):
          n = len(a)
          y = [0] * n
          for i in range(n):
              y[i] = b[pi[i]] - sum(a[i][j] * y[j] for j in range(i))  # @forward
          x = [0] * n
          for i in reversed(range(n)):
              x[i] = (y[i] - sum(a[i][j] * x[j] for j in range(i + 1, n))) / a[i][i]  # @back
          return x
    `,
  },
  run(input, trace) {
    const n = input.a.length;
    const a: Rational[][] = input.a.map((row) => row.map(fromInt));
    const pi = Array.from({ length: n }, (_, i) => i);
    const labels = Array.from({ length: n }, (_, i) => ordinal(i));
    const table = trace.add('A', {
      kind: 'table',
      label: 'A',
      initial: a.map((row) => row.map(show)),
      rowLabels: labels,
      columnLabels: labels,
    });
    // A table rather than an array, so its columns count from 1, as π's
    // entries do.
    const perm = trace.add('pi', {
      kind: 'table',
      place: 'side',
      label: 'π',
      initial: [pi.map((i) => i + 1)],
      rowLabels: [''],
      columnLabels: labels,
    });
    const b = input.b;
    const side =
      b === undefined
        ? undefined
        : trace.add('S', {
            kind: 'table',
            place: 'side',
            label: 'b, y and x',
            initial: b.map((v) => [String(v), '', '']),
            rowLabels: labels,
            columnLabels: ['b', 'y', 'x'],
          });
    trace.step(
      'start',
      'π starts as the identity: row i of A is row i of the input. Decompose A in place, a column at a time.',
    );

    let swaps = 0;
    for (let k = 0; k < n; k++) {
      let kk = k;
      for (let i = k + 1; i < n; i++)
        if (compareAbs(a[i]![k]!, a[kk]![k]!) > 0) kk = i;
      const below = Array.from(
        { length: n - k },
        (_, d) => [k + d, k] as [number, number],
      );
      if (isZero(a[kk]![k]!)) {
        trace.step(
          'singular',
          `Every entry of column ${ordinal(k)} at or below the diagonal is 0, so A is singular: it has no LUP decomposition, and det A = 0.`,
        );
        table.highlight({ cells: below });
        return { results: [0] };
      }
      trace.step(
        'pivot',
        `Column ${ordinal(k)}: the entry of largest absolute value at or below the diagonal is ${show(a[kk]![k]!)}, in row ${ordinal(kk)}. It becomes the pivot${kk === k ? ', and its row is already in place' : ''}.`,
      );
      table.highlight({ cells: below });
      if (kk !== k) {
        trace.step(
          'swap',
          `Exchange rows ${ordinal(k)} and ${ordinal(kk)} of A, and entries ${ordinal(k)} and ${ordinal(kk)} of π, which records where each row came from.`,
        );
        [a[k], a[kk]] = [a[kk]!, a[k]!];
        [pi[k], pi[kk]] = [pi[kk]!, pi[k]!];
        swaps++;
        for (const i of [k, kk])
          a[i]!.forEach((v, j) => table.set({ cell: [i, j], value: show(v) }));
        perm
          .set({ cell: [0, k], value: pi[k]! + 1 })
          .set({ cell: [0, kk], value: pi[kk]! + 1 })
          .highlight({
            cells: [
              [0, k],
              [0, kk],
            ],
          });
      }
      const pivot = a[k]![k]!;
      const rest = n - k - 1;
      const uRow = Array.from(
        { length: n - k },
        (_, d) => [k, k + d] as [number, number],
      );
      if (rest === 0) {
        table.settle({ cells: uRow });
        continue;
      }
      trace.step(
        'multipliers',
        `Divide the ${rest === 1 ? 'entry' : `${rest} entries`} below the pivot by it, ${show(pivot)}: ${rest === 1 ? 'it is' : 'they are'} column ${ordinal(k)} of L. Row ${ordinal(k)} of U is the pivot's row, from the pivot on.`,
      );
      for (let i = k + 1; i < n; i++) {
        a[i]![k] = div(a[i]![k]!, pivot);
        table.set({ cell: [i, k], value: show(a[i]![k]!) });
      }
      table.settle({ cells: [...uRow, ...below.slice(1)] });
      trace.step(
        'update',
        `Subtract each multiplier times row ${ordinal(k)} of U from the row it is in: the lower-right ${rest} × ${rest} block becomes the Schur complement, still to decompose.`,
      );
      for (let i = k + 1; i < n; i++)
        for (let j = k + 1; j < n; j++) {
          a[i]![j] = sub(a[i]![j]!, mul(a[i]![k]!, a[k]![j]!));
          table.set({ cell: [i, j], value: show(a[i]![j]!) });
        }
    }

    const product = a.reduce((p, row, k) => mul(p, row[k]!), fromInt(1));
    const det = swaps % 2 === 0 ? product : sub(fromInt(0), product);
    trace.step(
      'done',
      `A now holds L below the diagonal, whose 1s on the diagonal are not stored, and U on and above it: PA = LU, where row i of PA is row π[i] of the input. det A is the product of U's diagonal${swaps % 2 === 0 ? '' : `, negated for the ${swaps} exchanges`}: ${show(det)}.`,
    );
    if (b !== undefined && side !== undefined)
      solve(a, pi, b, trace, table, side);
    return { results: [Number(det.n)] };
  },
});

type Table = Handle<'table'>;

/** Forward substitution for y, then back substitution for x. */
function solve(
  a: readonly (readonly Rational[])[],
  pi: readonly number[],
  b: readonly number[],
  trace: Trace,
  table: Table,
  side: Table,
) {
  const n = a.length;
  const y: Rational[] = [];
  for (let i = 0; i < n; i++) {
    let v = fromInt(b[pi[i]!]!);
    for (let j = 0; j < i; j++) v = sub(v, mul(a[i]![j]!, y[j]!));
    y.push(v);
    trace.step(
      'forward',
      `Forward substitution: y${ordinal(i)} is b${ordinal(pi[i]!)}, the entry π[${ordinal(i)}] picks${i === 0 ? '' : `, less row ${ordinal(i)} of L times ${span('y', 1, i)}`}: ${show(v)}.`,
    );
    side
      .set({ cell: [i, 1], value: show(v) })
      .highlight({ cells: [[pi[i]!, 0]] });
    if (i > 0)
      table.highlight({
        cells: Array.from({ length: i }, (_, j) => [i, j] as [number, number]),
      });
  }
  const x: Rational[] = Array.from({ length: n }, () => fromInt(0));
  for (let i = n - 1; i >= 0; i--) {
    let v = y[i]!;
    for (let j = i + 1; j < n; j++) v = sub(v, mul(a[i]![j]!, x[j]!));
    x[i] = div(v, a[i]![i]!);
    trace.step(
      'back',
      `Back substitution: x${ordinal(i)} is y${ordinal(i)}${i === n - 1 ? '' : `, less the rest of row ${ordinal(i)} of U times ${span('x', i + 2, n)}`}, divided by u${ordinal(i)}${ordinal(i)} = ${show(a[i]![i]!)}: ${show(x[i]!)}.${i === 0 ? ' x solves Ax = b.' : ''}`,
    );
    side.set({ cell: [i, 2], value: show(x[i]!) });
    table.highlight({
      cells: Array.from(
        { length: n - i },
        (_, d) => [i, i + d] as [number, number],
      ),
    });
  }
}
