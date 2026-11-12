/**
 * Random documents for every kind: a declaration, then actions chosen
 * against the current state, so most are valid and some are deliberately
 * not. Everything is written in canonical form (explicit ids, numeric
 * slots), so actions can be applied as written.
 */
import type {
  StructureDecl,
  StructureKindName,
  TargetedAction,
} from '@algoviz/spec';

import type {
  ArrayState,
  GraphState,
  HashTableState,
  KindedState,
  LinkedListState,
  PriorityQueueState,
  QueueState,
  StackState,
  TableState,
  TreeState,
} from '../../src/index.ts';
import type { Dice } from './random.ts';

type Fields = Record<string, unknown>;

const ids = (data: readonly { id: string }[]) => data.map((e) => e.id);

const elements = (r: Dice, count: number, prefix = 'e') => {
  const used: string[] = [];
  return Array.from({ length: count }, () => {
    const id = r.id(used, prefix, 0);
    used.push(id);
    return { id, value: r.value() };
  });
};

const pointerName = (r: Dice) => r.pick(['i', 'j', 'lo', 'hi', 'curr', '_p9']);

/** A list of 1–3 positions in [0, n), occasionally one out of range. */
const positions = (r: Dice, n: number) =>
  Array.from({ length: 1 + r.int(3) }, () => r.index(n));

// ---------------------------------------------------------------------------
// Declarations

export function declaration(kind: StructureKindName, r: Dice): StructureDecl {
  const label = {
    ...(r.chance(0.2)
      ? { label: r.pick(['L', 'a long label for a structure', 'é']) }
      : {}),
    ...(r.chance(0.3) ? { place: r.pick(['main', 'side'] as const) } : {}),
  };
  switch (kind) {
    case 'array':
      return {
        kind,
        ...label,
        ...(r.chance(0.3)
          ? { view: r.pick(['row', 'tree', 'heap'] as const) }
          : {}),
        initial: elements(r, r.int(9 * r.scale)),
      };
    case 'stack':
    case 'queue':
      return { kind, ...label, initial: elements(r, r.int(6 * r.scale)) };
    case 'linkedList':
      return {
        kind,
        ...label,
        doubly: r.chance(0.4),
        circular: r.chance(0.3),
        initial: elements(r, r.int(7 * r.scale)),
      };
    case 'tree':
      return treeDecl(r, label);
    case 'graph':
      return graphDecl(r, label);
    case 'table': {
      const rows = r.int(5 * r.scale);
      const columns = rows === 0 ? 0 : 1 + r.int(6 * r.scale);
      // Authoring form: `initial` rows, possibly short, padded by rows/columns.
      return {
        kind,
        ...label,
        rows,
        columns,
        initial: Array.from({ length: r.int(rows + 1) }, () =>
          Array.from({ length: r.int(columns + 1) }, () => r.value()),
        ),
        ...(rows > 0 && r.chance(0.4)
          ? {
              rowLabels: Array.from({ length: rows }, () => r.value()),
              columnLabels: Array.from({ length: columns }, () => r.value()),
            }
          : {}),
      } as unknown as StructureDecl;
    }
    case 'priorityQueue':
      return {
        kind,
        ...label,
        ...(r.chance(0.4) ? { order: r.pick(['min', 'max'] as const) } : {}),
        initial: elements(r, r.int(7 * r.scale)).map((e) => ({
          ...e,
          key: priorityKey(r),
        })),
      };
    case 'hashTable': {
      const size = 1 + r.int(6);
      const all = elements(r, r.int(8 * r.scale));
      const buckets: (typeof all)[] = Array.from({ length: size }, () => []);
      for (const e of all) buckets[r.int(size)]!.push(e);
      return {
        kind,
        ...label,
        size,
        initial: buckets,
      } as unknown as StructureDecl;
    }
  }
}

function treeDecl(r: Dice, label: object): StructureDecl {
  const binary = r.chance(0.6);
  const count = r.int(8 * r.scale);
  const nodes = elements(r, count, 't').map((e) => {
    const children: (string | null)[] = binary ? [null, null] : [];
    return {
      ...e,
      children,
      ...(r.chance(0.3) ? { color: r.pick(['red', 'black'] as const) } : {}),
    };
  });
  const roots: string[] = [];
  // Each node after the first hangs under an earlier one, or starts a tree.
  nodes.forEach((node, k) => {
    const parent = k === 0 || r.chance(0.15) ? undefined : nodes[r.int(k)]!;
    const free =
      parent === undefined || !binary ? 0 : parent.children.indexOf(null);
    if (parent === undefined || free === -1) roots.push(node.id);
    else if (binary) parent.children[free] = node.id;
    else parent.children.push(node.id);
  });
  return {
    kind: 'tree',
    ...label,
    binary,
    nodes,
    roots,
    ...(r.chance(0.2)
      ? { rootList: r.pick(['list', 'circular'] as const) }
      : {}),
  };
}

