/**
 * Graph algorithms. Graphs are given as node names and `[from, to, weight]`
 * edges; neighbours are visited in the order edges are listed.
 */
import type { GraphDeclInput, VisualizationInput } from '@algoviz/spec';

import { Recorder } from './recorder.ts';
import { python } from './source.ts';

export interface GraphInput {
  readonly nodes: readonly string[];
  readonly edges: readonly (readonly [string, string, number?])[];
  readonly directed?: boolean;
}

interface Arc {
  readonly to: string;
  readonly weight: number;
  /** Id of the edge in the visualization. */
  readonly edge: string;
}

/** Adjacency lists, following edges both ways in undirected graphs. */
function adjacency(g: GraphInput): Map<string, Arc[]> {
  const out = new Map<string, Arc[]>(g.nodes.map((v) => [v, []]));
  for (const [from, to, weight = 1] of g.edges) {
    const edge = `${from}-${to}`;
    out.get(from)!.push({ to, weight, edge });
    if (!g.directed) out.get(to)!.push({ to: from, weight, edge });
  }
  return out;
}

const declare = (
  g: GraphInput,
  weighted: boolean,
  layered?: { readonly from: string },
): GraphDeclInput => ({
  kind: 'graph',
  directed: g.directed ?? false,
  // Layers count from the first node, so it goes first.
  ...(layered === undefined
    ? { nodes: [...g.nodes] }
    : {
        layout: 'layered',
        nodes: [layered.from, ...g.nodes.filter((v) => v !== layered.from)],
      }),
  edges: g.edges.map(([from, to, weight]) =>
    weighted && weight !== undefined ? [from, to, weight] : [from, to],
  ),
});

/** Rejects a start node that is not in the graph. */
function checkNode(g: GraphInput, node: string): void {
  if (!g.nodes.includes(node))
    throw new RangeError(`"${node}" is not a node of the graph`);
}

const show = (d: number) => (d === Infinity ? '∞' : String(d));

export function breadthFirstSearch(
  g: GraphInput,
  start: string,
): VisualizationInput {
  checkNode(g, start);
  const r = new Recorder({
    title: 'Breadth-first search',
    source: python(`
      def bfs(g, s):
          dist = {s: 0}
          queue = deque([s])
          while queue:
              u = queue.popleft()
              for v in g.neighbors(u):
                  if v not in dist:
                      dist[v] = dist[u] + 1
                      queue.append(v)
    `),
  });
  // Rows of the layered layout are the BFS layers from the start.
  const graph = r.add('g', declare(g, false, { from: start }));
  const queue = r.add('queue', { kind: 'queue', initial: [] });
  const adj = adjacency(g);
  const dist = new Map([[start, 0]]);
  const q = [start];
  r.step({ line: 3, narration: `Start at ${start}, at distance 0.` });
  graph.visit({ node: start }).annotate({ node: start, text: '0' });
  queue.enqueue({ element: { id: `q-${start}`, value: start } });
  while (q.length > 0) {
    const u = q.shift()!;
    r.step({ line: 5, narration: `Take ${u} from the front of the queue.` });
    queue.dequeue();
    graph.pointer({ name: 'u', node: u });
    for (const { to: v, edge } of adj.get(u)!) {
      r.step({
        line: 7,
        narration: dist.has(v)
          ? `${v} was already found.`
          : `Found ${v}, at distance ${dist.get(u)! + 1}.`,
      });
      graph.highlight({ edges: [edge] });
      if (!dist.has(v)) {
        dist.set(v, dist.get(u)! + 1);
        q.push(v);
        graph
          .visit({ node: v })
          .annotate({ node: v, text: String(dist.get(v)) });
        graph.markEdge({ edge, mark: 'selected' });
        queue.enqueue({ element: { id: `q-${v}`, value: v } });
      }
    }
    graph.settle({ node: u });
  }
  r.step('The queue is empty. Selected edges form a shortest-path tree.');
  graph.pointer({ name: 'u', node: null });
  return r.build();
}

