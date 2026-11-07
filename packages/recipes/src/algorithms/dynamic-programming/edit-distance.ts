/**
 * Edit distance (ADR 0023): Levenshtein's, where copying a character costs
 * 0, and replacing, inserting or deleting one costs 1. D[i][j] is the
 * distance from the first i characters of a to the first j of b; each cell
 * is the cheapest of its three neighbours above and to the left.
 * EDIT-PATH then walks back from the corner and settles one cheapest way.
 */
import type { Cell } from '@algoviz/spec';

import { defineAlgorithm } from '../../algorithm.ts';
import { TwoStrings } from './strings.ts';

export const editDistance = defineAlgorithm({
  id: 'edit-distance',
  title: 'Edit distance',
  topic: 'dynamic-programming',
  summary:
    'Fills a table of the fewest replacements, insertions and deletions that turn every prefix of one string into every prefix of another.',
  input: TwoStrings,
  examples: [{ first: 'kitten', second: 'sitting' }],
  code: {
    pseudocode: `
      EDIT-DISTANCE(a, b, m, n)
          let D[0 : m, 0 : n] be a new table
          for i = 0 to m
              D[i][0] = i
          for j = 0 to n
              D[0][j] = j
          for i = 1 to m
              for j = 1 to n
                  if a[i - 1] == b[j - 1]
                      cost = 0
                  else cost = 1
                  D[i][j] = min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + cost)  // @fill
          return D[m][n]  // @done

      EDIT-PATH(D, m, n)
          i = m
          j = n
          while i > 0 or j > 0  // @trace
              if D[i][j] came from D[i - 1][j - 1]
                  i = i - 1
                  j = j - 1
              elseif D[i][j] came from D[i - 1][j]
                  i = i - 1
              else j = j - 1
    `,
    python: `
      def edit_distance(a, b):
          m, n = len(a), len(b)
          D = [[0] * (n + 1) for _ in range(m + 1)]
          for i in range(m + 1):
              D[i][0] = i
          for j in range(n + 1):
              D[0][j] = j
          for i in range(1, m + 1):
              for j in range(1, n + 1):
                  cost = 0 if a[i - 1] == b[j - 1] else 1
                  D[i][j] = min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + cost)  # @fill
          return D[m][n]  # @done

      def edit_path(D, a, b):
          i, j, path = len(a), len(b), []
          while i > 0 or j > 0:  # @trace
              cost = 0 if i > 0 and j > 0 and a[i - 1] == b[j - 1] else 1
              if i > 0 and j > 0 and D[i][j] == D[i - 1][j - 1] + cost:
                  i, j = i - 1, j - 1
              elif i > 0 and D[i][j] == D[i - 1][j] + 1:
                  i -= 1
              else:
                  j -= 1
              path.append((i, j))
          return path
    `,
  },
  run({ first, second }, trace) {
    // Characters, not UTF-16 code units, so that "é" or "🙂" is one cell.
    const [a, b] = [[...first], [...second]];
    const [m, n] = [a.length, b.length];
    const D = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    const table = trace.add('D', {
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
        const [del, ins, diag] = [
          D[i - 1]![j]! + 1,
          D[i]![j - 1]! + 1,
          D[i - 1]![j - 1]! + cost,
        ];
        D[i]![j] = Math.min(del, ins, diag);
        trace.step(
          'fill',
          `${a[i - 1]} and ${b[j - 1]}: the least of delete ${del}, insert ${ins} and ${cost === 0 ? 'copy' : 'replace'} ${diag} is ${D[i]![j]}.`,
          { vars: { i, j, cost } },
        );
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
    const d = D[m]![n]!;
    trace.step(
      'done',
      `The table is complete: ${d} ${d === 1 ? 'edit turns' : 'edits turn'} "${first}" into "${second}".`,
    );
    // Trace back one cheapest way, preferring the diagonal.
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
    trace.step(
      'trace',
      'Walk back from the corner to the start, each time to a neighbour the cell came from: the settled cells show one cheapest way.',
    );
    table.settle({ cells: path });
  },
});
