/**
 * The `btree` kind in the property tests (ADR 0035): random declarations
 * and actions, a plain model of the data written from the ADR's table of
 * actions rather than from the reducer, with the pointers and notes that
 * pass to the node that stays when a merge or shrink removes one, and the
 * invariants every state keeps.
 */
import {
  MAX_NODE_KEYS,
  type Scalar,
  type StructureDecl,
} from '@algomotion/spec';

import type { BTreeState } from '../../src/index.ts';
import type { Dice } from './random.ts';

type Fields = Record<string, unknown>;
type Key = { readonly id: string; readonly value: Scalar };

export interface BTreeModel {
  readonly kind: 'btree';
  readonly nodes: readonly {
    readonly id: string;
    readonly keys: readonly Key[];
    readonly children: readonly string[];
  }[];
  readonly root: string;
  /** Named pointers to node ids. */
  readonly pointers: Readonly<Record<string, string>>;
  /** Notes by node id. */
  readonly notes: Readonly<Record<string, string>>;
}

const omit = (
  rec: Readonly<Record<string, string>>,
  name: string,
): Record<string, string> =>
  Object.fromEntries(Object.entries(rec).filter(([k]) => k !== name));

/**
 * The marks once node `gone` has given way to node `to`: pointers at it
 * now point at `to`, and its note moves there unless `to` has one.
 */
function giveWay(m: BTreeModel, gone: string, to: string): BTreeModel {
  const pointers: Record<string, string> = {};
  for (const [name, id] of Object.entries(m.pointers))
    pointers[name] = id === gone ? to : id;
  const notes = omit(m.notes, gone);
  if (Object.hasOwn(m.notes, gone) && !Object.hasOwn(m.notes, to))
    notes[to] = m.notes[gone]!;
  return { ...m, pointers, notes };
}

/** A tree of one or two levels, sometimes a keyless root. */
export function btreeDecl(r: Dice, label: object): StructureDecl {
  let k = 0;
  const keys = (n: number) =>
    Array.from({ length: n }, () => ({ id: `k${k++}`, value: r.value() }));
  if (r.chance(0.3))
    return {
      kind: 'btree',
      ...label,
      nodes: [{ id: 'r', keys: keys(r.int(4)) }],
      root: 'r',
    };
  const m = 1 + r.int(3);
  const leaves = Array.from({ length: m + 1 }, (_, i) => ({
    id: `b${i}`,
    // Now and then a leaf at or near the 32-key cap.
    keys: keys(r.chance(0.1) ? MAX_NODE_KEYS - r.int(3) : r.int(4 * r.scale)),
  }));
  return {
    kind: 'btree',
    ...label,
    nodes: [
      { id: 'r', keys: keys(m), children: leaves.map((l) => l.id) },
      ...leaves,
    ],
    root: 'r',
  };
}

export function btreeAction(s: BTreeState, r: Dice): Fields {
  const nodes = s.data.nodes.map((n) => n.id);
  const keys = s.data.nodes.flatMap((n) => n.keys.map((k) => k.id));
  const node = () => (r.chance(0.03) ? 'missing' : r.pick(nodes));
  const key = () =>
    keys.length === 0 || r.chance(0.03) ? 'missing' : r.pick(keys);
  const all = [...nodes, ...keys];
  const fresh = (prefix: string) => r.id(all, prefix);
  switch (r.int(13)) {
    case 0:
    case 1:
      return {
        type: 'insertKey',
        node: node(),
        index: r.int(4),
        key: { id: fresh('k'), value: r.value() },
      };
    case 2:
      return { type: 'removeKey', key: key() };
    case 3:
      return { type: 'setKey', key: key(), value: r.value() };
    case 4:
      return { type: 'lift', key: key(), over: key() };
    case 5:
    case 6:
      return {
        type: 'split',
        node: node(),
        index: r.int(4),
        newNode: fresh('b'),
      };
    case 7:
      return { type: 'grow', newRoot: fresh('b') };
    case 8:
      return { type: 'merge', node: node(), index: r.int(4) };
    case 9:
      return { type: 'shrink' };
    case 10:
      return {
        type: 'borrow',
        node: node(),
        child: r.int(4),
        from: r.pick(['left', 'right']),
      };
    case 11:
      return r.chance(0.5)
        ? { type: 'highlight', keys: [key()], nodes: [node()] }
        : { type: 'settle', key: key() };
    default:
      return r.chance(0.5)
        ? {
            type: 'pointer',
            name: r.pick(['x', 'y', 'curr']),
            node: r.chance(0.2) ? null : node(),
          }
        : {
            type: 'annotate',
            node: node(),
            text: r.chance(0.2) ? null : r.pick(['t=3', 'full', '']),
          };
  }
}