export function depthFirstSearch(
  g: GraphInput,
  start: string,
): VisualizationInput {
  checkNode(g, start);
  const r = new Recorder({
    title: 'Depth-first search',
    source: python(`
      def dfs(g, u):
          visited.add(u)
          for v in g.neighbors(u):
              if v not in visited:
                  dfs(g, v)
          # u is finished
    `),
  });
  const graph = r.add('g', declare(g, false));
  const calls = r.add('calls', {
    kind: 'stack',
    label: 'call stack',
    initial: [],
  });
  const adj = adjacency(g);
  const visited = new Set<string>();
  let clock = 0;
  const found = new Map<string, number>();
  const dfs = (u: string): void => {
    visited.add(u);
    found.set(u, ++clock);
    r.step({ line: 2, narration: `Visit ${u} (discovered at time ${clock}).` });
    calls.push({ element: { id: `call-${u}`, value: `dfs(${u})` } });
    graph.visit({ node: u }).pointer({ name: 'u', node: u });
    graph.annotate({ node: u, text: `${clock}/` });
    for (const { to: v, edge } of adj.get(u)!) {
      r.step({
        line: 4,
        narration: visited.has(v)
          ? `${v} is already visited.`
          : `${v} is new: go deeper.`,
      });
      graph.highlight({ edges: [edge] });
      if (!visited.has(v)) {
        graph.markEdge({ edge, mark: 'selected' });
        dfs(v);
        r.step({ line: 5, narration: `Back at ${u}.` });
        graph.pointer({ name: 'u', node: u });
      }
    }
    ++clock;
    r.step({ line: 6, narration: `${u} is finished at time ${clock}.` });
    graph
      .settle({ node: u })
      .annotate({ node: u, text: `${found.get(u)}/${clock}` });
    calls.pop();
  };
  dfs(start);
  r.step('Done. Selected edges form the depth-first tree.');
  graph.pointer({ name: 'u', node: null });
  return r.build();
}

/** Weights must be non-negative; use Bellman–Ford otherwise. */
export function dijkstra(g: GraphInput, source: string): VisualizationInput {
  checkNode(g, source);
  if (g.edges.some(([, , w = 1]) => w < 0))
    throw new RangeError(
      'Dijkstra needs non-negative weights; use bellmanFord for negative ones',
    );
  const r = new Recorder({
    title: 'Dijkstra’s algorithm',
    source: python(`
      def dijkstra(g, s):
          dist = {v: inf for v in g}; dist[s] = 0
          done = set()
          while len(done) < len(g):
              u = min((v for v in g if v not in done), key=dist.get)
              if dist[u] == inf: break
              done.add(u)
              for v, w in g.neighbors(u):
                  if dist[u] + w < dist[v]:
                      dist[v] = dist[u] + w
                      parent[v] = u
    `),
  });
  const graph = r.add('g', declare(g, true));
  const adj = adjacency(g);
  const dist = new Map(g.nodes.map((v) => [v, v === source ? 0 : Infinity]));
  const via = new Map<string, string>();
  const done = new Set<string>();
  r.step({
    line: 2,
    narration: `Every distance is ∞ except ${source}'s, which is 0.`,
  });
  for (const v of g.nodes)
    graph.annotate({ node: v, text: show(dist.get(v)!) });
  while (done.size < g.nodes.length) {
    const u = g.nodes
      .filter((v) => !done.has(v))
      .reduce((a, b) => (dist.get(b)! < dist.get(a)! ? b : a));
    if (dist.get(u) === Infinity) {
      r.step({ line: 6, narration: 'The remaining nodes are unreachable.' });
      break;
    }
    done.add(u);
    r.step({
      line: 7,
      narration: `${u} has the smallest tentative distance, ${dist.get(u)}: it is final.`,
    });
    graph.pointer({ name: 'u', node: u }).settle({ node: u });
    for (const { to: v, weight, edge } of adj.get(u)!) {
      if (done.has(v)) continue;
      const candidate = dist.get(u)! + weight;
      const better = candidate < dist.get(v)!;
      r.step({
        line: better ? 10 : 9,
        narration: better
          ? `${dist.get(u)} + ${weight} = ${candidate} < ${show(dist.get(v)!)}: improve ${v}.`
          : `${dist.get(u)} + ${weight} = ${candidate} ≥ ${dist.get(v)}: keep ${v}.`,
      });
      graph.highlight({ nodes: [v], edges: [edge] });
      if (better) {
        const old = via.get(v);
        if (old !== undefined) graph.markEdge({ edge: old, mark: null });
        dist.set(v, candidate);
        via.set(v, edge);
        graph
          .annotate({ node: v, text: String(candidate) })
          .markEdge({ edge, mark: 'selected' });
      }
    }
  }
  r.step('Done. Selected edges form the shortest-path tree.');
  graph.pointer({ name: 'u', node: null });
  return r.build();
}

