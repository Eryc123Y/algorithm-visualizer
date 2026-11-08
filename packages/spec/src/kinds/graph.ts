/**
 * The `graph` kind: directed or undirected graphs with optional edge
 * weights, for traversals, shortest paths, spanning trees, topological
 * sorting and flows.
 *
 * Node ids double as names: the shorthand `"nodes": ["A", "B"]` declares
 * nodes A and B, and the edge `["A", "B", 4]` gets the id `A-B`.
 *
 * Marks: `highlight` lasts one step; `visit`, `settle`, `group`, `pointer`,
 * `annotate` and `markEdge` persist until changed or `resetMarks`.
 */
import { z } from 'zod';

import {
  ElementId,
  Group,
  LIMITS,
  Place,
  PointerName,
  Scalar,
} from '../common.ts';
import { typesOf, type DeclIssue, type IdRef, type KindSpec } from './kind.ts';

const Coordinate = z.number().min(-1e5).max(1e5);

export const GraphNode = z
  .strictObject({
    id: ElementId,
    value: Scalar,
    x: Coordinate.optional(),
    y: Coordinate.optional(),
  })
  .describe(
    'A node. `x` and `y` place it by hand (units are pixels at 1×; used by the "manual" layout).',
  );
export type GraphNode = z.infer<typeof GraphNode>;

const NodeInput = z
  .union([
    GraphNode.extend({ value: Scalar.optional() }),
    z.string(),
    z.number(),
  ])
  .describe(
    'A node, or a bare name such as "A" or 3 that serves as both id and value. Without `value`, a node shows its id.',
  );
type NodeInput = z.infer<typeof NodeInput>;

const NodeRef = ElementId.describe('A node id.');
const EdgeRef = ElementId.describe('An edge id, by default "from-to".');

const Weight = Scalar.describe(
  'Shown beside the edge: a weight, a capacity, or text such as "3/5".',
);

export const GraphEdge = z
  .strictObject({
    id: ElementId,
    from: NodeRef,
    to: NodeRef,
    weight: Weight.optional(),
  })
  .describe(
    'An edge; in undirected graphs `from` and `to` are interchangeable.',
  );
export type GraphEdge = z.infer<typeof GraphEdge>;

const EdgeInput = z
  .union([
    GraphEdge.extend({ id: ElementId.optional() }),
    z.tuple([NodeRef, NodeRef]),
    z.tuple([NodeRef, NodeRef, Weight]),
  ])
  .describe(
    'An edge, or `[from, to]` / `[from, to, weight]`. The id defaults to "from-to".',
  );
type EdgeInput = z.infer<typeof EdgeInput>;

export const GraphLayout = z
  .enum(['auto', 'circle', 'layered', 'grid', 'manual'])
  .describe(
    '"layered" ranks nodes top to bottom along edges (good for DAGs and trees); "circle" places them on a circle; "grid" in rows; "manual" uses each node’s x and y. "auto" (default) is manual when every node has x and y, else layered for acyclic directed graphs, else circle.',
  );
export type GraphLayout = z.infer<typeof GraphLayout>;

export const GraphDecl = z
  .strictObject({
    kind: z.literal('graph'),
    label: z.string().max(LIMITS.textLength).optional(),
    place: Place.optional(),
    directed: z.boolean(),
    layout: GraphLayout,
    nodes: z.array(GraphNode).max(LIMITS.elementsPerStructure),
    edges: z.array(GraphEdge).max(LIMITS.edgesPerStructure),
  })
  .describe('A graph.');
export type GraphDecl = z.infer<typeof GraphDecl>;

export const GraphDeclInput = z.strictObject({
  kind: z.literal('graph'),
  label: z.string().max(LIMITS.textLength).optional(),
  place: Place.optional(),
  directed: z.boolean().optional().describe('Default false.'),
  layout: GraphLayout.optional(),
  nodes: z.array(NodeInput).max(LIMITS.elementsPerStructure).optional(),
  edges: z.array(EdgeInput).max(LIMITS.edgesPerStructure).optional(),
});
export type GraphDeclInput = z.infer<typeof GraphDeclInput>;

const normalizeNode = (input: NodeInput): GraphNode =>
  typeof input === 'object'
    ? { ...input, value: input.value === undefined ? input.id : input.value }
    : { id: String(input), value: input };

const normalizeEdge = (input: EdgeInput): GraphEdge => {
  if (Array.isArray(input)) {
    const [from, to, weight] = input;
    return {
      id: `${from}-${to}`,
      from,
      to,
      ...(weight === undefined ? {} : { weight }),
    };
  }
  return { ...input, id: input.id ?? `${input.from}-${input.to}` };
};

function normalizeGraphDecl(input: GraphDeclInput): GraphDecl {
  const { nodes, edges, directed, layout, ...rest } = input;
  return {
    ...rest,
    directed: directed ?? false,
    layout: layout ?? 'auto',
    nodes: (nodes ?? []).map(normalizeNode),
    edges: (edges ?? []).map(normalizeEdge),
  };
}

/** Ids generated from names must still be valid ids. */
function idIssues(id: string, path: readonly PropertyKey[]): DeclIssue[] {
  return ElementId.safeParse(id).success
    ? []
    : [
        {
          path,
          message: `"${id}" is not a valid id`,
          hint: 'Ids use letters, digits and _ . : - (at most 64). Give the node as { "id", "value" } to show other text.',
        },
      ];
}

