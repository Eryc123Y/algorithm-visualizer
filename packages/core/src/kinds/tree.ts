/**
 * Reducer for the `tree` kind.
 *
 * Nodes are kept in a list (in order of creation) with ordered child slots;
 * `roots` lists the roots of the forest left to right. Every structural
 * action keeps the forest valid: each node has at most one parent and there
 * are no cycles.
 */
import {
  err,
  ok,
  type GroupIndexValue,
  type Result,
  type Scalar,
  type TreeAction,
  type TreeDecl,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind } from '../kind.ts';
import { checkCapacity, notFound, without } from './common.ts';

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

export interface TreeMarks {
  readonly highlight: readonly string[];
  readonly compare: readonly [string, string] | null;
  readonly visited: readonly string[];
  readonly settled: readonly string[];
  readonly groups: Readonly<Record<string, GroupIndexValue>>;
  readonly pointers: Readonly<Record<string, string>>;
  readonly notes: Readonly<Record<string, string>>;
}

export interface TreeState {
  readonly data: TreeData;
  readonly marks: TreeMarks;
  readonly binary: boolean;
}

type Reduced = Result<TreeState, ReduceError>;

const emptyMarks: TreeMarks = {
  highlight: [],
  compare: null,
  visited: [],
  settled: [],
  groups: {},
  pointers: {},
  notes: {},
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

function reduceTree(s: TreeState, a: TreeAction): Reduced {
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
        color: null,
      };
      const added = { ...data, nodes: [...data.nodes, fresh] };
      if (a.parent === null)
        return result({ ...added, roots: [...added.roots, fresh.id] });
      const parent = node(a.parent)!;
      if (!binary)
        return result(
          hook(
            added,
            a.parent,
            a.slot ?? parent.children.length,
            fresh.id,
            false,
          ),
        );
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
            Object.entries(marks.pointers).filter(([, id]) => keep(id)),
          ),
          notes: Object.fromEntries(
            Object.entries(marks.notes).filter(([id]) => keep(id)),
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
      if (data.roots.includes(a.node)) return ok(s);
      return result({
        ...unhook(data, a.node, binary),
        roots: [...data.roots, a.node],
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
      const bad = missing('node', a.node);
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
      return result(data, {
        notes:
          a.text === null
            ? without(marks.notes, a.node)
            : { ...marks.notes, [a.node]: a.text },
      });
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const treeKind: StructureKind<TreeDecl, TreeState, TreeAction> = {
  init,
  beginStep: (s) =>
    s.marks.highlight.length === 0 && s.marks.compare === null
      ? s
      : { ...s, marks: { ...s.marks, highlight: [], compare: null } },
  reduce: reduceTree,
};