/** Edges are taken as directed, as Bellman–Ford is usually taught. */
export function bellmanFord(g: GraphInput, source: string): VisualizationInput {
  checkNode(g, source);
  const r = new Recorder({
    title: 'Bellman–Ford',
    source: python(`
      def bellman_ford(g, s):
          dist = {v: inf for v in g}; dist[s] = 0
          for _ in range(len(g) - 1):
              for u, v, w in g.edges:
                  if dist[u] + w < dist[v]:
                      dist[v] = dist[u] + w
          for u, v, w in g.edges:
              if dist[u] + w < dist[v]:
                  return 'negative cycle'
          return dist
    `),
  });
  const graph = r.add('g', declare({ ...g, directed: true }, true));
  const dist = new Map(g.nodes.map((v) => [v, v === source ? 0 : Infinity]));
  const via = new Map<string, string>();
  r.step({
    line: 2,
    narration: `Every distance is ∞ except ${source}'s, which is 0.`,
  });
  for (const v of g.nodes)
    graph.annotate({ node: v, text: show(dist.get(v)!) });
  for (let round = 1; round < g.nodes.length; round++) {
    let changed = false;
    r.step({
      line: 3,
      narration: `Round ${round}: relax every edge.`,
      vars: { round },
    });
    for (const [u, v, w = 1] of g.edges) {
      const edge = `${u}-${v}`;
      if (dist.get(u)! + w < dist.get(v)!) {
        dist.set(v, dist.get(u)! + w);
        changed = true;
        r.step({
          line: 6,
          narration: `${show(dist.get(u)!)} + ${w} improves ${v} to ${dist.get(v)}.`,
        });
        graph
          .highlight({ nodes: [v], edges: [edge] })
          .annotate({ node: v, text: String(dist.get(v)) });
        const old = via.get(v);
        if (old !== undefined) graph.markEdge({ edge: old, mark: null });
        via.set(v, edge);
        graph.markEdge({ edge, mark: 'selected' });
      }
    }
    if (!changed) {
      r.step({
        line: 3,
        narration:
          'Nothing changed in this round, so nothing will: stop early.',
      });
      break;
    }
  }
  for (const [u, v, w = 1] of g.edges)
    if (dist.get(u)! + w < dist.get(v)!) {
      r.step({
        line: 9,
        narration: `${u}→${v} can still be relaxed: there is a negative cycle.`,
      });
      graph
        .highlight({ edges: [`${u}-${v}`] })
        .markEdge({ edge: `${u}-${v}`, mark: 'rejected' });
      return r.build();
    }
  r.step({
    line: 10,
    narration: 'No edge can be relaxed: the distances are final.',
  });
  for (const v of g.nodes)
    if (dist.get(v) !== Infinity) graph.settle({ node: v });
  return r.build();
}

export function prim(g: GraphInput, start: string): VisualizationInput {
  checkNode(g, start);
  const r = new Recorder({
    title: 'Prim’s algorithm',
    source: python(`
      def prim(g, s):
          key = {v: inf for v in g}; key[s] = 0
          in_tree = set()
          while len(in_tree) < len(g):
              u = min((v for v in g if v not in in_tree), key=key.get)
              if key[u] == inf: break  # the rest is not connected
              in_tree.add(u)
              for v, w in g.neighbors(u):
                  if v not in in_tree and w < key[v]:
                      key[v] = w; parent[v] = u
    `),
  });
  const graph = r.add('g', declare({ ...g, directed: false }, true));
  const adj = adjacency({ ...g, directed: false });
  const key = new Map(g.nodes.map((v) => [v, v === start ? 0 : Infinity]));
  const via = new Map<string, string>();
  const inTree = new Set<string>();
  r.step({ line: 2, narration: `Grow the tree from ${start}.` });
  for (const v of g.nodes) graph.annotate({ node: v, text: show(key.get(v)!) });
  while (inTree.size < g.nodes.length) {
    const u = g.nodes
      .filter((v) => !inTree.has(v))
      .reduce((a, b) => (key.get(b)! < key.get(a)! ? b : a));
    if (key.get(u) === Infinity) {
      r.step({ line: 6, narration: 'The rest is not connected to the tree.' });
      break;
    }
    inTree.add(u);
    r.step({
      line: 7,
      narration: via.has(u)
        ? `The cheapest edge into the tree reaches ${u} (weight ${key.get(u)}): add it.`
        : `Start the tree at ${u}.`,
    });
    graph.settle({ node: u }).pointer({ name: 'u', node: u });
    if (via.has(u)) graph.markEdge({ edge: via.get(u)!, mark: 'selected' });
    for (const { to: v, weight, edge } of adj.get(u)!) {
      if (inTree.has(v) || weight >= key.get(v)!) continue;
      r.step({
        line: 10,
        narration: `${u}–${v} (weight ${weight}) is the cheapest way to ${v} so far.`,
      });
      graph
        .highlight({ edges: [edge] })
        .annotate({ node: v, text: String(weight) });
      key.set(v, weight);
      via.set(v, edge);
    }
  }
  r.step('Done. Selected edges form a minimum spanning tree.');
  graph.pointer({ name: 'u', node: null });
  return r.build();
}