function graphDecl(r: Dice, label: object): StructureDecl {
  const layout = r.pick([
    'auto',
    'circle',
    'layered',
    'grid',
    'manual',
  ] as const);
  const nodes = elements(r, r.int(7 * r.scale), 'v').map((e) => ({
    ...e,
    ...(layout === 'manual' || r.chance(0.1)
      ? { x: r.int(400) - 50, y: r.int(300) - 50 }
      : {}),
  }));
  const used = ids(nodes);
  const edges = Array.from(
    { length: nodes.length === 0 ? 0 : r.int(9 * r.scale * r.scale) },
    () => {
      const id = r.id(used, 'x', 0);
      used.push(id);
      return {
        id,
        from: r.pick(nodes).id,
        to: r.pick(nodes).id,
        ...(r.chance(0.5) ? { weight: r.value() } : {}),
      };
    },
  );
  return {
    kind: 'graph',
    ...label,
    directed: r.chance(0.5),
    layout,
    nodes,
    edges,
  };
}

// ---------------------------------------------------------------------------
// Actions, chosen against the current state

export function action(entry: KindedState, r: Dice): Fields {
  switch (entry.kind) {
    case 'array':
      return arrayAction(entry.state, r);
    case 'stack':
      return stackAction(entry.state, r);
    case 'queue':
      return queueAction(entry.state, r);
    case 'linkedList':
      return listAction(entry.state, r);
    case 'tree':
      return treeAction(entry.state, r);
    case 'graph':
      return graphAction(entry.state, r);
    case 'table':
      return tableAction(entry.state, r);
    case 'hashTable':
      return hashAction(entry.state, r);
    case 'priorityQueue':
      return priorityQueueAction(entry.state, r);
  }
}

/** A key with many ties: small integers, sometimes a fraction or null. */
const priorityKey = (r: Dice): number | null =>
  r.chance(0.2) ? null : r.chance(0.1) ? r.int(100) / 7 - 5 : r.int(5) - 1;

function priorityQueueAction(s: PriorityQueueState, r: Dice): Fields {
  const all = ids(s.data.items);
  // Mostly an item in the queue, sometimes one that is not.
  const someId = () =>
    all.length > 0 && !r.chance(0.05) ? r.pick(all) : r.id(all, 'p', 0);
  switch (r.int(7)) {
    case 0:
    case 1:
      return {
        type: 'insert',
        element: { id: r.id(all, 'p'), value: r.value() },
        key: priorityKey(r),
      };
    case 2:
      return { type: 'extract' };
    case 3:
    case 4:
      return { type: 'setKey', id: someId(), key: priorityKey(r) };
    case 5:
      return { type: 'peek' };
    default:
      return {
        type: 'highlight',
        ids: Array.from({ length: 1 + r.int(2) }, someId),
      };
  }
}

function arrayAction(s: ArrayState, r: Dice): Fields {
  const n = s.data.length;
  switch (r.int(8)) {
    case 0:
      return { type: 'set', index: r.index(n), value: r.value() };
    case 1:
      return { type: 'swap', i: r.index(n), j: r.index(n) };
    case 2:
      return {
        type: 'insert',
        index: r.index(n + 1),
        element: { id: r.id(ids(s.data), 'a'), value: r.value() },
      };
    case 3:
      return { type: 'remove', index: r.index(n) };
    case 4:
      return { type: 'compare', i: r.index(n), j: r.index(n) };
    case 5:
      return { type: 'highlight', indices: positions(r, n) };
    case 6:
      return {
        type: 'pointer',
        name: pointerName(r),
        index: r.chance(0.2) ? null : r.index(n + 1),
      };
    default:
      return { type: 'settle', index: r.index(n) };
  }
}

function stackAction(s: StackState, r: Dice): Fields {
  const n = s.data.length;
  switch (r.int(5)) {
    case 0:
    case 1:
      return {
        type: 'push',
        element: { id: r.id(ids(s.data), 's'), value: r.value() },
      };
    case 2:
      return n === 0 && !r.chance(0.1) ? { type: 'peek' } : { type: 'pop' };
    case 3:
      return { type: 'peek' };
    default:
      return { type: 'highlight', indices: positions(r, n) };
  }
}

