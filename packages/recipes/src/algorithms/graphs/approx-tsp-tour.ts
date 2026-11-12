/**
 * APPROX-TSP-TOUR (CLRS 35.2.1): a travelling-salesman tour at most twice
 * the shortest, for costs that obey the triangle inequality, here the
 * distances between points in the plane. Grow a minimum spanning tree from
 * a root by Prim's algorithm, list the vertices in the order a preorder
 * walk of the tree first reaches them, and visit them in that order. The
 * full walk of the tree costs twice the tree; skipping repeated vertices
 * costs no more, by the triangle inequality; and removing an edge from the
 * best tour leaves a spanning tree, so the tree costs no more than it.
 *
 * The points are drawn where they are, scaled to fit, so points very close
 * together beside far ones may overlap. Tree edges carry their lengths;
 * the tour's edges are added at the end, with the tree dimmed behind them.
 * Distances are compared squared, exactly on integers, so ties go to the
 * point given first.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  dist2,
  parsePoints,
  pointsField,
  type Pt,
} from '../geometry/common.ts';

/** Most points: a tree and a tour of 10 still read clearly. */
export const MAX_TSP_POINTS = 10;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const show = (x: number) => String(Math.round(x * 100) / 100);

export const approxTspTour = defineAlgorithm({
  id: 'approx-tsp-tour',
  title: 'Approximate TSP tour',
  topic: 'graphs',
  summary:
    'Finds a travelling-salesman tour of points in the plane at most twice the shortest: grow a minimum spanning tree, and visit the points in the order a preorder walk of it reaches them.',
  input: z.strictObject({ points: pointsField(2, MAX_TSP_POINTS) }),
  main: 'points',
  examples: [
    {
      points: parsePoints(
        'a(1, 7) b(2, 3) c(4, 6) d(5, 1) e(6, 4) f(8, 7) g(9, 2) h(3, 9)',
      ),
    },
  ],
  code: {
    pseudocode: `
      APPROX-TSP-TOUR(G, c)
          r = the first vertex of G.V  // @start
          T = MST-PRIM(G, c, r), a minimum spanning tree grown from r  // @grow
          H = the vertices in the order a preorder walk of T first reaches them  // @walk
          join the vertices of H in order, and the last back to r  // @tour
          return the tour  // @done
    `,
    python: `
      import math

      def approx_tsp_tour(points):
          n = len(points)
          r = 0  # @start
          tree, children = [r], {v: [] for v in range(n)}
          cost = lambda e: math.dist(points[e[0]], points[e[1]])
          while len(tree) < n:
              u, v = min(((u, v) for v in range(n) if v not in tree for u in tree), key=cost)  # @grow
              tree.append(v)
              children[u].append(v)
          order = []
          def walk(v):
              order.append(v)  # @walk
              for c in children[v]:
                  walk(c)
          walk(r)
          tour = order + [r]  # @tour
          return tour  # @done
    `,
  },
  run(input, trace) {
    const ps = input.points;
    const n = ps.length;
    // Fit the points in a 360-unit square, y up as in the plane.
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    const span = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      1,
    );
    const scale = 360 / span;
    const graph = trace.add('g', {
      kind: 'graph',
      label: 'G',
      directed: false,
      layout: 'manual',
      nodes: ps.map((p) => ({
        id: p.id,
        x: 40 + (p.x - Math.min(...xs)) * scale,
        y: 40 + (Math.max(...ys) - p.y) * scale,
      })),
      edges: [],
    });
    const r = ps[0]!;
    trace.step(
      'start',
      `Take ${r.id} as the root, and grow a minimum spanning tree from it by Prim's algorithm, the cost of joining two points being the distance between them.`,
    );
    graph.pointer({ name: 'r', node: r.id });

    // Prim: the closest point to the tree joins it, a step each.
    const inTree = new Set([0]);
    // Squared distances: exact on integers, so equal distances tie.
    const best = ps.map((p) => dist2(p, r));
    const via = ps.map(() => 0);
    const children: number[][] = ps.map(() => []);
    const treeEdges: string[] = [];
    let weight = 0;
    while (inTree.size < n) {
      let v = -1;
      for (let i = 0; i < n; i++)
        if (!inTree.has(i) && (v < 0 || best[i]! < best[v]!)) v = i;
      const u = via[v]!;
      inTree.add(v);
      children[u]!.push(v);
      weight += Math.sqrt(best[v]!);
      const id = `${ps[u]!.id}-${ps[v]!.id}`;
      treeEdges.push(id);
      trace.step(
        'grow',
        `${ps[v]!.id} is the closest point to the tree, ${show(Math.sqrt(best[v]!))} from ${ps[u]!.id}: add the edge ${ps[u]!.id}–${ps[v]!.id}.`,
      );
      graph
        .addEdge({
          edge: {
            id,
            from: ps[u]!.id,
            to: ps[v]!.id,
            weight: show(Math.sqrt(best[v]!)),
          },
        })
        .markEdge({ edge: id, mark: 'selected' })
        .highlight({ nodes: [ps[v]!.id] });
      for (let i = 0; i < n; i++)
        if (!inTree.has(i) && dist2(ps[i]!, ps[v]!) < best[i]!) {
          best[i] = dist2(ps[i]!, ps[v]!);
          via[i] = v;
        }
    }

    // A preorder walk of the tree, children in the order they joined.
    const order: number[] = [];
    const walk = (v: number) => {
      order.push(v);
      for (const c of children[v]!) walk(c);
    };
    walk(0);
    order.forEach((v, k) => {
      trace.step(
        'walk',
        k === 0
          ? `Walk the tree in preorder from ${r.id}: it is first, number 1.`
          : `The walk first reaches ${ps[v]!.id} next: number ${k + 1}.`,
      );
      graph
        .annotate({ node: ps[v]!.id, text: String(k + 1) })
        .highlight({ nodes: [ps[v]!.id] });
    });

    const stops = [...order, 0];
    const length = stops
      .slice(1)
      .reduce((s, v, k) => s + dist(ps[stops[k]!]!, ps[v]!), 0);
    trace.step(
      'tour',
      `Visit the points in that order, ${stops.map((v) => ps[v]!.id).join(' → ')}: the tour has length ${show(length)}.`,
    );
    for (const id of treeEdges) graph.markEdge({ edge: id, mark: 'rejected' });
    if (n === 2) graph.markEdge({ edge: treeEdges[0]!, mark: 'selected' });
    else
      stops.slice(1).forEach((v, k) => {
        const [a, b] = [ps[stops[k]!]!, ps[v]!];
        const id = `t:${a.id}-${b.id}`;
        graph
          .addEdge({ edge: { id, from: a.id, to: b.id } })
          .markEdge({ edge: id, mark: 'selected' });
      });
    trace.step(
      'done',
      `The tree weighs ${show(weight)}, no more than the shortest tour, which less one edge is a spanning tree. Walking the tree fully costs twice its weight, and skipping repeated points costs no more, so this tour, ${show(length)}, is at most twice the shortest.`,
    );
    graph.pointer({ name: 'r', node: null });
    return { results: [Math.round(length * 1000) / 1000] };
  },
});