export function kruskal(g: GraphInput): VisualizationInput {
  const r = new Recorder({
    title: 'Kruskal’s algorithm',
    source: python(`
      def kruskal(g):
          for u, v, w in sorted(g.edges, key=weight):
              if find(u) != find(v):
                  union(u, v)
                  mst.append((u, v, w))
    `),
  });
  const graph = r.add('g', declare({ ...g, directed: false }, true));
  const sets = r.add('sets', {
    kind: 'tree',
    label: 'union–find',
    nodes: g.nodes.map((v) => ({ id: v, value: v })),
  });
  const parent = new Map(g.nodes.map((v) => [v, v]));
  const find = (v: string): string =>
    parent.get(v) === v ? v : find(parent.get(v)!);
  const sorted = g.edges
    .map(([u, v, w = 1], k) => ({ u, v, w, k }))
    .sort((a, b) => a.w - b.w || a.k - b.k);
  r.step({
    line: 2,
    narration: 'Consider the edges from lightest to heaviest.',
  });
  for (const { u, v, w } of sorted) {
    const edge = `${u}-${v}`;
    const [ru, rv] = [find(u), find(v)];
    r.step({
      line: 3,
      narration: `${u}–${v} (weight ${w}): ${u} is in set ${ru}, ${v} in set ${rv}.`,
    });
    graph.highlight({ edges: [edge] });
    sets.highlight({ nodes: [ru, rv] });
    if (ru === rv) {
      r.step({
        line: 3,
        narration: `Same set: ${u}–${v} would close a cycle. Skip it.`,
      });
      graph.markEdge({ edge, mark: 'rejected' });
      continue;
    }
    r.step({
      line: 4,
      narration: `Different sets: take ${u}–${v} and merge the sets.`,
    });
    graph.markEdge({ edge, mark: 'selected' });
    sets.setChild({ parent: ru, child: rv });
    parent.set(rv, ru);
  }
  r.step('Done. Selected edges form a minimum spanning forest.');
  return r.build();
}