function queueAction(s: QueueState, r: Dice): Fields {
  const n = s.data.length;
  const element = () => ({ id: r.id(ids(s.data), 'q'), value: r.value() });
  switch (r.int(6)) {
    case 0:
      return { type: 'enqueue', element: element() };
    case 1:
      return { type: 'pushFront', element: element() };
    case 2:
      return { type: 'dequeue' };
    case 3:
      return { type: 'popBack' };
    case 4:
      return r.chance(0.5)
        ? { type: 'peek' }
        : { type: 'peek', end: r.pick(['front', 'back']) };
    default:
      return { type: 'highlight', indices: positions(r, n) };
  }
}

function listAction(s: LinkedListState, r: Dice): Fields {
  const n = s.data.length;
  switch (r.int(8)) {
    case 0:
      return {
        type: 'insert',
        index: r.index(n + 1),
        element: { id: r.id(ids(s.data), 'l'), value: r.value() },
      };
    case 1:
      return { type: 'remove', index: r.index(n) };
    case 2:
      return { type: 'set', index: r.index(n), value: r.value() };
    case 3:
    case 4:
      return {
        type: 'link',
        from: r.index(n),
        to: r.chance(0.2) ? null : r.index(n),
        ...(r.chance(0.5)
          ? {
              field:
                s.doubly || r.chance(0.1) ? r.pick(['next', 'prev']) : 'next',
            }
          : {}),
      };
    case 5:
      return {
        type: 'pointer',
        name: pointerName(r),
        index: r.chance(0.2) ? null : r.index(n),
      };
    case 6:
      return { type: 'highlight', indices: positions(r, n) };
    default:
      return { type: r.pick(['visit', 'settle']), index: r.index(n) };
  }
}

function treeAction(s: TreeState, r: Dice): Fields {
  const all = ids(s.data.nodes);
  const node = () =>
    all.length === 0 || r.chance(0.03) ? 'missing' : r.pick(all);
  const slot = () => (s.binary ? r.int(r.chance(0.05) ? 3 : 2) : r.int(4));
  switch (r.int(17)) {
    case 0:
    case 1:
    case 2:
      return {
        type: 'addNode',
        node: {
          id: r.id(all, 't'),
          value: r.value(),
          ...(r.chance(0.3) ? { color: r.pick(['red', 'black']) } : {}),
        },
        parent: all.length === 0 || r.chance(0.15) ? null : node(),
        ...(r.chance(0.6) ? { slot: slot() } : {}),
      };
    case 3:
      return { type: 'removeNode', node: node() };
    case 4:
    case 5:
      return {
        type: 'setChild',
        parent: node(),
        child: r.chance(0.15) ? null : node(),
        ...(s.binary || r.chance(0.5) ? { slot: slot() } : {}),
      };
    case 6:
      return {
        type: 'detach',
        node: node(),
        ...(r.chance(0.5) ? { slot: r.int(s.data.roots.length + 2) } : {}),
      };
    case 7:
    case 8:
      return {
        type: 'rotate',
        node: node(),
        direction: r.pick(['left', 'right']),
      };
    case 9:
      return { type: 'setValue', node: node(), value: r.value() };
    case 10:
      return { type: 'swapValues', a: node(), b: node() };
    case 11:
      return {
        type: 'setColor',
        node: node(),
        color: r.pick(['red', 'black', null]),
      };
    case 12:
      return r.chance(0.5)
        ? { type: 'highlight', nodes: [node(), node()] }
        : { type: 'compare', a: node(), b: node() };
    case 13:
      return { type: r.pick(['visit', 'settle']), node: node() };
    case 14:
      return r.chance(0.5)
        ? {
            type: 'group',
            node: node(),
            group: r.pick([0, 1, 2, 3, 4, 5, null]),
          }
        : {
            type: 'pointer',
            name: pointerName(r),
            node: r.chance(0.2)
              ? null
              : r.chance(0.3)
                ? // A NIL slot (ADR 0034), often an empty one.
                  { parent: node(), slot: r.int(r.chance(0.1) ? 3 : 2) }
                : node(),
          };
    case 15:
      return r.chance(0.5)
        ? {
            type: 'markEdge',
            node: node(),
            mark: r.pick(['selected', 'rejected', null]),
          }
        : {
            type: 'labelEdge',
            node: node(),
            label: r.pick(['0', '1', 7, 'xxxxxxxxxxxxxxxx', null]),
          };
    default:
      return {
        type: 'annotate',
        node: node(),
        text: r.chance(0.2)
          ? null
          : r.pick(['h=1', 'd=∞', '', 'x'.repeat(32), 'bf −1']),
        ...(r.chance(0.4) ? { field: r.pick(['size', 'max', 'deg']) } : {}),
      };
  }
}

