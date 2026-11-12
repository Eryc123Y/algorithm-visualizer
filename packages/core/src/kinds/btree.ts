/**
 * Reducer for the `btree` kind (ADR 0035).
 *
 * Nodes are kept in a list, in order of creation, each with its keys and
 * children; `root` names the root. Every action keeps the shape valid: a
 * node has no children or one more than its keys, and at most 32 keys.
 * Keys keep their ids when they move, so their marks move with them; a
 * pointer or note on a node that `merge` or `shrink` removes moves to the
 * node that takes its place.
 */
import {
  err,
  MAX_NODE_KEYS,
  ok,
  type BTreeAction,
  type BTreeDecl,
  type Element,
  type Result,
} from '@algoviz/spec';

import type { ReduceError } from '../errors.ts';
import type { StructureKind } from '../kind.ts';
import { checkCapacity, notFound, without } from './common.ts';

export interface BTreeNodeState {
  readonly id: string;
  readonly keys: readonly Element[];
  readonly children: readonly string[];
}

export interface BTreeData {
  readonly nodes: readonly BTreeNodeState[];
  readonly root: string;
}

export interface BTreeMarks {
  /** Keys highlighted this step. */
  readonly keys: readonly string[];
  /** Nodes highlighted this step. */
  readonly nodes: readonly string[];
  /** Keys marked as found. */
  readonly settled: readonly string[];
  readonly pointers: Readonly<Record<string, string>>;
  readonly notes: Readonly<Record<string, string>>;
}

export interface BTreeState {
  readonly data: BTreeData;
  readonly marks: BTreeMarks;
}

type Reduced = Result<BTreeState, ReduceError>;

const emptyMarks: BTreeMarks = {
  keys: [],
  nodes: [],
  settled: [],
  pointers: {},
  notes: {},
};