export function topologicalSort(g: GraphInput): VisualizationInput {
  const r = new Recorder({
    title: 'Topological sort (Kahn’s algorithm)',
    source: python(`
      def topo_sort(g):
          indeg = {v: 0 for v in g}
          for u, v in g.edges: indeg[v] += 1
          queue = deque(v for v in g if indeg[v] == 0)
          order = []
          while queue:
              u = queue.popleft()
              order.append(u)
              for v in g.successors(u):
                  indeg[v] -= 1
                  if indeg[v] == 0: queue.append(v)
          return order  # shorter than g if there is a cycle
    `),
  });
  const graph = r.add('g', declare({ ...g, directed: true }, false));
  const queue = r.add('queue', { kind: 'queue', initial: [] });
  const order = r.add('order', { kind: 'array', initial: [] });
  const adj = adjacency({ ...g, directed: true });
  const indeg = new Map(g.nodes.map((v) => [v, 0]));
  for (const [, v] of g.edges) indeg.set(v, indeg.get(v)! + 1);
  r.step({ line: 3, narration: 'Count the edges coming into each node.' });
  for (const v of g.nodes)
    graph.annotate({ node: v, text: `in ${indeg.get(v)}` });
  const q = g.nodes.filter((v) => indeg.get(v) === 0);
  r.step({
    line: 4,
    narration: `Nodes with nothing before them: ${q.join(', ') || 'none'}.`,
  });
  for (const v of q) queue.enqueue({ element: { id: `q-${v}`, value: v } });
  let written = 0;
  while (q.length > 0) {
    const u = q.shift()!;
    r.step({ line: 8, narration: `${u} comes next.` });
    queue.dequeue();
    graph.settle({ node: u }).pointer({ name: 'u', node: u });
    order.insert({ index: written++, element: { id: `o-${u}`, value: u } });
    for (const { to: v, edge } of adj.get(u)!) {
      indeg.set(v, indeg.get(v)! - 1);
      r.step({
        line: 10,
        narration: `Remove ${u}→${v}: ${v} has ${indeg.get(v)} incoming edge(s) left.`,
      });
      graph
        .markEdge({ edge, mark: 'rejected' })
        .annotate({ node: v, text: `in ${indeg.get(v)}` });
      if (indeg.get(v) === 0) {
        q.push(v);
        queue.enqueue({ element: { id: `q-${v}`, value: v } });
      }
    }
  }
  r.step({
    line: 12,
    narration:
      written === g.nodes.length
        ? 'Every node is placed: this is a topological order.'
        : 'Some nodes were never freed: the graph has a cycle.',
  });
  graph.pointer({ name: 'u', node: null });
  return r.build();
}

export function floydWarshall(g: GraphInput): VisualizationInput {
  const r = new Recorder({
    title: 'Floyd–Warshall',
    source: python(`
      def floyd_warshall(d):
          n = len(d)
          for k in range(n):
              for i in range(n):
                  for j in range(n):
                      if d[i][k] + d[k][j] < d[i][j]:
                          d[i][j] = d[i][k] + d[k][j]
    `),
  });
  const n = g.nodes.length;
  const index = new Map(g.nodes.map((v, k) => [v, k]));
  const d = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
  );
  for (const [u, v, w = 1] of g.edges) {
    const [i, j] = [index.get(u)!, index.get(v)!];
    d[i]![j] = Math.min(d[i]![j]!, w);
    if (!g.directed) d[j]![i] = Math.min(d[j]![i]!, w);
  }
  const graph = r.add('g', declare(g, true));
  const table = r.add('dist', {
    kind: 'table',
    initial: d.map((row) => row.map((x) => (x === Infinity ? '∞' : x))),
    rowLabels: [...g.nodes],
    columnLabels: [...g.nodes],
  });
  for (let k = 0; k < n; k++) {
    r.step({
      line: 3,
      narration: `Allow paths through ${g.nodes[k]}.`,
      vars: { k },
    });
    graph.pointer({ name: 'k', node: g.nodes[k]! });
    // Paths starting or ending at k can only improve through a negative
    // cycle at k, so those steps are shown only then.
    const cycleAtK = d[k]![k]! < 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if ((i === k || j === k) && !cycleAtK) continue;
        const through = d[i]![k]! + d[k]![j]!;
        if (through === Infinity) continue;
        const better = through < d[i]![j]!;
        r.step({
          line: better ? 7 : 6,
          narration: `${g.nodes[i]}→${g.nodes[k]}→${g.nodes[j]} costs ${through}, ${better ? 'better than' : 'not better than'} ${show(d[i]![j]!)}.`,
          vars: { k, i, j },
        });
        table.depend({
          cell: [i, j],
          on: [
            [i, k],
            [k, j],
          ],
        });
        if (better) {
          d[i]![j] = through;
          table.set({ cell: [i, j], value: through });
        }
      }
  }
  const negative = g.nodes.filter((_, i) => d[i]![i]! < 0);
  r.step(
    negative.length === 0
      ? 'Done: every entry is a shortest distance.'
      : `Negative diagonal entries (${negative.join(', ')}) reveal a negative cycle: distances through it have no minimum.`,
  );
  if (negative.length > 0)
    table.highlight({
      cells: negative.map((v) => [g.nodes.indexOf(v), g.nodes.indexOf(v)]),
    });
  graph.pointer({ name: 'k', node: null });
  return r.build();
}
