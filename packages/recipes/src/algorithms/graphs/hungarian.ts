/**
 * The Hungarian algorithm for the assignment problem (CLRS 25.3): in a
 * complete bipartite graph with a weight on each pair, a perfect matching
 * of greatest total weight. Every vertex has a label h, kept feasible:
 * h(l) + h(r) ≥ w(l, r) for every pair. The pairs where equality holds
 * form the equality subgraph, and the matching grows only along its
 * edges, by augmenting paths found by breadth-first search from the free
 * vertices on the left. When the search is stuck, the labels in its forest
 * change by the least slack δ: lower on the left, higher on the right,
 * which keeps them feasible and the forest's edges tight, and brings a new
 * pair into the equality subgraph. A perfect matching there weighs the sum
 * of all the labels, and no perfect matching weighs more, so it is the
 * heaviest.
 *
 * The rows of the weights are the left vertices a, b, …, the columns the
 * right ones p, q, …; the graph shows the equality subgraph, the labels as
 * notes and the matching as marked edges, beside the table of weights.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { matrixField, type Matrix } from '../foundations/matrix.ts';
import { num } from './dag-shortest-paths.ts';

/** Most rows: 6 + 6 vertices, and a 6 × 6 table beside them. */
export const MAX_HUNGARIAN = 6;

const LEFT = ['a', 'b', 'c', 'd', 'e', 'f'];
const RIGHT = ['p', 'q', 'r', 's', 't', 'u'];

const EXAMPLE: Matrix = [
  [3, 8, 4, 6],
  [7, 2, 9, 5],
  [6, 4, 5, 8],
  [2, 7, 3, 4],
];

const names = (vs: readonly string[]) => vs.join(' ');

