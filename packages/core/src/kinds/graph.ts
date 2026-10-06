/**
 * Reducer for the `graph` kind. Nodes and edges are kept in order of
 * creation; removing a node removes its edges and every mark on them.
 */
import {
  err,
  LIMITS,
  ok,
  type GraphAction,
  type GraphDecl,
  type GraphNode,
  type GraphLayout,
  type GroupIndexValue,
  type Result,
  type Scalar,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind } from '../kind.ts';
import { checkCapacity, notFound, without } from './common.ts';

/** A node as declared; `x` and `y` place it for the manual layout. */
export type GraphNodeState = GraphNode;

export interface GraphEdgeState {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly weight: Scalar | null;
}

export type EdgeMark = 'selected' | 'rejected';

export interface GraphMarks {
  readonly highlightNodes: readonly string[];
  readonly highlightEdges: readonly string[];
  readonly visited: readonly string[];
  readonly settled: readonly string[];
  readonly groups: Readonly<Record<string, GroupIndexValue>>;
  readonly pointers: Readonly<Record<string, string>>;
  readonly notes: Readonly<Record<string, string>>;
  readonly edgeMarks: Readonly<Record<string, EdgeMark>>;
}

export interface GraphState {
  readonly data: {
    readonly nodes: readonly GraphNodeState[];
    readonly edges: readonly GraphEdgeState[];
  };
  readonly marks: GraphMarks;
  readonly directed: boolean;
  readonly layout: GraphLayout;
}

type Reduced = Result<GraphState, ReduceError>;

const emptyMarks: GraphMarks = {
  highlightNodes: [],
  highlightEdges: [],
  visited: [],
  settled: [],
  groups: {},
  pointers: {},
  notes: {},
  edgeMarks: {},
};

const edgeState = (e: GraphDecl['edges'][number]): GraphEdgeState => ({
  id: e.id,
  from: e.from,
  to: e.to,
  weight: e.weight ?? null,
});

function init(decl: GraphDecl): GraphState {
  return {
    data: { nodes: decl.nodes, edges: decl.edges.map(edgeState) },
    marks: emptyMarks,
    directed: decl.directed,
    layout: decl.layout,
  };
}

const filterRecord = <V>(
  record: Readonly<Record<string, V>>,
  keep: (key: string, value: V) => boolean,
): Record<string, V> =>
  Object.fromEntries(Object.entries(record).filter(([k, v]) => keep(k, v)));