export function validateGraphDecl(decl: GraphDecl): DeclIssue[] {
  const nodes = new Set(decl.nodes.map((n) => n.id));
  const issues: DeclIssue[] = decl.nodes.flatMap((n, k) =>
    idIssues(n.id, ['nodes', k]),
  );
  decl.edges.forEach((edge, k) => {
    issues.push(...idIssues(edge.id, ['edges', k]));
    for (const end of ['from', 'to'] as const)
      if (!nodes.has(edge[end]))
        issues.push({
          path: ['edges', k, end],
          message: `Edge "${edge.id}" ends at "${edge[end]}", which is not a node`,
        });
  });
  if (decl.layout === 'manual')
    decl.nodes.forEach((n, k) => {
      if (n.x === undefined || n.y === undefined)
        issues.push({
          path: ['nodes', k],
          message: `Node "${n.id}" needs x and y for the manual layout`,
        });
    });
  return issues;
}

const nodes = z.array(NodeRef).max(LIMITS.elementsPerStructure);
const edges = z.array(EdgeRef).max(LIMITS.edgesPerStructure);

const actions = <N extends z.ZodType, E extends z.ZodType>(
  newNode: N,
  newEdge: E,
) =>
  z.discriminatedUnion('type', [
    z
      .strictObject({ type: z.literal('addNode'), node: newNode })
      .describe('Add a node.'),
    z
      .strictObject({ type: z.literal('removeNode'), node: NodeRef })
      .describe('Remove a node and every edge at it.'),
    z
      .strictObject({
        type: z.literal('setValue'),
        node: NodeRef,
        value: Scalar,
      })
      .describe('Change the text shown in a node.'),
    z
      .strictObject({ type: z.literal('addEdge'), edge: newEdge })
      .describe('Add an edge between existing nodes.'),
    z
      .strictObject({ type: z.literal('removeEdge'), edge: EdgeRef })
      .describe('Remove an edge.'),
    z
      .strictObject({
        type: z.literal('setWeight'),
        edge: EdgeRef,
        weight: Weight.nullable(),
      })
      .describe('Change an edge’s weight or label; null removes it.'),
    z
      .strictObject({
        type: z.literal('highlight'),
        nodes: nodes.optional(),
        edges: edges.optional(),
      })
      .describe(
        'Highlight nodes and edges (this step only), e.g. an edge being relaxed.',
      ),
    z
      .strictObject({ type: z.literal('visit'), node: NodeRef })
      .describe('Mark a node as visited, e.g. discovered by a search.'),
    z
      .strictObject({ type: z.literal('settle'), node: NodeRef })
      .describe('Mark a node as finished, e.g. its distance is final.'),
    z
      .strictObject({ type: z.literal('group'), node: NodeRef, group: Group })
      .describe(
        'Put a node in a categorical group 0–5 (e.g. a component or a colour); null removes it.',
      ),
    z
      .strictObject({
        type: z.literal('pointer'),
        name: PointerName,
        node: NodeRef.nullable(),
      })
      .describe('Point a named pointer at a node; null removes it.'),
    z
      .strictObject({
        type: z.literal('annotate'),
        node: NodeRef,
        text: z.string().max(32).nullable(),
      })
      .describe(
        'Show a short note above a node, e.g. a distance "d=4" or "∞"; null removes it.',
      ),
    z
      .strictObject({
        type: z.literal('markEdge'),
        edge: EdgeRef,
        mark: z.enum(['selected', 'rejected']).nullable(),
      })
      .describe(
        'Mark an edge as selected (e.g. in the spanning tree or shortest-path tree) or rejected (e.g. it would close a cycle); null clears it.',
      ),
    z
      .strictObject({ type: z.literal('resetMarks') })
      .describe(
        'Clear every mark: visits, settled nodes, groups, pointers, notes and edge marks.',
      ),
  ]);

export const GraphAction = actions(GraphNode, GraphEdge);
export type GraphAction = z.infer<typeof GraphAction>;
export const GraphActionInput = actions(NodeInput, EdgeInput);
export type GraphActionInput = z.infer<typeof GraphActionInput>;

export const graphSpec: KindSpec<{
  decl: GraphDecl;
  declInput: GraphDeclInput;
  action: GraphAction;
  actionInput: GraphActionInput;
}> = {
  kind: 'graph',
  decl: GraphDecl,
  declInput: GraphDeclInput,
  action: GraphAction,
  actionInput: GraphActionInput,
  actionTypes: typesOf(GraphAction),
  normalizeDecl: normalizeGraphDecl,
  declIds: (decl) => [
    ...decl.nodes.map((n, k): IdRef => ({ id: n.id, path: ['nodes', k] })),
    ...decl.edges.map((e, k): IdRef => ({ id: e.id, path: ['edges', k] })),
  ],
  validateDecl: validateGraphDecl,
  normalizeAction: (input) => {
    if (input.type === 'addNode')
      return { ...input, node: normalizeNode(input.node) };
    if (input.type === 'addEdge')
      return { ...input, edge: normalizeEdge(input.edge) };
    return input;
  },
  introducedIds: (action) =>
    action.type === 'addNode'
      ? [{ id: action.node.id, path: ['node'] }]
      : action.type === 'addEdge'
        ? [{ id: action.edge.id, path: ['edge'] }]
        : [],
};
