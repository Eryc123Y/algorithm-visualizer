/**
 * Dynamic programming on tables: each cell is computed from cells filled
 * earlier, which `depend` shows with arrows; the answer is then traced
 * back and settled.
 */
import type { Cell, VisualizationInput } from '@algoviz/spec';

import { Recorder } from './recorder.ts';
import { python } from './source.ts';

/** Longest common subsequence of two strings. */
export function longestCommonSubsequence(
  first: string,
  second: string,
): VisualizationInput {
  // Characters, not UTF-16 code units, so that "é" or "🙂" is one cell.
  const [a, b] = [[...first], [...second]];
  const r = new Recorder({
    title: 'Longest common subsequence',
    source: python(`
      def lcs(a, b):
          m, n = len(a), len(b)
          L = [[0] * (n + 1) for _ in range(m + 1)]
          for i in range(1, m + 1):
              for j in range(1, n + 1):
                  if a[i - 1] == b[j - 1]:
                      L[i][j] = L[i - 1][j - 1] + 1
                  else:
                      L[i][j] = max(L[i - 1][j], L[i][j - 1])
          return L[m][n]
    `),
  });
  const [m, n] = [a.length, b.length];
  const L = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  const table = r.add('L', {
    kind: 'table',
    initial: L.map((row, i) =>
      row.map((v, j) => (i === 0 || j === 0 ? v : null)),
    ),
    rowLabels: ['', ...a],
    columnLabels: ['', ...b],
  });
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const match = a[i - 1] === b[j - 1];
      if (match) {
        L[i]![j] = L[i - 1]![j - 1]! + 1;
        r.step({
          line: 7,
          narration: `${a[i - 1]} = ${b[j - 1]}: extend the diagonal, ${L[i]![j]}.`,
          vars: { i, j },
        });
        table.depend({ cell: [i, j], on: [[i - 1, j - 1]] });
      } else {
        L[i]![j] = Math.max(L[i - 1]![j]!, L[i]![j - 1]!);
        r.step({
          line: 9,
          narration: `${a[i - 1]} ≠ ${b[j - 1]}: the better of above and left, ${L[i]![j]}.`,
          vars: { i, j },
        });
        table.depend({
          cell: [i, j],
          on: [
            [i - 1, j],
            [i, j - 1],
          ],
        });
      }
      table.set({ cell: [i, j], value: L[i]![j]! });
    }
  // Trace back from the corner.
  const path: Cell[] = [];
  let common = '';
  let [i, j] = [m, n];
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      path.push([i, j]);
      common = a[i - 1] + common;
      i--;
      j--;
    } else if (L[i - 1]![j]! >= L[i]![j - 1]!) i--;
    else j--;
  }
  r.step({
    line: 10,
    narration: `Trace back the matches: "${common}" has length ${L[m]![n]}.`,
  });
  if (path.length > 0) table.settle({ cells: path });
  return r.build();
}

