/**
 * Longest common subsequence, as LCS-LENGTH in CLRS (ADR 0023): c[i][j] is
 * the length of an LCS of the first i characters of a and the first j of
 * b. Each cell comes from the diagonal when the characters match, and
 * from the better of above and left otherwise; arrows show which, in
 * place of CLRS's table of arrows. LCS-READ then walks back from the
 * corner, as PRINT-LCS does, and settles the matched cells of one longest
 * common subsequence.
 */
import type { Cell } from '@algoviz/spec';

import { defineAlgorithm } from '../../algorithm.ts';
import { TwoStrings } from './strings.ts';

export const lcs = defineAlgorithm({
  id: 'lcs',
  title: 'Longest common subsequence',
  topic: 'dynamic-programming',
  summary:
    'Fills a table of the longest common subsequence of every pair of prefixes of two strings, then traces one back from the corner.',
  input: TwoStrings,
  examples: [{ first: 'ABCBDAB', second: 'BDCABA' }],
  code: {
    pseudocode: `
      LCS-LENGTH(a, b, m, n)
          let c[0 : m, 0 : n] be a new table
          for i = 0 to m
              c[i][0] = 0
          for j = 0 to n
              c[0][j] = 0
          for i = 1 to m
              for j = 1 to n
                  if a[i - 1] == b[j - 1]
                      c[i][j] = c[i - 1][j - 1] + 1  // @match
                  else c[i][j] = max(c[i - 1][j], c[i][j - 1])  // @best
          return c  // @done

      LCS-READ(c, a, b, m, n)
          s = an empty string
          i = m
          j = n
          while i > 0 and j > 0  // @trace
              if a[i - 1] == b[j - 1]
                  s = a[i - 1] followed by s
                  i = i - 1
                  j = j - 1
              elseif c[i - 1][j] ≥ c[i][j - 1]
                  i = i - 1
              else j = j - 1
          return s
    `,
    python: `
      def lcs_length(a, b):
          m, n = len(a), len(b)
          c = [[0] * (n + 1) for _ in range(m + 1)]
          for i in range(1, m + 1):
              for j in range(1, n + 1):
                  if a[i - 1] == b[j - 1]:
                      c[i][j] = c[i - 1][j - 1] + 1  # @match
                  else:
                      c[i][j] = max(c[i - 1][j], c[i][j - 1])  # @best
          return c  # @done

      def lcs_read(c, a, b):
          s, i, j = '', len(a), len(b)
          while i > 0 and j > 0:  # @trace
              if a[i - 1] == b[j - 1]:
                  s = a[i - 1] + s
                  i, j = i - 1, j - 1
              elif c[i - 1][j] >= c[i][j - 1]:
                  i -= 1
              else:
                  j -= 1
          return s
    `,
  },
  run({ first, second }, trace) {
    // Characters, not UTF-16 code units, so that "é" or "🙂" is one cell.
    const [a, b] = [[...first], [...second]];
    const [m, n] = [a.length, b.length];
    const c = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
    const table = trace.add('c', {
      kind: 'table',
      initial: c.map((row, i) =>
        row.map((v, j) => (i === 0 || j === 0 ? v : null)),
      ),
      rowLabels: ['', ...a],
      columnLabels: ['', ...b],
    });
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          c[i]![j] = c[i - 1]![j - 1]! + 1;
          trace.step(
            'match',
            `${a[i - 1]} = ${b[j - 1]}: one more than the diagonal, ${c[i]![j]}.`,
            { vars: { i, j } },
          );
          table.depend({ cell: [i, j], on: [[i - 1, j - 1]] });
        } else {
          c[i]![j] = Math.max(c[i - 1]![j]!, c[i]![j - 1]!);
          trace.step(
            'best',
            `${a[i - 1]} ≠ ${b[j - 1]}: the better of above and left, ${c[i]![j]}.`,
            { vars: { i, j } },
          );
          table.depend({
            cell: [i, j],
            on: [
              [i - 1, j],
              [i, j - 1],
            ],
          });
        }
        table.set({ cell: [i, j], value: c[i]![j]! });
      }
    trace.step(
      'done',
      `The table is complete: a longest common subsequence has length ${c[m]![n]}.`,
    );
    // Trace back from the corner, preferring up on a tie, as CLRS does.
    const path: Cell[] = [];
    let common = '';
    let [i, j] = [m, n];
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        path.push([i, j]);
        common = a[i - 1] + common;
        i--;
        j--;
      } else if (c[i - 1]![j]! >= c[i]![j - 1]!) i--;
      else j--;
    }
    trace.step(
      'trace',
      path.length === 0
        ? 'Walk back from the corner: no characters match, so the subsequence is empty.'
        : `Walk back from the corner, keeping each match: "${common}" is a longest common subsequence.`,
    );
    if (path.length > 0) table.settle({ cells: path });
  },
});