function graphAction(s: GraphState, r: Dice): Fields {
  const nodes = ids(s.data.nodes);
  const edges = ids(s.data.edges);
  const node = () =>
    nodes.length === 0 || r.chance(0.03) ? 'missing' : r.pick(nodes);
  const edge = () =>
    edges.length === 0 || r.chance(0.03) ? 'missing' : r.pick(edges);
  const taken = [...nodes, ...edges];
  switch (r.int(15)) {
    case 0:
    case 1:
      return {
        type: 'addNode',
        node: {
          id: r.id(taken, 'v'),
          value: r.value(),
          ...(s.layout === 'manual'
            ? r.chance(0.95)
              ? { x: r.int(300), y: r.int(300) }
              : {}
            : {}),
        },
      };
    case 2:
      return { type: 'removeNode', node: node() };
    case 3:
      return { type: 'setValue', node: node(), value: r.value() };
    case 4:
    case 5:
      return {
        type: 'addEdge',
        edge: {
          id: r.id(taken, 'x'),
          from: node(),
          to: node(),
          ...(r.chance(0.5) ? { weight: r.value() } : {}),
        },
      };
    case 6:
      return { type: 'removeEdge', edge: edge() };
    case 7:
      return {
        type: 'setWeight',
        edge: edge(),
        weight: r.chance(0.2) ? null : r.value(),
      };
    case 8:
      return {
        type: 'highlight',
        ...(r.chance(0.7) ? { nodes: [node()] } : {}),
        ...(r.chance(0.7) ? { edges: [edge()] } : {}),
      };
    case 9:
      return { type: r.pick(['visit', 'settle']), node: node() };
    case 10:
      return {
        type: 'group',
        node: node(),
        group: r.pick([0, 1, 2, 3, 4, 5, null]),
      };
    case 11:
      return {
        type: 'pointer',
        name: pointerName(r),
        node: r.chance(0.2) ? null : node(),
      };
    case 12:
      return {
        type: 'annotate',
        node: node(),
        text: r.chance(0.2) ? null : r.pick(['d=4', '∞', '', 'x'.repeat(32)]),
      };
    case 13:
      return {
        type: 'markEdge',
        edge: edge(),
        mark: r.pick(['selected', 'rejected', null]),
      };
    default:
      return { type: 'resetMarks' };
  }
}

function tableAction(s: TableState, r: Dice): Fields {
  const rows = s.data.length;
  const columns = s.data[0]?.length ?? 0;
  const cell = () => [r.index(rows), r.index(columns)];
  const cells = () => Array.from({ length: 1 + r.int(3) }, cell);
  switch (r.int(6)) {
    case 0:
    case 1:
      return { type: 'set', cell: cell(), value: r.value() };
    case 2:
      return { type: 'highlight', cells: cells() };
    case 3:
      return { type: 'depend', cell: cell(), on: cells() };
    case 4:
      return { type: 'settle', cells: cells() };
    default:
      return { type: 'resetMarks' };
  }
}

function hashAction(s: HashTableState, r: Dice): Fields {
  const size = s.data.length;
  const bucket = r.index(size, 0.03);
  const chain = s.data[bucket]?.length ?? 0;
  const all = s.data.flatMap((c) => ids(c));
  switch (r.int(7)) {
    case 0:
    case 1:
      return {
        type: 'insert',
        bucket,
        element: { id: r.id(all, 'h'), value: r.value() },
        ...(r.chance(0.4) ? { index: r.index(chain + 1) } : {}),
      };
    case 2:
      return { type: 'remove', bucket, index: r.index(chain) };
    case 3:
      return { type: 'set', bucket, index: r.index(chain), value: r.value() };
    case 4:
      return {
        type: 'highlight',
        bucket,
        ...(r.chance(0.6) ? { indices: positions(r, chain) } : {}),
      };
    case 5:
      return { type: 'settle', bucket, index: r.index(chain) };
    default:
      return { type: 'resetMarks' };
  }
}

/** The id an action introduces, if any: ids must be new for the whole trace. */
export function introducedId(a: Fields): string | undefined {
  for (const key of ['element', 'node', 'edge']) {
    const v = a[key];
    if (typeof v === 'object' && v !== null && 'id' in v) return String(v.id);
  }
  return undefined;
}

/** Every id in a declaration. */
export function declIds(decl: StructureDecl): string[] {
  switch (decl.kind) {
    case 'array':
    case 'stack':
    case 'queue':
    case 'linkedList':
      return ids(decl.initial);
    case 'tree':
      return ids(decl.nodes);
    case 'graph':
      return [...ids(decl.nodes), ...ids(decl.edges)];
    case 'table':
      return [];
    case 'hashTable':
      return decl.buckets.flatMap(ids);
    case 'priorityQueue':
      return ids(decl.initial);
  }
}

export type { TargetedAction };