function init(decl: BTreeDecl): BTreeState {
  return {
    data: {
      nodes: decl.nodes.map((n) => ({
        id: n.id,
        keys: n.keys,
        children: n.children ?? [],
      })),
      root: decl.root,
    },
    marks: emptyMarks,
  };
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

const outOfRange = (
  path: readonly PropertyKey[],
  value: number,
  what: string,
  limit: number,
): ReduceError => ({
  code: 'OUT_OF_RANGE',
  path,
  message: `${String(path.at(-1))}=${value} is out of range for ${what}`,
  hint:
    limit === 0
      ? 'There is no such position.'
      : `Valid values are 0 to ${limit - 1}.`,
});

const tooMany = (path: readonly PropertyKey[], id: string): ReduceError => ({
  code: 'LIMIT_EXCEEDED',
  path,
  message: `Node "${id}" would hold more than ${MAX_NODE_KEYS} keys`,
});

const isLeaf = (n: BTreeNodeState) => n.children.length === 0;

function reduceBTree(s: BTreeState, a: BTreeAction): Reduced {
  const { data, marks } = s;
  const nodeOf = (id: string) => data.nodes.find((n) => n.id === id);
  const holder = (key: string) =>
    data.nodes.find((n) => n.keys.some((k) => k.id === key));
  const put = (
    nodes: readonly BTreeNodeState[],
    ...changed: BTreeNodeState[]
  ): BTreeNodeState[] =>
    nodes.map((n) => changed.find((c) => c.id === n.id) ?? n);
  const result = (
    next: Partial<BTreeData>,
    nextMarks: Partial<BTreeMarks> = {},
  ) =>
    ok<BTreeState>({
      data: { ...data, ...next },
      marks: { ...marks, ...nextMarks },
    });
  const missingNode = (path: PropertyKey[], id: string) =>
    nodeOf(id) === undefined ? notFound(path, id, 'node') : undefined;
  const missingKey = (path: PropertyKey[], id: string) =>
    holder(id) === undefined ? notFound(path, id, 'key') : undefined;
  /** A node that loses its place to another: its pointers and note move. */
  const handOver = (gone: string, to: string): Partial<BTreeMarks> => ({
    nodes: marks.nodes.filter((n) => n !== gone),
    pointers: Object.fromEntries(
      Object.entries(marks.pointers).map(([name, id]) => [
        name,
        id === gone ? to : id,
      ]),
    ),
    // Own properties only: a node may be named "constructor".
    notes:
      !Object.hasOwn(marks.notes, gone) || Object.hasOwn(marks.notes, to)
        ? without(marks.notes, gone)
        : { ...without(marks.notes, gone), [to]: marks.notes[gone]! },
  });
  const countElements = () =>
    data.nodes.reduce((sum, n) => sum + 1 + n.keys.length, 0);

  switch (a.type) {
    case 'insertKey': {
      const bad =
        missingNode(['node'], a.node) ??
        checkCapacity('B-tree', countElements());
      if (bad) return err(bad);
      const n = nodeOf(a.node)!;
      if (!isLeaf(n))
        return err(
          invalid(['node'], `Node "${n.id}" has children; keys go into leaves`),
        );
      if (a.index > n.keys.length)
        return err(
          outOfRange(
            ['index'],
            a.index,
            `the keys of "${n.id}"`,
            n.keys.length + 1,
          ),
        );
      if (n.keys.length >= MAX_NODE_KEYS) return err(tooMany(['node'], n.id));
      const keys = [...n.keys];
      keys.splice(a.index, 0, a.key);
      return result({ nodes: put(data.nodes, { ...n, keys }) });
    }
    case 'removeKey': {
      const bad = missingKey(['key'], a.key);
      if (bad) return err(bad);
      const n = holder(a.key)!;
      if (!isLeaf(n))
        return err(
          invalid(
            ['key'],
            `Key "${a.key}" is in a node with children; only a leaf loses a key this way`,
            'Use merge, borrow or lift.',
          ),
        );
      return result(
        {
          nodes: put(data.nodes, {
            ...n,
            keys: n.keys.filter((k) => k.id !== a.key),
          }),
        },
        {
          keys: marks.keys.filter((k) => k !== a.key),
          settled: marks.settled.filter((k) => k !== a.key),
        },
      );
    }
    case 'setKey': {
      const bad = missingKey(['key'], a.key);
      if (bad) return err(bad);
      const n = holder(a.key)!;
      return result({
        nodes: put(data.nodes, {
          ...n,
          keys: n.keys.map((k) =>
            k.id === a.key ? { ...k, value: a.value } : k,
          ),
        }),
      });
    }
    case 'lift': {
      const bad = missingKey(['key'], a.key) ?? missingKey(['over'], a.over);
      if (bad) return err(bad);
      const leaf = holder(a.key)!;
      const inner = holder(a.over)!;
      if (!isLeaf(leaf))
        return err(invalid(['key'], `Key "${a.key}" is not in a leaf`));
      if (isLeaf(inner))
        return err(
          invalid(
            ['over'],
            `Key "${a.over}" is in a leaf; lift takes a key into a node with children`,
          ),
        );
      const key = leaf.keys.find((k) => k.id === a.key)!;
      return result(
        {
          nodes: put(
            data.nodes,
            { ...leaf, keys: leaf.keys.filter((k) => k.id !== a.key) },
            {
              ...inner,
              keys: inner.keys.map((k) => (k.id === a.over ? key : k)),
            },
          ),
        },
        {
          keys: marks.keys.filter((k) => k !== a.over),
          settled: marks.settled.filter((k) => k !== a.over),
        },
      );
    }
    case 'split': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      if (nodeOf(a.newNode) !== undefined || holder(a.newNode) !== undefined)
        return err({
          code: 'DUPLICATE_ID',
          path: ['newNode'],
          message: `The id "${a.newNode}" is already used`,
        });
      const full = checkCapacity('B-tree', countElements());
      if (full) return err(full);
      const x = nodeOf(a.node)!;
      if (a.index >= x.children.length)
        return err(
          outOfRange(
            ['index'],
            a.index,
            `the children of "${x.id}"`,
            x.children.length,
          ),
        );
      if (x.keys.length >= MAX_NODE_KEYS) return err(tooMany(['node'], x.id));
      const y = nodeOf(x.children[a.index]!)!;
      const k = y.keys.length;
      if (k < 3)
        return err(
          invalid(
            ['index'],
            `Child "${y.id}" has ${k} keys; a split needs at least 3`,
          ),
        );
      const m = Math.floor((k - 1) / 2);
      const leaf = isLeaf(y);
      const left: BTreeNodeState = {
        ...y,
        keys: y.keys.slice(0, m),
        children: leaf ? [] : y.children.slice(0, m + 1),
      };
      const right: BTreeNodeState = {
        id: a.newNode,
        keys: y.keys.slice(m + 1),
        children: leaf ? [] : y.children.slice(m + 1),
      };
      const keys = [...x.keys];
      keys.splice(a.index, 0, y.keys[m]!);
      const children = [...x.children];
      children.splice(a.index + 1, 0, a.newNode);
      return result({
        nodes: [...put(data.nodes, { ...x, keys, children }, left), right],
      });
    }
    case 'grow': {
      if (nodeOf(a.newRoot) !== undefined || holder(a.newRoot) !== undefined)
        return err({
          code: 'DUPLICATE_ID',
          path: ['newRoot'],
          message: `The id "${a.newRoot}" is already used`,
        });
      const bad = checkCapacity('B-tree', countElements());
      if (bad) return err(bad);
      return result({
        nodes: [
          ...data.nodes,
          { id: a.newRoot, keys: [], children: [data.root] },
        ],
        root: a.newRoot,
      });
    }
    case 'merge': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      const x = nodeOf(a.node)!;
      if (a.index + 1 >= x.children.length)
        return err(
          outOfRange(
            ['index'],
            a.index,
            `the keys of "${x.id}" with a child on each side`,
            x.keys.length,
          ),
        );
      const l = nodeOf(x.children[a.index]!)!;
      const r = nodeOf(x.children[a.index + 1]!)!;
      if (isLeaf(l) !== isLeaf(r))
        return err(
          invalid(
            ['index'],
            `"${l.id}" and "${r.id}" are not both leaves or both inner nodes`,
          ),
        );
      if (l.keys.length + 1 + r.keys.length > MAX_NODE_KEYS)
        return err(tooMany(['index'], l.id));
      const merged: BTreeNodeState = {
        ...l,
        keys: [...l.keys, x.keys[a.index]!, ...r.keys],
        children: [...l.children, ...r.children],
      };
      const parent: BTreeNodeState = {
        ...x,
        keys: x.keys.filter((_, k) => k !== a.index),
        children: x.children.filter((_, k) => k !== a.index + 1),
      };
      return result(
        {
          nodes: put(data.nodes, parent, merged).filter((n) => n.id !== r.id),
        },
        handOver(r.id, l.id),
      );
    }
    case 'shrink': {
      const root = nodeOf(data.root)!;
      if (root.keys.length > 0 || root.children.length !== 1)
        return err(
          invalid(
            [],
            `The root "${root.id}" has ${root.keys.length} keys and ${root.children.length} children; it shrinks only with none and one`,
          ),
        );
      const child = root.children[0]!;
      return result(
        { nodes: data.nodes.filter((n) => n.id !== root.id), root: child },
        handOver(root.id, child),
      );
    }
    case 'borrow': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      const x = nodeOf(a.node)!;
      if (a.child >= x.children.length)
        return err(
          outOfRange(
            ['child'],
            a.child,
            `the children of "${x.id}"`,
            x.children.length,
          ),
        );
      const s2 = a.from === 'right' ? a.child + 1 : a.child - 1;
      if (s2 < 0 || s2 >= x.children.length)
        return err(
          invalid(
            ['from'],
            `Child ${a.child} of "${x.id}" has no sibling on its ${a.from}`,
          ),
        );
      const c = nodeOf(x.children[a.child]!)!;
      const sib = nodeOf(x.children[s2]!)!;
      if (isLeaf(c) !== isLeaf(sib))
        return err(
          invalid(
            ['from'],
            `"${c.id}" and "${sib.id}" are not both leaves or both inner nodes`,
          ),
        );
      if (sib.keys.length === 0)
        return err(invalid(['from'], `"${sib.id}" has no key to give`));
      if (c.keys.length >= MAX_NODE_KEYS) return err(tooMany(['child'], c.id));
      const sep = a.from === 'right' ? a.child : a.child - 1;
      const down = x.keys[sep]!;
      let child: BTreeNodeState;
      let sibling: BTreeNodeState;
      let up: Element;
      if (a.from === 'right') {
        up = sib.keys[0]!;
        child = {
          ...c,
          keys: [...c.keys, down],
          children: isLeaf(c) ? [] : [...c.children, sib.children[0]!],
        };
        sibling = {
          ...sib,
          keys: sib.keys.slice(1),
          children: isLeaf(sib) ? [] : sib.children.slice(1),
        };
      } else {
        up = sib.keys.at(-1)!;
        child = {
          ...c,
          keys: [down, ...c.keys],
          children: isLeaf(c) ? [] : [sib.children.at(-1)!, ...c.children],
        };
        sibling = {
          ...sib,
          keys: sib.keys.slice(0, -1),
          children: isLeaf(sib) ? [] : sib.children.slice(0, -1),
        };
      }
      const parent = {
        ...x,
        keys: x.keys.map((k, i) => (i === sep ? up : k)),
      };
      return result({ nodes: put(data.nodes, parent, child, sibling) });
    }
    case 'highlight': {
      for (const [k, id] of (a.keys ?? []).entries()) {
        const bad = missingKey(['keys', k], id);
        if (bad) return err(bad);
      }
      for (const [k, id] of (a.nodes ?? []).entries()) {
        const bad = missingNode(['nodes', k], id);
        if (bad) return err(bad);
      }
      return result({}, { keys: a.keys ?? [], nodes: a.nodes ?? [] });
    }
    case 'settle': {
      const bad = missingKey(['key'], a.key);
      if (bad) return err(bad);
      if (marks.settled.includes(a.key)) return ok(s);
      return result({}, { settled: [...marks.settled, a.key] });
    }
    case 'pointer': {
      if (a.node !== null) {
        const bad = missingNode(['node'], a.node);
        if (bad) return err(bad);
      }
      return result(
        {},
        {
          pointers:
            a.node === null
              ? without(marks.pointers, a.name)
              : { ...marks.pointers, [a.name]: a.node },
        },
      );
    }
    case 'annotate': {
      const bad = missingNode(['node'], a.node);
      if (bad) return err(bad);
      return result(
        {},
        {
          notes:
            a.text === null
              ? without(marks.notes, a.node)
              : { ...marks.notes, [a.node]: a.text },
        },
      );
    }
    default: {
      const unreachable: never = a;
      return unreachable;
    }
  }
}

export const btreeKind: StructureKind<BTreeDecl, BTreeState, BTreeAction> = {
  init,
  beginStep: (s) =>
    s.marks.keys.length === 0 && s.marks.nodes.length === 0
      ? s
      : { ...s, marks: { ...s.marks, keys: [], nodes: [] } },
  reduce: reduceBTree,
};
