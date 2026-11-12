/**
 * Strassen's matrix multiplication, as in CLRS: split A and B into four
 * quadrants each, form ten sums and differences S1..S10 of them, multiply
 * seven pairs into P1..P7 by recursive calls, and add and subtract the
 * products into the four quadrants of C, for 7 multiplications of half
 * size where the plain method needs 8.
 *
 * A, B and C are tables. Each level of the recursion has a side table with
 * a column for every S and P, holding the entries of a half-size matrix; the
 * call stack shows which product a call computes. A call on 1×1 matrices
 * is a single multiplication, so it records no call of its own.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { callStack, type CallStack } from '../../call-stack.ts';
import type { Handle } from '../../recorder.ts';
import type { Trace } from '../../trace.ts';
import { matrixField, type Matrix } from './matrix.ts';

/** Sizes the module takes: powers of 2 up to 4, so every step stays readable. */
export const STRASSEN_SIZES = [1, 2, 4] as const;

const Input = z
  .strictObject({
    a: matrixField('A', [
      [1, 3],
      [7, 5],
    ]),
    b: matrixField('B', [
      [6, 8],
      [4, 2],
    ]),
  })
  .superRefine(({ a, b }, ctx) => {
    if (!(STRASSEN_SIZES as readonly number[]).includes(a.length))
      ctx.addIssue({
        code: 'custom',
        path: ['a'],
        message: `A must be 1×1, 2×2 or 4×4, not ${a.length}×${a[0]?.length ?? 0}`,
      });
    else if (b.length !== a.length)
      ctx.addIssue({
        code: 'custom',
        path: ['b'],
        message: `B must be ${a.length}×${a.length}, like A, not ${b.length}×${b[0]?.length ?? 0}`,
      });
  });

/** A quadrant: its row half, then its column half, as CLRS names them. */
type Quadrant = '11' | '12' | '21' | '22';

/** Sk = X ± Y, for k from 1 to 10 (CLRS's definitions). */
const SUMS: readonly (readonly [
  'A' | 'B',
  Quadrant,
  '+' | '−',
  'A' | 'B',
  Quadrant,
])[] = [
  ['B', '12', '−', 'B', '22'],
  ['A', '11', '+', 'A', '12'],
  ['A', '21', '+', 'A', '22'],
  ['B', '21', '−', 'B', '11'],
  ['A', '11', '+', 'A', '22'],
  ['B', '11', '+', 'B', '22'],
  ['A', '12', '−', 'A', '22'],
  ['B', '21', '+', 'B', '22'],
  ['A', '11', '−', 'A', '21'],
  ['B', '11', '+', 'B', '12'],
];

/** Columns of a level's table: S1..S10, then P1..P7. */
const COLUMNS = 17;

