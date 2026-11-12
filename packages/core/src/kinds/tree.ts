/**
 * Reducer for the `tree` kind.
 *
 * Nodes are kept in a list (in order of creation) with ordered child slots;
 * `roots` lists the roots of the forest left to right. Every structural
 * action keeps the forest valid: each node has at most one parent and there
 * are no cycles.
 *
 * Marks that hang on the shape (ADR 0034) follow it: a pointer at an empty
 * slot (NIL) goes when the slot fills or its parent goes, and an edge's
 * mark and label go when its lower end gets another parent or slot.
 */
import {
  err,
  ok,
  type GroupIndexValue,
  type Result,
  type Scalar,
  type TreeAction,
  type TreeDecl,
} from '@algomotion/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind } from '../kind.ts';
import {
  checkCapacity,
  checkRange,
  insertAt,
  notFound,
  without,
} from './common.ts';

export interface TreeNodeState {
  readonly id: string;
  readonly value: Scalar;
  readonly children: readonly (string | null)[];
  readonly color: 'red' | 'black' | null;
}

export interface TreeData {
  readonly nodes: readonly TreeNodeState[];
  readonly roots: readonly string[];
}

/** An empty child slot of a binary tree: the NIL leaf a pointer names. */
export interface NilSlot {
  readonly parent: string;
  readonly slot: number;
}

/** What a tree pointer points at: a node id, or a NIL slot. */
export type TreePointerTarget = string | NilSlot;

export const isNilSlot = (target: TreePointerTarget): target is NilSlot =>
  typeof target !== 'string';

export interface TreeMarks {
  readonly highlight: readonly string[];
  readonly compare: readonly [string, string] | null;
  readonly visited: readonly string[];
  readonly settled: readonly string[];
  readonly groups: Readonly<Record<string, GroupIndexValue>>;
  readonly pointers: Readonly<Record<string, TreePointerTarget>>;
  /** The plain note of each node. */
  readonly notes: Readonly<Record<string, string>>;
  /** Named notes by node, then by field, in the order first set. */
  readonly namedNotes: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
  /** Marks of edges, by the edge's lower end. */
  readonly edgeMarks: Readonly<Record<string, 'selected' | 'rejected'>>;
  /** Labels of edges, by the edge's lower end. */
  readonly edgeLabels: Readonly<Record<string, string | number>>;
}

export interface TreeState {
  readonly data: TreeData;
  readonly marks: TreeMarks;
  readonly binary: boolean;
}

type Reduced = Result<TreeState, ReduceError>;

/** Most named notes one node holds (ADR 0034), so its label stays short. */
export const MAX_NAMED_NOTES = 4;

const emptyMarks: TreeMarks = {
  highlight: [],
  compare: null,
  visited: [],
  settled: [],
  groups: {},
  pointers: {},
  notes: {},
  namedNotes: {},
  edgeMarks: {},
  edgeLabels: {},
};

function init(decl: TreeDecl): TreeState {
  const nodes = decl.nodes.map((n): TreeNodeState => ({
    id: n.id,
    value: n.value,
    children: decl.binary
      ? [n.children?.[0] ?? null, n.children?.[1] ?? null]
      : (n.children ?? []),
    color: n.color ?? null,
  }));
  return {
    data: { nodes, roots: decl.roots },
    marks: emptyMarks,
    binary: decl.binary,
  };
}

/** Where a node hangs: under a parent's slot, or at a position in `roots`. */
type Place =
  | { readonly parent: string; readonly slot: number }
  | { readonly root: number };

function placeOf(data: TreeData, id: string): Place | undefined {
  const root = data.roots.indexOf(id);
  if (root >= 0) return { root };
  for (const node of data.nodes) {
    const slot = node.children.indexOf(id);
    if (slot >= 0) return { parent: node.id, slot };
  }
  return undefined;
}

const updateNode = (
  data: TreeData,
  id: string,
  f: (n: TreeNodeState) => TreeNodeState,
): TreeData => ({
  ...data,
  nodes: data.nodes.map((n) => (n.id === id ? f(n) : n)),
});