export function initBTreeModel(
  decl: StructureDecl & { kind: 'btree' },
): BTreeModel {
  return {
    kind: 'btree',
    nodes: decl.nodes.map((n) => ({
      id: n.id,
      keys: [...n.keys],
      children: [...(n.children ?? [])],
    })),
    root: decl.root,
    pointers: {},
    notes: {},
  };
}

/** The model after an action, or undefined if it must be refused. */
export function applyBTreeModel(
  m: BTreeModel,
  a: Fields,
): BTreeModel | undefined {
  const next = applyShape(m, a);
  if (next === undefined) return undefined;
  switch (a['type']) {
    case 'pointer': {
      const name = a['name'] as string;
      return {
        ...next,
        pointers:
          a['node'] === null
            ? omit(m.pointers, name)
            : { ...m.pointers, [name]: a['node'] as string },
      };
    }
    case 'annotate': {
      const node = a['node'] as string;
      return {
        ...next,
        notes:
          a['text'] === null
            ? omit(m.notes, node)
            : { ...m.notes, [node]: a['text'] as string },
      };
    }
    case 'merge': {
      const x = m.nodes.find((n) => n.id === a['node'])!;
      const i = a['index'] as number;
      return giveWay(next, x.children[i + 1]!, x.children[i]!);
    }
    case 'shrink':
      return giveWay(next, m.root, next.root);
    default:
      return next;
  }
}

/** The nodes and keys after an action, or undefined if it is refused. */
function applyShape(m: BTreeModel, a: Fields): BTreeModel | undefined {
  const find = (id: unknown) => m.nodes.find((n) => n.id === id);
  const holder = (id: unknown) =>
    m.nodes.find((n) => n.keys.some((k) => k.id === id));
  const leaf = (n: { children: readonly string[] }) => n.children.length === 0;
  const set = (...changed: BTreeModel['nodes']) => ({
    ...m,
    nodes: m.nodes.map((n) => changed.find((c) => c.id === n.id) ?? n),
  });
  const elements = m.nodes.reduce((sum, n) => sum + 1 + n.keys.length, 0);
  switch (a['type']) {
    case 'insertKey': {
      const n = find(a['node']);
      const i = a['index'] as number;
      if (
        !n ||
        !leaf(n) ||
        i > n.keys.length ||
        n.keys.length >= MAX_NODE_KEYS ||
        elements >= 1000
      )
        return undefined;
      return set({
        ...n,
        keys: [...n.keys.slice(0, i), a['key'] as Key, ...n.keys.slice(i)],
      });
    }
    case 'removeKey': {
      const n = holder(a['key']);
      if (!n || !leaf(n)) return undefined;
      return set({ ...n, keys: n.keys.filter((k) => k.id !== a['key']) });
    }
    case 'setKey': {
      const n = holder(a['key']);
      if (!n) return undefined;
      return set({
        ...n,
        keys: n.keys.map((k) =>
          k.id === a['key'] ? { ...k, value: a['value'] as Scalar } : k,
        ),
      });
    }
    case 'lift': {
      const from = holder(a['key']);
      const into = holder(a['over']);
      if (!from || !into || !leaf(from) || leaf(into)) return undefined;
      const key = from.keys.find((k) => k.id === a['key'])!;
      return set(
        { ...from, keys: from.keys.filter((k) => k.id !== a['key']) },
        { ...into, keys: into.keys.map((k) => (k.id === a['over'] ? key : k)) },
      );
    }
    case 'split': {
      const x = find(a['node']);
      const i = a['index'] as number;
      if (!x || find(a['newNode']) || holder(a['newNode']) || elements >= 1000)
        return undefined;
      if (i >= x.children.length || x.keys.length >= MAX_NODE_KEYS)
        return undefined;
      const y = find(x.children[i])!;
      if (y.keys.length < 3) return undefined;
      const mid = Math.floor((y.keys.length - 1) / 2);
      const kids = leaf(y);
      const right = {
        id: a['newNode'] as string,
        keys: y.keys.slice(mid + 1),
        children: kids ? [] : y.children.slice(mid + 1),
      };
      const next = set(
        {
          ...x,
          keys: [...x.keys.slice(0, i), y.keys[mid]!, ...x.keys.slice(i)],
          children: [
            ...x.children.slice(0, i + 1),
            right.id,
            ...x.children.slice(i + 1),
          ],
        },
        {
          ...y,
          keys: y.keys.slice(0, mid),
          children: kids ? [] : y.children.slice(0, mid + 1),
        },
      );
      return { ...next, nodes: [...next.nodes, right] };
    }
    case 'grow': {
      if (find(a['newRoot']) || holder(a['newRoot']) || elements >= 1000)
        return undefined;
      return {
        ...m,
        nodes: [
          ...m.nodes,
          { id: a['newRoot'] as string, keys: [], children: [m.root] },
        ],
        root: a['newRoot'] as string,
      };
    }
    case 'merge': {
      const x = find(a['node']);
      const i = a['index'] as number;
      if (!x || i + 1 >= x.children.length) return undefined;
      const l = find(x.children[i])!;
      const rr = find(x.children[i + 1])!;
      if (
        leaf(l) !== leaf(rr) ||
        l.keys.length + 1 + rr.keys.length > MAX_NODE_KEYS
      )
        return undefined;
      const next = set(
        {
          ...x,
          keys: x.keys.filter((_, k) => k !== i),
          children: x.children.filter((_, k) => k !== i + 1),
        },
        {
          ...l,
          keys: [...l.keys, x.keys[i]!, ...rr.keys],
          children: [...l.children, ...rr.children],
        },
      );
      return { ...next, nodes: next.nodes.filter((n) => n.id !== rr.id) };
    }
    case 'shrink': {
      const root = find(m.root)!;
      if (root.keys.length > 0 || root.children.length !== 1) return undefined;
      return {
        ...m,
        nodes: m.nodes.filter((n) => n.id !== root.id),
        root: root.children[0]!,
      };
    }
    case 'borrow': {
      const x = find(a['node']);
      const c = a['child'] as number;
      if (!x || c >= x.children.length) return undefined;
      const right = a['from'] === 'right';
      const s = right ? c + 1 : c - 1;
      if (s < 0 || s >= x.children.length) return undefined;
      const child = find(x.children[c])!;
      const sib = find(x.children[s])!;
      if (
        leaf(child) !== leaf(sib) ||
        sib.keys.length === 0 ||
        child.keys.length >= MAX_NODE_KEYS
      )
        return undefined;
      const sep = right ? c : c - 1;
      const down = x.keys[sep]!;
      const up = right ? sib.keys[0]! : sib.keys.at(-1)!;
      const inner = !leaf(child);
      return set(
        { ...x, keys: x.keys.map((k, i) => (i === sep ? up : k)) },
        right
          ? {
              ...child,
              keys: [...child.keys, down],
              children: inner ? [...child.children, sib.children[0]!] : [],
            }
          : {
              ...child,
              keys: [down, ...child.keys],
              children: inner ? [sib.children.at(-1)!, ...child.children] : [],
            },
        right
          ? {
              ...sib,
              keys: sib.keys.slice(1),
              children: inner ? sib.children.slice(1) : [],
            }
          : {
              ...sib,
              keys: sib.keys.slice(0, -1),
              children: inner ? sib.children.slice(0, -1) : [],
            },
      );
    }
    case 'highlight':
      return ((a['keys'] as unknown[]) ?? []).every((k) => holder(k)) &&
        ((a['nodes'] as unknown[]) ?? []).every((n) => find(n))
        ? m
        : undefined;
    case 'settle':
      return holder(a['key']) ? m : undefined;
    case 'pointer':
      return a['node'] === null || find(a['node']) ? m : undefined;
    case 'annotate':
      return find(a['node']) ? m : undefined;
    default:
      throw new Error(`unmodelled btree action ${String(a['type'])}`);
  }
}

