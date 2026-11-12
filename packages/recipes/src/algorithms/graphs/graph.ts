/**
 * What the graph modules share (ADR 0023): the input graph, given as node
 * names and `[from, to]` or `[from, to, weight]` edges, its checks, edge
 * ids, adjacency lists and the declaration that draws it. Neighbours are
 * taken in the order edges are listed.
 */
import type { GraphDeclInput } from '@algomotion/spec';
import { z } from 'zod';

import { graphField } from '../../notation/schema.ts';

/** Most nodes and edges a graph has, so it fits on one screen. */
export const MAX_NODES = 40;
export const MAX_EDGES = 200;
/**
 * Largest weight, either way: sums along 40 passes of a negative cycle
 * then stay far from overflowing to ±∞.
 */
export const MAX_WEIGHT = 1e9;

export interface GraphInput {
  readonly nodes: readonly string[];
  readonly edges: readonly (readonly [string, string, number?])[];
  readonly directed?: boolean;
}

/** The structured form of an input graph. */
const GraphObject = z
  .strictObject({
    nodes: z
      .array(z.string())
      .min(1)
      .max(MAX_NODES)
      .describe('Node names, e.g. ["A", "B", "C"].'),
    edges: z
      .array(
        z.union([
          z.tuple([z.string(), z.string()]),
          z.tuple([
            z.string(),
            z.string(),
            z.number().min(-MAX_WEIGHT).max(MAX_WEIGHT),
          ]),
        ]),
      )
      .max(MAX_EDGES)
      .describe(
        'Edges as [from, to] or [from, to, weight]; weight 1 by default, at most 1e9 either way.',
      ),
    directed: z.boolean().optional().describe('Default false.'),
  })
  .describe('A graph.');

/**
 * The input graph of every graph module: its structured form, or the edge
 * list notation (ADR 0032).
 */
export const Graph = graphField(GraphObject, {
  maxNodes: MAX_NODES,
  maxEdges: MAX_EDGES,
  maxWeight: MAX_WEIGHT,
});

/** Node names become ids, so they must be short and use id characters. */
const NODE_NAME = /^[A-Za-z0-9_.:-]{1,24}$/;

/**
 * The graph a module works on, checked: node names that can be ids, no
 * node twice, edges between nodes, and finite weights. Throws a RangeError
 * that says what is wrong.
 */
export function graphOf(input: z.output<typeof Graph>): GraphInput {
  const names = new Set<string>();
  for (const v of input.nodes) {
    if (!NODE_NAME.test(v))
      throw new RangeError(
        `Node name "${v}" must be 1 to 24 letters, digits or _ . : -`,
      );
    if (names.has(v)) throw new RangeError(`Node "${v}" is listed twice`);
    names.add(v);
  }
  for (const [from, to, weight] of input.edges) {
    for (const end of [from, to])
      if (!names.has(end))
        throw new RangeError(
          `Edge ${from}–${to} ends at "${end}", which is not a node`,
        );
    if (weight !== undefined && !Number.isFinite(weight))
      throw new RangeError(
        `Edge ${from}–${to} has a weight that is not a finite number`,
      );
  }
  const { directed, ...rest } = input;
  return directed === undefined ? rest : { ...rest, directed };
}

/** Throws unless `node` is a node of the graph. */
export function checkNode(g: GraphInput, node: string): void {
  if (!g.nodes.includes(node))
    throw new RangeError(`"${node}" is not a node of the graph`);
}

/**
 * The node to start from: `node` if given, checked, or else the first
 * node (ADR 0032).
 */
export function startOf(g: GraphInput, node: string | undefined): string {
  if (node === undefined) return g.nodes[0]!;
  checkNode(g, node);
  return node;
}

/**
 * The id of each input edge: "from-to", with ".2", ".3", … appended when
 * that id is taken by a node or an earlier edge.
 */
export function edgeIds(g: GraphInput): string[] {
  // Nodes and edges share one id namespace.
  const taken = new Set(g.nodes);
  return g.edges.map(([from, to]) => {
    const base = `${from}-${to}`;
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}.${n}`;
    taken.add(id);
    return id;
  });
}

export interface Arc {
  readonly to: string;
  readonly weight: number;
  /** Id of the edge in the document. */
  readonly edge: string;
}

/** Adjacency lists, following edges both ways in undirected graphs. */
export function adjacency(g: GraphInput): Map<string, Arc[]> {
  const out = new Map<string, Arc[]>(g.nodes.map((v) => [v, []]));
  const ids = edgeIds(g);
  for (const [k, [from, to, weight = 1]] of g.edges.entries()) {
    const edge = ids[k]!;
    out.get(from)!.push({ to, weight, edge });
    if (!g.directed) out.get(to)!.push({ to: from, weight, edge });
  }
  return out;
}

/**
 * The declaration that draws `g`, with weights if `weighted`, and in
 * layers from `layered.from` if given.
 */
export function declareGraph(
  g: GraphInput,
  weighted: boolean,
  layered?: { readonly from: string },
): GraphDeclInput {
  const ids = edgeIds(g);
  return {
    kind: 'graph',
    // The graph's name in the pseudocode, as its caption.
    label: 'G',
    directed: g.directed ?? false,
    // Layers count from the first node, so it goes first.
    ...(layered === undefined
      ? { nodes: [...g.nodes] }
      : {
          layout: 'layered',
          nodes: [layered.from, ...g.nodes.filter((v) => v !== layered.from)],
        }),
    // Shorthand tuples where the default id fits, objects for repeats.
    edges: g.edges.map(([from, to, weight], k) => {
      const shown = weighted && weight !== undefined;
      if (ids[k] === `${from}-${to}`)
        return shown ? [from, to, weight] : [from, to];
      return { id: ids[k]!, from, to, ...(shown ? { weight } : {}) };
    }),
  };
}

/** A distance for narrations and annotations. */
export const shown = (d: number): string => (d === Infinity ? '∞' : String(d));

/** Adding a weight, for narrations: "+ 3" or "− 3". */
export const plus = (w: number): string => (w < 0 ? `− ${-w}` : `+ ${w}`);

/** Example graphs, as inputs. */
export const CITIES: z.output<typeof Graph> = {
  nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
  edges: [
    ['A', 'B', 7],
    ['A', 'C', 9],
    ['A', 'F', 14],
    ['B', 'C', 10],
    ['B', 'D', 15],
    ['C', 'D', 11],
    ['C', 'F', 2],
    ['D', 'E', 6],
    ['E', 'F', 9],
  ],
};

export const CLOTHES: z.output<typeof Graph> = {
  directed: true,
  nodes: [
    'undershorts',
    'socks',
    'pants',
    'shoes',
    'shirt',
    'belt',
    'tie',
    'jacket',
  ],
  edges: [
    ['undershorts', 'pants'],
    ['undershorts', 'shoes'],
    ['pants', 'belt'],
    ['pants', 'shoes'],
    ['belt', 'jacket'],
    ['shirt', 'belt'],
    ['shirt', 'tie'],
    ['tie', 'jacket'],
    ['socks', 'shoes'],
  ],
};