const setSlot = (
  children: readonly (string | null)[],
  slot: number,
  id: string | null,
): (string | null)[] => {
  const next = [...children];
  while (next.length <= slot) next.push(null);
  next[slot] = id;
  return next;
};

/** Removes `id` from wherever it hangs, leaving an empty slot (binary) or closing the gap. */
function unhook(data: TreeData, id: string, binary: boolean): TreeData {
  const place = placeOf(data, id);
  if (place === undefined) return data;
  if ('root' in place)
    return { ...data, roots: data.roots.filter((r) => r !== id) };
  return updateNode(data, place.parent, (n) => ({
    ...n,
    children: binary
      ? setSlot(n.children, place.slot, null)
      : n.children.filter((c) => c !== id),
  }));
}

/**
 * Puts `id` under `parent`. Binary trees replace the slot's occupant, which
 * becomes a root; other trees insert at the slot, shifting later children.
 */
function hook(
  data: TreeData,
  parent: string,
  slot: number,
  id: string,
  binary: boolean,
): TreeData {
  const node = data.nodes.find((n) => n.id === parent)!;
  if (!binary) {
    const children = [...node.children];
    children.splice(Math.min(slot, children.length), 0, id);
    return updateNode(data, parent, (n) => ({ ...n, children }));
  }
  const displaced = node.children[slot] ?? null;
  const next = updateNode(data, parent, (n) => ({
    ...n,
    children: setSlot(n.children, slot, id),
  }));
  return displaced !== null && displaced !== id
    ? { ...next, roots: [...next.roots, displaced] }
    : next;
}

function subtree(data: TreeData, id: string): Set<string> {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const out = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (out.has(current)) continue;
    out.add(current);
    for (const child of byId.get(current)?.children ?? [])
      if (child !== null) stack.push(child);
  }
  return out;
}

/** In non-binary trees a slot is an insertion position: 0 to the length. */
const slotInRange = (
  parent: TreeNodeState,
  slot: number | undefined,
): ReduceError | undefined =>
  slot === undefined
    ? undefined
    : checkRange(
        `the children of "${parent.id}"`,
        parent.children.length,
        parent.children.length + 1,
        [['slot'], slot],
      );

const invalid = (
  path: readonly PropertyKey[],
  message: string,
  hint?: string,
): ReduceError => ({
  code: 'INVALID_OPERATION',
  path,
  message,
  ...(hint === undefined ? {} : { hint }),
});