export const strassen = defineAlgorithm({
  id: 'strassen',
  title: 'Strassen matrix multiplication',
  topic: 'foundations',
  summary:
    'Multiplies two square matrices with seven recursive products of half size, built from ten sums of quadrants, instead of eight.',
  input: Input,
  examples: [
    {
      a: [
        [1, 3],
        [7, 5],
      ],
      b: [
        [6, 8],
        [4, 2],
      ],
    },
    {
      a: [
        [1, 2, 0, 1],
        [3, 1, 2, 0],
        [0, 1, 1, 2],
        [2, 0, 1, 1],
      ],
      b: [
        [1, 0, 2, 1],
        [0, 1, 1, 0],
        [2, 1, 0, 1],
        [1, 2, 1, 0],
      ],
    },
  ],
  code: {
    pseudocode: `
      STRASSEN(A, B, n)
          let C be a new n × n matrix
          if n == 1
              c₀₀ = a₀₀ · b₀₀  // @base
              return C
          partition A, B and C into n/2 × n/2 quadrants A₁₁, …, C₂₂  // @divide
          S₁ = B₁₂ − B₂₂  // @s1
          S₂ = A₁₁ + A₁₂  // @s2
          S₃ = A₂₁ + A₂₂  // @s3
          S₄ = B₂₁ − B₁₁  // @s4
          S₅ = A₁₁ + A₂₂  // @s5
          S₆ = B₁₁ + B₂₂  // @s6
          S₇ = A₁₂ − A₂₂  // @s7
          S₈ = B₂₁ + B₂₂  // @s8
          S₉ = A₁₁ − A₂₁  // @s9
          S₁₀ = B₁₁ + B₁₂  // @s10
          P₁ = STRASSEN(A₁₁, S₁, n/2)  // @p1
          P₂ = STRASSEN(S₂, B₂₂, n/2)  // @p2
          P₃ = STRASSEN(S₃, B₁₁, n/2)  // @p3
          P₄ = STRASSEN(A₂₂, S₄, n/2)  // @p4
          P₅ = STRASSEN(S₅, S₆, n/2)  // @p5
          P₆ = STRASSEN(S₇, S₈, n/2)  // @p6
          P₇ = STRASSEN(S₉, S₁₀, n/2)  // @p7
          C₁₁ = P₅ + P₄ − P₂ + P₆  // @c11
          C₁₂ = P₁ + P₂  // @c12
          C₂₁ = P₃ + P₄  // @c21
          C₂₂ = P₅ + P₁ − P₃ − P₇  // @c22
          return C
    `,
    python: `
      def add(x, y):
          return [[p + q for p, q in zip(r, s)] for r, s in zip(x, y)]

      def sub(x, y):
          return [[p - q for p, q in zip(r, s)] for r, s in zip(x, y)]

      def quarters(m):
          h = len(m) // 2
          top, bottom = m[:h], m[h:]
          left = [[r[:h] for r in top], [r[:h] for r in bottom]]
          right = [[r[h:] for r in top], [r[h:] for r in bottom]]
          return left[0], right[0], left[1], right[1]

      def strassen(a, b):
          if len(a) == 1:
              return [[a[0][0] * b[0][0]]]  # @base
          a11, a12, a21, a22 = quarters(a)  # @divide
          b11, b12, b21, b22 = quarters(b)
          s1 = sub(b12, b22)  # @s1
          s2 = add(a11, a12)  # @s2
          s3 = add(a21, a22)  # @s3
          s4 = sub(b21, b11)  # @s4
          s5 = add(a11, a22)  # @s5
          s6 = add(b11, b22)  # @s6
          s7 = sub(a12, a22)  # @s7
          s8 = add(b21, b22)  # @s8
          s9 = sub(a11, a21)  # @s9
          s10 = add(b11, b12)  # @s10
          p1 = strassen(a11, s1)  # @p1
          p2 = strassen(s2, b22)  # @p2
          p3 = strassen(s3, b11)  # @p3
          p4 = strassen(a22, s4)  # @p4
          p5 = strassen(s5, s6)  # @p5
          p6 = strassen(s7, s8)  # @p6
          p7 = strassen(s9, s10)  # @p7
          c11 = add(sub(add(p5, p4), p2), p6)  # @c11
          c12 = add(p1, p2)  # @c12
          c21 = add(p3, p4)  # @c21
          c22 = sub(sub(add(p5, p1), p3), p7)  # @c22
          top = [l + r for l, r in zip(c11, c12)]
          return top + [l + r for l, r in zip(c21, c22)]
    `,
  },
  run({ a, b }, outer) {
    const n = a.length;
    const tableA = outer.add('A', {
      kind: 'table',
      initial: a.map((r) => [...r]),
    });
    const tableB = outer.add('B', {
      kind: 'table',
      initial: b.map((r) => [...r]),
    });
    const tableC = outer.add('C', { kind: 'table', rows: n, columns: n });
    const whole = (handle: TableHandle, m: Matrix): View => ({
      size: n,
      at: (i, j) => m[i]![j]!,
      cell: (i, j) => ({ handle, cell: [i, j] }),
    });
    const C: Target = { handle: tableC, cell: (i, j) => [i, j], settle: true };
    if (n === 1) {
      const x = a[0]![0]!;
      const y = b[0]![0]!;
      outer.step('base', `1×1 matrices: c₀₀ = ${x} · ${y} = ${x * y + 0}.`, {
        vars: { n },
      });
      tableA.highlight({ cells: [[0, 0]] });
      tableB.highlight({ cells: [[0, 0]] });
      tableC
        .set({ cell: [0, 0], value: x * y + 0 })
        .settle({ cells: [[0, 0]] });
      return;
    }
    const levels = levelTables(outer, n);
    const calls = callStack(outer);
    const run = new Strassen(calls, levels);
    calls.trace.step(
      'divide',
      `Split A, B and C, each ${n}×${n}, into four ${n / 2}×${n / 2} quadrants.`,
      { vars: { n } },
    );
    calls.push('call', `A · B, ${n}×${n}`);
    run.multiply(whole(tableA, a), whole(tableB, b), C, 0, '');
    calls.close();
  },
});

type TableHandle = Handle<'table'>;

/** Where an entry of an operand is drawn. */
interface Place {
  readonly handle: TableHandle;
  readonly cell: [number, number];
}