/** What is wrong with a state: shape, ids and marks. */
export function btreeProblems(s: BTreeState): string[] {
  const problems: string[] = [];
  const nodes = new Map(s.data.nodes.map((n) => [n.id, n]));
  const keyIds = s.data.nodes.flatMap((n) => n.keys.map((k) => k.id));
  const keys = new Set(keyIds);
  if (keys.size !== keyIds.length) problems.push('two keys share an id');
  for (const k of keyIds)
    if (s.data.nodes.some((n) => n.id === k))
      problems.push(`a key and a node share the id ${k}`);
  if (!nodes.has(s.data.root)) problems.push('the root is not a node');
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return problems.push(`${id} is reached twice`);
    seen.add(id);
    const n = nodes.get(id);
    if (n === undefined) return problems.push(`missing node ${id}`);
    if (n.children.length !== 0 && n.children.length !== n.keys.length + 1)
      problems.push(
        `${id} has ${n.keys.length} keys and ${n.children.length} children`,
      );
    if (n.keys.length > MAX_NODE_KEYS) problems.push(`${id} has too many keys`);
    n.children.forEach(walk);
    return 0;
  };
  walk(s.data.root);
  if (seen.size !== nodes.size) problems.push('a node is not reachable');
  for (const k of [...s.marks.keys, ...s.marks.settled])
    if (!keys.has(k)) problems.push(`a mark names the missing key ${k}`);
  for (const n of [
    ...s.marks.nodes,
    ...Object.values(s.marks.pointers),
    ...Object.keys(s.marks.notes),
  ])
    if (!nodes.has(n)) problems.push(`a mark names the missing node ${n}`);
  return problems;
}