/** Levenshtein distance between two strings. */
export function editDistance(
  first: string,
  second: string,
): VisualizationInput {
  const [a, b] = [[...first], [...second]];
  const r = new Recorder({
    title: 'Edit distance',
    source: python(`
      def edit_distance(a, b):
          m, n = len(a), len(b)
          D = [[0] * (n + 1) for _ in range(m + 1)]
          for i in range(m + 1): D[i][0] = i
          for j in range(n + 1): D[0][j] = j
          for i in range(1, m + 1):
              for j in range(1, n + 1):
                  cost = 0 if a[i - 1] == b[j - 1] else 1
                  D[i][j] = min(D[i - 1][j] + 1,         # delete
                                D[i][j - 1] + 1,         # insert
                                D[i - 1][j - 1] + cost)  # replace
          return D[m][n]
    `),
  });
  const [m, n] = [a.length, b.length];
  const D = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const table = r.add('D', {
    kind: 'table',
    initial: D.map((row, i) =>
      row.map((v, j) => (i === 0 || j === 0 ? v : null)),
    ),
    rowLabels: ['', ...a],
    columnLabels: ['', ...b],
  });
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      D[i]![j] = Math.min(
        D[i - 1]![j]! + 1,
        D[i]![j - 1]! + 1,
        D[i - 1]![j - 1]! + cost,
      );
      r.step({
        line: 9,
        narration: `${a[i - 1]} vs ${b[j - 1]}: min(delete ${D[i - 1]![j]! + 1}, insert ${D[i]![j - 1]! + 1}, ${cost === 0 ? 'keep' : 'replace'} ${D[i - 1]![j - 1]! + cost}) = ${D[i]![j]}.`,
        vars: { i, j },
      });
      table.depend({
        cell: [i, j],
        on: [
          [i - 1, j],
          [i, j - 1],
          [i - 1, j - 1],
        ],
      });
      table.set({ cell: [i, j], value: D[i]![j]! });
    }
  const path: Cell[] = [[m, n]];
  let [i, j] = [m, n];
  while (i > 0 || j > 0) {
    const cost = i > 0 && j > 0 && a[i - 1] === b[j - 1] ? 0 : 1;
    if (i > 0 && j > 0 && D[i]![j] === D[i - 1]![j - 1]! + cost)
      [i, j] = [i - 1, j - 1];
    else if (i > 0 && D[i]![j] === D[i - 1]![j]! + 1) i--;
    else j--;
    path.push([i, j]);
  }
  r.step({
    line: 12,
    narration: `${D[m]![n]} edit(s) turn "${first}" into "${second}"; the settled cells show one way.`,
  });
  table.settle({ cells: path });
  return r.build();
}

export interface KnapsackItem {
  readonly weight: number;
  readonly value: number;
}

/** 0/1 knapsack: the best total value within a weight capacity. */
export function knapsack(
  items: readonly KnapsackItem[],
  capacity: number,
): VisualizationInput {
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 40)
    throw new RangeError('The capacity must be an integer from 0 to 40');
  if (items.some(({ weight }) => !Number.isInteger(weight) || weight < 1))
    throw new RangeError('Item weights must be positive integers');
  const r = new Recorder({
    title: '0/1 knapsack',
    source: python(`
      def knapsack(items, W):
          K = [[0] * (W + 1) for _ in range(len(items) + 1)]
          for i, (w, v) in enumerate(items, 1):
              for c in range(W + 1):
                  K[i][c] = K[i - 1][c]
                  if w <= c:
                      K[i][c] = max(K[i][c], K[i - 1][c - w] + v)
          return K[len(items)][W]
    `),
  });
  const n = items.length;
  const K = Array.from({ length: n + 1 }, () =>
    Array<number>(capacity + 1).fill(0),
  );
  const table = r.add('K', {
    kind: 'table',
    initial: K.map((row, i) => row.map((v) => (i === 0 ? v : null))),
    rowLabels: [
      'none',
      ...items.map(({ weight, value }) => `w${weight} v${value}`),
    ],
  });
  items.forEach(({ weight: w, value: v }, k) => {
    const i = k + 1;
    for (let c = 0; c <= capacity; c++) {
      const skip = K[i - 1]![c]!;
      const take = w <= c ? K[i - 1]![c - w]! + v : -Infinity;
      K[i]![c] = Math.max(skip, take);
      r.step({
        line: w <= c ? 7 : 5,
        narration:
          w <= c
            ? `Capacity ${c}: skip item ${i} (${skip}) or take it (${K[i - 1]![c - w]} + ${v} = ${take}): ${K[i]![c]}.`
            : `Capacity ${c}: item ${i} (weight ${w}) does not fit, ${skip}.`,
        vars: { i, c },
      });
      table.depend({
        cell: [i, c],
        on:
          w <= c
            ? [
                [i - 1, c],
                [i - 1, c - w],
              ]
            : [[i - 1, c]],
      });
      table.set({ cell: [i, c], value: K[i]![c]! });
    }
  });
  const chosen: Cell[] = [];
  let c = capacity;
  for (let i = n; i > 0; i--)
    if (K[i]![c] !== K[i - 1]![c]) {
      chosen.push([i, c]);
      c -= items[i - 1]!.weight;
    }
  r.step({
    line: 8,
    narration: `Best value ${K[n]![capacity]}, taking item(s) ${
      chosen
        .map(([i]) => i)
        .reverse()
        .join(', ') || 'none'
    }.`,
  });
  if (chosen.length > 0) table.settle({ cells: chosen });
  return r.build();
}