/** A square operand: its size, its entries, and where each is drawn. */
interface View {
  readonly size: number;
  at(i: number, j: number): number;
  cell(i: number, j: number): Place;
}

/** Where a call writes its product. */
interface Target {
  readonly handle: TableHandle;
  cell(i: number, j: number): [number, number];
  /** Whether written entries are final, as C's are. */
  readonly settle: boolean;
}

/** The table of S and P rows for each level whose quadrants are matrices. */
function levelTables(trace: Trace, n: number): TableHandle[] {
  const columnLabels = [
    ...SUMS.map((_, k) => `S${k + 1}`),
    ...Array.from({ length: 7 }, (_, k) => `P${k + 1}`),
  ];
  const tables: TableHandle[] = [];
  for (let size = n, level = 0; size >= 2; size /= 2, level++) {
    const h = size / 2;
    const rowLabels =
      h === 1
        ? ['value']
        : Array.from(
            { length: h * h },
            (_, k) => `${Math.floor(k / h)},${k % h}`,
          );
    tables.push(
      trace.add(level === 0 ? 'SP' : `SP${level}`, {
        kind: 'table',
        label: `S and P of a ${size}×${size} call`,
        place: 'side',
        rows: rowLabels.length,
        columns: COLUMNS,
        rowLabels,
        columnLabels,
      }),
    );
  }
  return tables;
}

/** Quadrant `q` of a view. */
function quadrant(v: View, q: Quadrant): View {
  const h = v.size / 2;
  const r0 = q[0] === '1' ? 0 : h;
  const c0 = q[1] === '1' ? 0 : h;
  return {
    size: h,
    at: (i, j) => v.at(r0 + i, c0 + j),
    cell: (i, j) => v.cell(r0 + i, c0 + j),
  };
}

const entries = (size: number) =>
  Array.from(
    { length: size * size },
    (_, k) => [Math.floor(k / size), k % size] as const,
  );

/** Highlights every entry of the views, table by table. */
function highlight(views: readonly View[]): void {
  const byTable = new Map<TableHandle, [number, number][]>();
  for (const v of views)
    for (const [i, j] of entries(v.size)) {
      const { handle, cell } = v.cell(i, j);
      byTable.set(handle, [...(byTable.get(handle) ?? []), cell]);
    }
  for (const [handle, cells] of byTable) handle.highlight({ cells });
}

/** Values as the narration names them: a number, or a matrix's entries. */
const show = (values: readonly number[]) =>
  values.length === 1 ? String(values[0]) : `[${values.join(', ')}]`;

class Strassen {
  private calls = 0;
  private readonly stack: CallStack;
  private readonly levels: readonly TableHandle[];

  constructor(stack: CallStack, levels: readonly TableHandle[]) {
    this.stack = stack;
    this.levels = levels;
  }