export const hungarian = defineAlgorithm({
  id: 'hungarian',
  title: 'Hungarian algorithm',
  topic: 'graphs',
  summary:
    'Finds a perfect matching of greatest weight in a complete bipartite graph, keeping a feasible label on every vertex and matching only along edges where the labels are tight, relabelling when the search is stuck.',
  input: z.strictObject({
    weights: matrixField('W', EXAMPLE, MAX_HUNGARIAN).describe(
      `The weights, a square matrix of at most ${MAX_HUNGARIAN} rows: row i is left vertex a, b, …, column j right vertex p, q, …`,
    ),
  }),
  main: 'weights',
  examples: [{ weights: EXAMPLE.map((row) => [...row]) }],
  code: {
    pseudocode: `
      HUNGARIAN(W)  // W[l][r] weighs edge (l, r) of a complete bipartite graph
          l.h = the greatest weight W[l][r] over r, for each l in L  // @start
          r.h = 0 for each r in R
          M = an empty matching
          while M is not perfect
              grow a forest by BFS in the equality subgraph from the free vertices of L  // @grow
              if the forest reaches a free vertex of R
                  M = M with the edges of the path to it flipped in or out  // @augment
              else
                  δ = the least slack l.h + r.h - W[l][r], l in the forest and r not  // @relabel
                  l.h = l.h - δ for each l in the forest, r.h = r.h + δ for each r in it
          return M  // @done
    `,
    python: `
      def hungarian(w):
          n = len(w)
          hl = [max(row) for row in w]  # @start
          hr = [0] * n
          mate_l, mate_r = [None] * n, [None] * n
          while None in mate_l:
              path, fl, fr = search(w, hl, hr, mate_l, mate_r)  # @grow
              if path is not None:
                  for l, r in path:  # @augment
                      mate_l[l], mate_r[r] = r, l
              else:
                  d = min(hl[l] + hr[r] - w[l][r] for l in fl for r in range(n) if r not in fr)  # @relabel
                  for l in fl:
                      hl[l] -= d
                  for r in fr:
                      hr[r] += d
          return mate_l  # @done
    `,
  },
  run(input, trace) {
    const w = input.weights;
    const n = w.length;
    const L = LEFT.slice(0, n);
    const R = RIGHT.slice(0, n);
    const hl = w.map((row) => Math.max(...row));
    const hr = R.map(() => 0);
    const tight = (i: number, j: number) => hl[i]! + hr[j]! === w[i]![j]!;

    // A pair that leaves the equality subgraph and comes back gets a new
    // id, since an id names one edge for the whole trace.
    const uses = new Map<string, number>();
    const live = new Map<string, string>();
    const open = (i: number, j: number) => {
      const base = `${L[i]}${R[j]}`;
      const k = (uses.get(base) ?? 0) + 1;
      uses.set(base, k);
      const id = k === 1 ? base : `${base}.${k}`;
      live.set(`${i} ${j}`, id);
      return { id, from: L[i]!, to: R[j]! };
    };
    const edgeOf = (i: number, j: number) => live.get(`${i} ${j}`)!;
    const pairs = L.flatMap((_, i) => R.map((_, j) => [i, j] as const));

    const graph = trace.add('g', {
      kind: 'graph',
      label: 'G',
      directed: false,
      layout: 'manual',
      nodes: [
        ...L.map((v, k) => ({ id: v, x: 60, y: 40 + 60 * k })),
        ...R.map((v, k) => ({ id: v, x: 260, y: 40 + 60 * k })),
      ],
      edges: pairs.filter(([i, j]) => tight(i, j)).map(([i, j]) => open(i, j)),
    });
    const table = trace.add('W', {
      kind: 'table',
      place: 'side',
      label: 'W, weights',
      initial: w.map((row) => [...row]),
      rowLabels: L,
      columnLabels: R,
    });
    trace.step(
      'start',
      'Label each vertex on the left with its heaviest weight and each on the right with 0, the notes. The labels are feasible: h(l) + h(r) ≥ w(l, r) for every pair. The edges drawn are the tight pairs, where equality holds: the equality subgraph. Start with no edge matched.',
    );
    L.forEach((v, i) => {
      graph
        .group({ node: v, group: 0 })
        .annotate({ node: v, text: num(hl[i]!) });
    });
    R.forEach((v, j) => {
      graph
        .group({ node: v, group: 1 })
        .annotate({ node: v, text: num(hr[j]!) });
    });

    const mateL: (number | undefined)[] = L.map(() => undefined);
    const mateR: (number | undefined)[] = R.map(() => undefined);
    while (mateL.some((m) => m === undefined)) {
      const free = L.flatMap((_, i) => (mateL[i] === undefined ? [i] : []));
      const forest = grow(n, free, tight, mateL, mateR);
      const freeText = names(free.map((i) => L[i]!));
      if (forest.end !== undefined) {
        const path = pathTo(forest.end, forest.parent, mateL);
        const vertices = path.flatMap(([i, j]) => [L[i]!, R[j]!]);
        trace.step(
          'grow',
          `Breadth-first search in the equality subgraph from the free vertices on the left, ${freeText}, along unmatched edges to the right and matched edges back, finds the augmenting path ${vertices.join(' – ')}.`,
        );
        graph.highlight({
          nodes: vertices,
          edges: vertices
            .slice(1)
            .map((_, k) =>
              k % 2 === 0
                ? edgeOf(path[k / 2]![0], path[k / 2]![1])
                : edgeOf(path[(k + 1) / 2]![0], path[(k - 1) / 2]![1]),
            ),
        });
        trace.step(
          'augment',
          `${path.length === 1 ? `Match ${vertices[0]} and ${vertices[1]}` : 'Flip the path: its unmatched edges go in and its matched ones out'}, so the matching grows to ${n - free.length + 1}.`,
        );
        for (const [i] of path) {
          const old = mateL[i];
          if (old !== undefined)
            graph.markEdge({ edge: edgeOf(i, old), mark: null });
        }
        for (const [i, j] of path) {
          mateL[i] = j;
          mateR[j] = i;
          graph.markEdge({ edge: edgeOf(i, j), mark: 'selected' });
        }
        graph.highlight({ nodes: vertices });
        table.resetMarks().settle({
          cells: L.flatMap((_, i) =>
            mateL[i] === undefined ? [] : [[i, mateL[i]] as [number, number]],
          ),
        });
        continue;
      }

      const inL = [...forest.left];
      const inR = [...forest.right];
      trace.step(
        'grow',
        `Breadth-first search in the equality subgraph from the free vertices on the left, ${freeText}, reaches no free vertex on the right: its forest holds ${names(inL.map((i) => L[i]!))} on the left${inR.length === 0 ? '' : ` and ${names(inR.map((j) => R[j]!))} on the right`}.`,
      );
      graph.highlight({
        nodes: [...inL.map((i) => L[i]!), ...inR.map((j) => R[j]!)],
        edges: inR.flatMap((j) => [
          edgeOf(forest.parent.get(j)!, j),
          edgeOf(mateR[j]!, j),
        ]),
      });

      // The least slack from the forest's left vertices to the right
      // vertices outside it.
      let delta = Infinity;
      let at: readonly [number, number] = [0, 0];
      for (const i of inL)
        for (let j = 0; j < n; j++)
          if (!forest.right.has(j)) {
            const slack = hl[i]! + hr[j]! - w[i]![j]!;
            if (slack < delta) {
              delta = slack;
              at = [i, j];
            }
          }
      const before = new Set(
        pairs.filter(([i, j]) => tight(i, j)).map(([i, j]) => `${i} ${j}`),
      );
      for (const i of inL) hl[i] = hl[i]! - delta;
      for (const j of inR) hr[j] = hr[j]! + delta;
      const joined = pairs.filter(
        ([i, j]) => tight(i, j) && !before.has(`${i} ${j}`),
      );
      const left = pairs.filter(
        ([i, j]) => !tight(i, j) && before.has(`${i} ${j}`),
      );
      const pairText = (ps: readonly (readonly [number, number])[]) =>
        ps.map(([i, j]) => `${L[i]}–${R[j]}`).join(', ');
      trace.step(
        'relabel',
        `The least slack h(l) + h(r) − w(l, r) from the forest's left vertices to a right vertex outside it is δ = ${num(delta)}, at ${L[at[0]]}–${R[at[1]]}. Lower the labels of ${names(inL.map((i) => L[i]!))} by ${num(delta)}${inR.length === 0 ? '' : ` and raise those of ${names(inR.map((j) => R[j]!))} by ${num(delta)}`}: the labels stay feasible and the forest's edges tight. ${pairText(joined)} ${joined.length === 1 ? 'joins' : 'join'} the equality subgraph${left.length === 0 ? '' : `, and ${pairText(left)} ${left.length === 1 ? 'leaves' : 'leave'} it`}.`,
      );
      for (const [i, j] of left) {
        graph.removeEdge({ edge: edgeOf(i, j) });
        live.delete(`${i} ${j}`);
      }
      for (const [i, j] of joined) graph.addEdge({ edge: open(i, j) });
      for (const i of inL) graph.annotate({ node: L[i]!, text: num(hl[i]!) });
      for (const j of inR) graph.annotate({ node: R[j]!, text: num(hr[j]!) });
      table.highlight({ cells: [[at[0], at[1]]] });
    }

    const weight = L.reduce((sum, _, i) => sum + w[i]![mateL[i]!]!, 0);
    const labels = [...hl, ...hr].reduce((a, b) => a + b, 0);
    trace.step(
      'done',
      `The matching is perfect, of weight ${num(weight)}, the sum of all the labels, ${num(labels)}. No perfect matching weighs more than that sum, since each of its edges weighs at most h(l) + h(r), so this one is the heaviest.`,
    );
    table.highlight({
      cells: L.map((_, i) => [i, mateL[i]!] as [number, number]),
    });
    return { results: [weight] };
  },
});