function reduceShape(s: TreeState, a: TreeAction): Reduced {
  const { data, marks, binary } = s;
  const has = (id: string) => data.nodes.some((n) => n.id === id);
  const node = (id: string) => data.nodes.find((n) => n.id === id);
  const missing = (
    field: string,
    id: string | null,
  ): ReduceError | undefined =>
    id !== null && !has(id) ? notFound([field], id, 'node') : undefined;
  const result = (
    nextData: TreeData,
    nextMarks: Partial<TreeMarks> = {},
  ): Reduced =>
    ok({ data: nextData, marks: { ...marks, ...nextMarks }, binary });
  const binarySlot = (slot: number): ReduceError | undefined =>
    slot > 1
      ? invalid(['slot'], 'Binary tree nodes have slots 0 (left) and 1 (right)')
      : undefined;
  const checkNil = (nil: NilSlot): ReduceError | undefined => {
    if (!binary)
      return invalid(
        ['node'],
        'Only binary trees have empty slots (NIL) to point at',
        'Point at a node instead.',
      );
    if (!has(nil.parent))
      return notFound(['node', 'parent'], nil.parent, 'node');
    if (nil.slot > 1)
      return invalid(
        ['node', 'slot'],
        'Binary tree nodes have slots 0 (left) and 1 (right)',
      );
    const child = node(nil.parent)!.children[nil.slot] ?? null;
    return child === null
      ? undefined
      : invalid(
          ['node', 'slot'],
          `Slot ${nil.slot} of "${nil.parent}" holds "${child}", not NIL`,
          `Point at "${child}" itself.`,
        );
  };

  switch (a.type) {
    case 'addNode': {
      const bad =
        missing('parent', a.parent) ?? checkCapacity('tree', data.nodes.length);
      if (bad) return err(bad);
      if (has(a.node.id))
        return err({
          code: 'DUPLICATE_ID',
          path: ['node', 'id'],
          message: `A node with id "${a.node.id}" already exists`,
        });
      const fresh: TreeNodeState = {
        id: a.node.id,
        value: a.node.value,
        children: binary ? [null, null] : [],
        color: a.node.color ?? null,
      };
      const added = { ...data, nodes: [...data.nodes, fresh] };
      if (a.parent === null) {
        const bad = rootSlotInRange(data.roots.length, a.slot);
        if (bad) return err(bad);
        return result({
          ...added,
          roots: insertAt(added.roots, a.slot ?? added.roots.length, fresh.id),
        });
      }
      const parent = node(a.parent)!;
      if (!binary) {
        const bad = slotInRange(parent, a.slot);
        if (bad) return err(bad);
        return result(
          hook(
            added,
            a.parent,
            a.slot ?? parent.children.length,
            fresh.id,
            false,
          ),
        );
      }
      const slot = a.slot ?? parent.children.indexOf(null);
      if (slot < 0)
        return err(
          invalid(
            ['parent'],
            `Node "${parent.id}" already has two children`,
            'Use setChild to replace a child.',
          ),
        );
      const badSlot = binarySlot(slot);
      if (badSlot) return err(badSlot);
      if (parent.children[slot] !== null)
        return err(
          invalid(
            ['slot'],
            `Slot ${slot} of "${parent.id}" is taken by "${parent.children[slot]}"`,
            'Use setChild to replace a child.',
          ),
        );
      return result(hook(added, a.parent, slot, fresh.id, true));
    }
    case 'removeNode': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      const gone = subtree(data, a.node);
      const detached = unhook(data, a.node, binary);
      const keep = (id: string) => !gone.has(id);
      return result(
        {
          roots: detached.roots.filter(keep),
          nodes: detached.nodes.filter((n) => keep(n.id)),
        },
        {
          highlight: marks.highlight.filter(keep),
          compare:
            marks.compare !== null && marks.compare.every(keep)
              ? marks.compare
              : null,
          visited: marks.visited.filter(keep),
          settled: marks.settled.filter(keep),
          groups: Object.fromEntries(
            Object.entries(marks.groups).filter(([id]) => keep(id)),
          ),
          pointers: Object.fromEntries(
            Object.entries(marks.pointers).filter(
              ([, target]) => isNilSlot(target) || keep(target),
            ),
          ),
          notes: Object.fromEntries(
            Object.entries(marks.notes).filter(([id]) => keep(id)),
          ),
          namedNotes: Object.fromEntries(
            Object.entries(marks.namedNotes).filter(([id]) => keep(id)),
          ),
        },
      );
    }
    case 'setChild': {
      const bad = missing('parent', a.parent) ?? missing('child', a.child);
      if (bad) return err(bad);
      const parent = node(a.parent)!;
      if (a.slot === undefined && (binary || a.child === null))
        return err(
          invalid(
            ['slot'],
            a.child === null
              ? 'Say which child to remove with `slot`'
              : 'Binary trees need a `slot` ("left" or "right")',
          ),
        );
      if (binary) {
        const badSlot = binarySlot(a.slot!);
        if (badSlot) return err(badSlot);
      }
      if (a.child === null) {
        const current = parent.children[a.slot!] ?? null;
        if (current === null) return ok(s);
        return result({
          ...unhook(data, current, binary),
          roots: [...data.roots, current],
        });
      }
      if (subtree(data, a.child).has(a.parent))
        return err(
          invalid(
            ['child'],
            `Moving "${a.child}" under "${a.parent}" would create a cycle`,
            'A node cannot become a descendant of itself.',
          ),
        );
      const unhooked = unhook(data, a.child, binary);
      const target = unhooked.nodes.find((n) => n.id === a.parent)!;
      // Slots count after `child` has left its old place.
      const badSlot = binary ? undefined : slotInRange(target, a.slot);
      if (badSlot) return err(badSlot);
      return result(
        hook(
          unhooked,
          a.parent,
          a.slot ?? target.children.length,
          a.child,
          binary,
        ),
      );
    }
    case 'detach': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      // The roots other than the node: a slot counts among them.
      const others = data.roots.filter((r) => r !== a.node);
      const badSlot = rootSlotInRange(others.length, a.slot);
      if (badSlot) return err(badSlot);
      const isRoot = others.length < data.roots.length;
      if (isRoot && a.slot === undefined) return ok(s);
      const unhooked = isRoot ? data : unhook(data, a.node, binary);
      return result({
        ...unhooked,
        roots: insertAt(others, a.slot ?? others.length, a.node),
      });
    }
    case 'rotate': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      if (!binary)
        return err(invalid(['direction'], 'Rotations need a binary tree'));
      // Left rotation: y = x.right moves up; x.right = y.left; y.left = x.
      const [up, down] = a.direction === 'left' ? [1, 0] : [0, 1];
      const x = node(a.node)!;
      const yId = x.children[up] ?? null;
      if (yId === null)
        return err(
          invalid(
            ['node'],
            `Node "${x.id}" has no ${up === 1 ? 'right' : 'left'} child to rotate ${a.direction}`,
          ),
        );
      const y = node(yId)!;
      const inner = y.children[down] ?? null;
      const place = placeOf(data, x.id)!;
      let next = updateNode(data, x.id, (n) => ({
        ...n,
        children: setSlot(n.children, up, inner),
      }));
      next = updateNode(next, yId, (n) => ({
        ...n,
        children: setSlot(n.children, down, x.id),
      }));
      next =
        'root' in place
          ? { ...next, roots: next.roots.map((r) => (r === x.id ? yId : r)) }
          : updateNode(next, place.parent, (n) => ({
              ...n,
              children: setSlot(n.children, place.slot, yId),
            }));
      return result(next);
    }
    case 'setValue': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      return result(
        updateNode(data, a.node, (n) => ({ ...n, value: a.value })),
      );
    }
    case 'swapValues': {
      const bad = missing('a', a.a) ?? missing('b', a.b);
      if (bad) return err(bad);
      const va = node(a.a)!.value;
      const vb = node(a.b)!.value;
      return result(
        updateNode(
          updateNode(data, a.a, (n) => ({ ...n, value: vb })),
          a.b,
          (n) => ({ ...n, value: va }),
        ),
        {
          compare: [a.a, a.b],
        },
      );
    }
    case 'setColor': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      return result(
        updateNode(data, a.node, (n) => ({ ...n, color: a.color })),
      );
    }
    case 'highlight': {
      for (const [k, id] of a.nodes.entries())
        if (!has(id)) return err(notFound(['nodes', k], id, 'node'));
      return result(data, { highlight: a.nodes });
    }
    case 'compare': {
      const bad = missing('a', a.a) ?? missing('b', a.b);
      if (bad) return err(bad);
      return result(data, { compare: [a.a, a.b] });
    }
    case 'visit':
    case 'settle': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      const key = a.type === 'visit' ? 'visited' : 'settled';
      if (marks[key].includes(a.node)) return ok(s);
      return result(data, { [key]: [...marks[key], a.node] });
    }
    case 'group': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      return result(data, {
        groups:
          a.group === null
            ? without(marks.groups, a.node)
            : { ...marks.groups, [a.node]: a.group },
      });
    }
    case 'pointer': {
      const bad =
        a.node !== null && isNilSlot(a.node)
          ? checkNil(a.node)
          : missing('node', a.node);
      if (bad) return err(bad);
      return result(data, {
        pointers:
          a.node === null
            ? without(marks.pointers, a.name)
            : { ...marks.pointers, [a.name]: a.node },
      });
    }
    case 'annotate': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      if (a.field !== undefined) {
        const current = marks.namedNotes[a.node] ?? {};
        if (
          a.text !== null &&
          !Object.hasOwn(current, a.field) &&
          Object.keys(current).length >= MAX_NAMED_NOTES
        )
          return err({
            code: 'LIMIT_EXCEEDED',
            path: ['field'],
            message: `Node "${a.node}" already has ${MAX_NAMED_NOTES} named notes`,
            hint: 'Remove a note (text null) before adding another field.',
          });
        const next =
          a.text === null
            ? without(current, a.field)
            : { ...current, [a.field]: a.text };
        return result(data, {
          namedNotes:
            Object.keys(next).length === 0
              ? without(marks.namedNotes, a.node)
              : { ...marks.namedNotes, [a.node]: next },
        });
      }
      return result(data, {
        notes:
          a.text === null
            ? without(marks.notes, a.node)
            : { ...marks.notes, [a.node]: a.text },
      });
    }
    case 'markEdge':
    case 'labelEdge': {
      const bad = missing('node', a.node);
      if (bad) return err(bad);
      if (data.roots.includes(a.node))
        return err(
          invalid(
            ['node'],
            `Node "${a.node}" is a root: there is no edge above it`,
            'Name an edge by its lower end, a node with a parent.',
          ),
        );
      if (a.type === 'markEdge')
        return result(data, {
          edgeMarks:
            a.mark === null
              ? without(marks.edgeMarks, a.node)
              : { ...marks.edgeMarks, [a.node]: a.mark },
        });
      return result(data, {
        edgeLabels:
          a.label === null
            ? without(marks.edgeLabels, a.node)
            : { ...marks.edgeLabels, [a.node]: a.label },
      });
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

/** Where each node with a parent hangs: its parent, and its slot if binary. */
function edgesOf(s: TreeState): Map<string, string> {
  const edges = new Map<string, string>();
  for (const node of s.data.nodes)
    node.children.forEach((child, slot) => {
      if (child !== null)
        edges.set(child, s.binary ? `${node.id}/${slot}` : node.id);
    });
  return edges;
}

/**
 * Drops the marks that hung on a shape that changed: NIL pointers whose
 * slot filled or whose parent went, and the marks and labels of edges whose
 * lower end got another parent or slot, became a root or went.
 */
function followShape(before: TreeState, after: TreeState): TreeState {
  if (after.data === before.data) return after;
  const { marks } = after;
  const was = edgesOf(before);
  const is = edgesOf(after);
  const kept = (id: string) => is.has(id) && is.get(id) === was.get(id);
  const slotOf = (nil: NilSlot) =>
    after.data.nodes.find((n) => n.id === nil.parent)?.children[nil.slot];
  const keepEdges = <V>(record: Readonly<Record<string, V>>) =>
    Object.fromEntries(Object.entries(record).filter(([id]) => kept(id)));
  return {
    ...after,
    marks: {
      ...marks,
      pointers: Object.fromEntries(
        Object.entries(marks.pointers).filter(
          ([, target]) => !isNilSlot(target) || slotOf(target) === null,
        ),
      ),
      edgeMarks: keepEdges(marks.edgeMarks),
      edgeLabels: keepEdges(marks.edgeLabels),
    },
  };
}

function reduceTree(s: TreeState, a: TreeAction): Reduced {
  const reduced = reduceShape(s, a);
  return reduced.ok ? ok(followShape(s, reduced.value)) : reduced;
}

/** A slot among `count` roots: 0 to `count`. */
const rootSlotInRange = (
  count: number,
  slot: number | undefined,
): ReduceError | undefined =>
  slot === undefined
    ? undefined
    : checkRange('the roots', count, count + 1, [['slot'], slot]);

export const treeKind: StructureKind<TreeDecl, TreeState, TreeAction> = {
  init,
  beginStep: (s) =>
    s.marks.highlight.length === 0 && s.marks.compare === null
      ? s
      : { ...s, marks: { ...s.marks, highlight: [], compare: null } },
  reduce: reduceTree,
};