  /**
   * Records x · y into `target` and returns its entries, row by row.
   * `level` is the depth of the call, and `where` names the product for
   * the narration, empty at the top.
   */
  multiply(
    x: View,
    y: View,
    target: Target,
    level: number,
    where: string,
  ): number[] {
    const { trace } = this.stack;
    const table = this.levels[level]!;
    const h = x.size / 2;
    const operands = { A: x, B: y } as const;
    const inCall = where === '' ? '' : `In ${where}'s call: `;
    const column = (k: number): View => ({
      size: h,
      at: (i, j) => sp[k]![i * h + j]!,
      cell: (i, j) => ({ handle: table, cell: [i * h + j, k] }),
    });
    const sp: number[][] = [];

    SUMS.forEach(([m, q, op, m2, q2], k) => {
      const left = quadrant(operands[m], q);
      const right = quadrant(operands[m2], q2);
      const values = entries(h).map(([i, j]) =>
        op === '+'
          ? left.at(i, j) + right.at(i, j)
          : left.at(i, j) - right.at(i, j),
      );
      sp[k] = values;
      const name = `S${k + 1}`;
      const formula = `${name} = ${m}${q} ${op} ${m2}${q2}`;
      trace.step(
        `s${k + 1}`,
        h === 1
          ? `${inCall}${formula} = ${left.at(0, 0)} ${op} ${right.at(0, 0)} = ${values[0]}.`
          : `${inCall}${formula} = ${show(values)}, entry by entry.`,
        { vars: { n: x.size } },
      );
      highlight([left, right]);
      values.forEach((v, e) => table.set({ cell: [e, k], value: v }));
    });

    PRODUCTS.forEach(([l, r], k) => {
      const left = this.operand(l, operands, column);
      const right = this.operand(r, operands, column);
      const name = `P${k + 1}`;
      const formula = `${name} = ${l.name} · ${r.name}`;
      const rowK = 10 + k;
      if (h === 1) {
        // + 0 turns -0, as in 0 · -3, into 0.
        const v = left.at(0, 0) * right.at(0, 0) + 0;
        sp[rowK] = [v];
        trace.step(
          `p${k + 1}`,
          `${inCall}${formula} = ${left.at(0, 0)} · ${right.at(0, 0)} = ${v}, a 1×1 product.`,
          { vars: { n: x.size } },
        );
        highlight([left, right]);
        table.set({ cell: [0, rowK], value: v });
        return;
      }
      trace.step(
        `p${k + 1}`,
        `${inCall}${formula}: call STRASSEN on ${h}×${h} matrices.`,
        { vars: { n: x.size } },
      );
      highlight([left, right]);
      this.calls += 1;
      this.stack.push(
        `call-${this.calls}`,
        `${name} = ${l.name} · ${r.name}, ${h}×${h}`,
      );
      // Each call at the inner level starts with an empty table.
      const inner = this.levels[level + 1]!;
      inner.resetMarks();
      for (let i = 0; i < COLUMNS; i++)
        for (let e = 0; e < (h / 2) * (h / 2); e++)
          inner.set({ cell: [e, i], value: null });
      sp[rowK] = this.multiply(
        left,
        right,
        {
          handle: table,
          cell: (i, j) => [i * h + j, rowK],
          settle: false,
        },
        level + 1,
        name,
      );
    });

    const product: number[] = [];
    COMBINE.forEach(([q, terms], k) => {
      const values = entries(h).map(([i, j]) =>
        terms.reduce(
          (sum, [sign, p]) => sum + sign * sp[10 + p]![i * h + j]!,
          0,
        ),
      );
      const formula = `C${q} = ${terms
        .map(
          ([sign, p], t) =>
            `${t === 0 ? '' : sign > 0 ? ' + ' : ' − '}P${p + 1}`,
        )
        .join('')}`;
      trace.step(`c${q}`, `${inCall}${formula} = ${show(values)}.`, {
        vars: { n: x.size },
      });
      highlight(terms.map(([, p]) => column(10 + p)));
      const r0 = q[0] === '1' ? 0 : h;
      const c0 = q[1] === '1' ? 0 : h;
      const cells: [number, number][] = [];
      entries(h).forEach(([i, j], e) => {
        product[(r0 + i) * x.size + c0 + j] = values[e]!;
        const cell = target.cell(r0 + i, c0 + j);
        target.handle.set({ cell, value: values[e]! });
        cells.push(cell);
      });
      if (target.settle) target.handle.settle({ cells });
      if (k === 3 && where !== '') this.stack.pop();
    });
    return product;
  }

  private operand(
    ref: Operand,
    operands: { A: View; B: View },
    column: (k: number) => View,
  ): View {
    return ref.kind === 'quadrant'
      ? quadrant(operands[ref.matrix], ref.quadrant)
      : column(ref.sum);
  }
}

/** A factor of a product: a quadrant of A or B, or a sum Sk. */
type Operand =
  | { kind: 'quadrant'; matrix: 'A' | 'B'; quadrant: Quadrant; name: string }
  | { kind: 'sum'; sum: number; name: string };

const quad = (matrix: 'A' | 'B', q: Quadrant): Operand => ({
  kind: 'quadrant',
  matrix,
  quadrant: q,
  name: `${matrix}${q}`,
});
const sum = (k: number): Operand => ({
  kind: 'sum',
  sum: k - 1,
  name: `S${k}`,
});

/** Pk = X · Y, for k from 1 to 7. */
const PRODUCTS: readonly (readonly [Operand, Operand])[] = [
  [quad('A', '11'), sum(1)],
  [sum(2), quad('B', '22')],
  [sum(3), quad('B', '11')],
  [quad('A', '22'), sum(4)],
  [sum(5), sum(6)],
  [sum(7), sum(8)],
  [sum(9), sum(10)],
];

/** Each quadrant of C as signed products, P indices from 0. */
const COMBINE: readonly (readonly [
  Quadrant,
  readonly (readonly [1 | -1, number])[],
])[] = [
  [
    '11',
    [
      [1, 4],
      [1, 3],
      [-1, 1],
      [1, 5],
    ],
  ],
  [
    '12',
    [
      [1, 0],
      [1, 1],
    ],
  ],
  [
    '21',
    [
      [1, 2],
      [1, 3],
    ],
  ],
  [
    '22',
    [
      [1, 4],
      [1, 0],
      [-1, 2],
      [-1, 6],
    ],
  ],
];