interface Forest {
  /** Left vertices in the forest. */
  readonly left: Set<number>;
  /** Right vertices in the forest. */
  readonly right: Set<number>;
  /** For each right vertex in the forest, the left vertex it was reached from. */
  readonly parent: Map<number, number>;
  /** A free right vertex the search reached, if any. */
  readonly end: number | undefined;
}

/**
 * Breadth-first search in the equality subgraph from the free left
 * vertices, out by unmatched tight edges and back by matched ones, until
 * it reaches a free right vertex or runs out.
 */
function grow(
  n: number,
  free: readonly number[],
  tight: (i: number, j: number) => boolean,
  mateL: readonly (number | undefined)[],
  mateR: readonly (number | undefined)[],
): Forest {
  const left = new Set(free);
  const right = new Set<number>();
  const parent = new Map<number, number>();
  const queue = [...free];
  while (queue.length > 0) {
    const i = queue.shift()!;
    for (let j = 0; j < n; j++) {
      if (right.has(j) || mateL[i] === j || !tight(i, j)) continue;
      right.add(j);
      parent.set(j, i);
      const k = mateR[j];
      if (k === undefined) return { left, right, parent, end: j };
      left.add(k);
      queue.push(k);
    }
  }
  return { left, right, parent, end: undefined };
}

/** The unmatched pairs of the augmenting path to `end`, from its root. */
function pathTo(
  end: number,
  parent: ReadonlyMap<number, number>,
  mateL: readonly (number | undefined)[],
): [number, number][] {
  const path: [number, number][] = [];
  for (let j: number | undefined = end; j !== undefined;) {
    const i: number = parent.get(j)!;
    path.unshift([i, j]);
    j = mateL[i];
  }
  return path;
}