function reduceGraph(s: GraphState, a: GraphAction): Reduced {
  const { data, marks } = s;
  const hasNode = (id: string) => data.nodes.some((n) => n.id === id);
  const hasEdge = (id: string) => data.edges.some((e) => e.id === id);
  const missingNode = (path: readonly PropertyKey[], id: string | null) =>
    id !== null && !hasNode(id) ? notFound(path, id, 'node') : undefined;
  const missingEdge = (path: readonly PropertyKey[], id: string) =>
    hasEdge(id) ? undefined : notFound(path, id, 'edge');
  const result = (
    nextData: GraphState['data'],
    nextMarks: Partial<GraphMarks> = {},
  ): Reduced => ok({ ...s, data: nextData, marks: { ...marks, ...nextMarks } });
  const withMarks = (nextMarks: Partial<GraphMarks>) => result(data, nextMarks);

  switch (a.type) {
    case 'addNode': {
      const bad = checkCapacity('graph', data.nodes.length);
      if (bad) return err(bad);
      if (hasNode(a.node.id) || hasEdge(a.node.id))
        return err({
          code: 'DUPLICATE_ID',
          path: ['node', 'id'],
          message: `The id "${a.node.id}" is already in use`,
        });
      return result({ ...data, nodes: [...data.nodes, a.node] });
    }
    case 'removeNode': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      const edges = data.edges.filter(
        (e) => e.from !== a.node && e.to !== a.node,
      );
      const liveEdges = new Set(edges.map((e) => e.id));
      const keep = (id: string) => id !== a.node;
      return result(
        { nodes: data.nodes.filter((n) => keep(n.id)), edges },
        {
          highlightNodes: marks.highlightNodes.filter(keep),
          highlightEdges: marks.highlightEdges.filter((e) => liveEdges.has(e)),
          visited: marks.visited.filter(keep),
          settled: marks.settled.filter(keep),
          groups: filterRecord(marks.groups, keep),
          pointers: filterRecord(marks.pointers, (_, id) => keep(id)),
          notes: filterRecord(marks.notes, keep),
          edgeMarks: filterRecord(marks.edgeMarks, (id) => liveEdges.has(id)),
        },
      );
    }
    case 'setValue': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      return result({
        ...data,
        nodes: data.nodes.map((n) =>
          n.id === a.node ? { ...n, value: a.value } : n,
        ),
      });
    }
    case 'addEdge': {
      const bad =
        missingNode(['edge', 'from'], a.edge.from) ??
        missingNode(['edge', 'to'], a.edge.to) ??
        checkCapacity('graph', data.edges.length, LIMITS.edgesPerStructure);
      if (bad) return err(bad);
      if (hasNode(a.edge.id) || hasEdge(a.edge.id))
        return err({
          code: 'DUPLICATE_ID',
          path: ['edge', 'id'],
          message: `The id "${a.edge.id}" is already in use`,
        });
      return result({ ...data, edges: [...data.edges, edgeState(a.edge)] });
    }
    case 'removeEdge': {
      const bad = missingEdge(['edge'], a.edge);
      if (bad) return err(bad);
      return result(
        { ...data, edges: data.edges.filter((e) => e.id !== a.edge) },
        {
          highlightEdges: marks.highlightEdges.filter((e) => e !== a.edge),
          edgeMarks: without(marks.edgeMarks, a.edge),
        },
      );
    }
    case 'setWeight': {
      const bad = missingEdge(['edge'], a.edge);
      if (bad) return err(bad);
      return result({
        ...data,
        edges: data.edges.map((e) =>
          e.id === a.edge ? { ...e, weight: a.weight } : e,
        ),
      });
    }
    case 'highlight': {
      const nodes = a.nodes ?? [];
      const edges = a.edges ?? [];
      for (const [k, id] of nodes.entries()) {
        const bad = missingNode(['nodes', k], id);
        if (bad) return err(bad);
      }
      for (const [k, id] of edges.entries()) {
        const bad = missingEdge(['edges', k], id);
        if (bad) return err(bad);
      }
      return withMarks({ highlightNodes: nodes, highlightEdges: edges });
    }
    case 'visit':
    case 'settle': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      const key = a.type === 'visit' ? 'visited' : 'settled';
      if (marks[key].includes(a.node)) return ok(s);
      return withMarks({ [key]: [...marks[key], a.node] });
    }
    case 'group': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      return withMarks({
        groups:
          a.group === null
            ? without(marks.groups, a.node)
            : { ...marks.groups, [a.node]: a.group },
      });
    }
    case 'pointer': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      return withMarks({
        pointers:
          a.node === null
            ? without(marks.pointers, a.name)
            : { ...marks.pointers, [a.name]: a.node },
      });
    }
    case 'annotate': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      return withMarks({
        notes:
          a.text === null
            ? without(marks.notes, a.node)
            : { ...marks.notes, [a.node]: a.text },
      });
    }
    case 'markEdge': {
      const bad = missingEdge(['edge'], a.edge);
      if (bad) return err(bad);
      return withMarks({
        edgeMarks:
          a.mark === null
            ? without(marks.edgeMarks, a.edge)
            : { ...marks.edgeMarks, [a.edge]: a.mark },
      });
    }
    case 'resetMarks':
      return ok({ ...s, marks: emptyMarks });
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const graphKind: StructureKind<GraphDecl, GraphState, GraphAction> = {
  init,
  beginStep: (s) =>
    s.marks.highlightNodes.length === 0 && s.marks.highlightEdges.length === 0
      ? s
      : {
          ...s,
          marks: { ...s.marks, highlightNodes: [], highlightEdges: [] },
        },
  reduce: reduceGraph,
};
