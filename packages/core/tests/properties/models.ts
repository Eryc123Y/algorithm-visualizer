/**
 * Plain models of what each action does to a structure's data, written
 * from the protocol's descriptions rather than from the reducers. A model
 * returns the new data, or `undefined` if the action must be rejected.
 * Marks are left to the invariants.
 */
import { LIMITS, type Scalar, type StructureDecl } from '@algoviz/spec';

import {
  applyBTreeModel,
  initBTreeModel,
  type BTreeModel,
} from './btree-model.ts';
import {
  applyPlaneModel,
  initPlaneModel,
  type PlaneModel,
} from './plane-model.ts';
import { applyTreeModel, initTreeModel, type TreeModel } from './tree-model.ts';

type Element = { id: string; value: Scalar };
type Item = Element & { key: number | null };
type ListNode = Element & { next: string | null; prev: string | null };
type A = Record<string, unknown>;

/** A pattern under an array's text (ADR 0037), without the step's marks. */
type PatternModel = { elements: Element[]; shift: number; matched: number[] };

export type ModelData =
  | {
      kind: 'array' | 'stack' | 'queue';
      items: Element[];
      pattern?: PatternModel;
    }
  | { kind: 'linkedList'; doubly: boolean; nodes: ListNode[] }
  | { kind: 'table'; cells: Scalar[][] }
  | { kind: 'hashTable'; buckets: Element[][] }
  | { kind: 'priorityQueue'; order: 'min' | 'max'; items: Item[] }
  | TreeModel
  | BTreeModel
  | PlaneModel;

export type ModelKind = ModelData['kind'];
export const modelled: readonly string[] = [
  'array',
  'stack',
  'queue',
  'linkedList',
  'table',
  'hashTable',
  'priorityQueue',
  'tree',
  'btree',
  'plane',
];

export function initModel(decl: StructureDecl): ModelData | undefined {
  switch (decl.kind) {
    case 'array':
      return {
        kind: 'array',
        items: [...decl.initial],
        ...(decl.pattern === undefined
          ? {}
          : {
              pattern: {
                elements: [...decl.pattern],
                shift: decl.shift ?? 0,
                matched: [],
              },
            }),
      };
    case 'stack':
    case 'queue':
      return { kind: decl.kind, items: [...decl.initial] };
    case 'linkedList': {
      const n = decl.initial.length;
      const doubly = decl.doubly ?? false;
      const circular = (decl.circular ?? false) && n > 0;
      const at = (k: number) => decl.initial[(k + n) % n]!.id;
      return {
        kind: 'linkedList',
        doubly,
        nodes: decl.initial.map((e, k) => ({
          ...e,
          next: k < n - 1 ? at(k + 1) : circular ? at(0) : null,
          prev: !doubly ? null : k > 0 ? at(k - 1) : circular ? at(-1) : null,
        })),
      };
    }
    case 'table':
      return { kind: 'table', cells: decl.cells.map((row) => [...row]) };
    case 'hashTable':
      return { kind: 'hashTable', buckets: decl.buckets.map((c) => [...c]) };
    case 'priorityQueue':
      return {
        kind: 'priorityQueue',
        order: decl.order ?? 'min',
        items: [...decl.initial],
      };
    case 'tree':
      return initTreeModel(decl);
    case 'btree':
      return initBTreeModel(decl);
    case 'plane':
      return initPlaneModel(decl);
    default:
      return undefined;
  }
}

const inRange = (i: unknown, n: number): i is number =>
  typeof i === 'number' && i >= 0 && i < n;
const insertAt = <T>(xs: T[], i: number, x: T) => [
  ...xs.slice(0, i),
  x,
  ...xs.slice(i),
];

export function applyModel(m: ModelData, a: A): ModelData | undefined {
  if (m.kind === 'priorityQueue') return applyPriorityQueue(m, a);
  if (m.kind === 'tree') return applyTreeModel(m, a);
  if (m.kind === 'btree') return applyBTreeModel(m, a);
  if (m.kind === 'plane') return applyPlaneModel(m, a);
  switch (m.kind) {
    case 'array': {
      const xs = m.items;
      const n = xs.length;
      const p = m.pattern;
      // The text is fixed under a pattern.
      if (
        p !== undefined &&
        ['set', 'swap', 'insert', 'remove'].includes(a['type'] as string)
      )
        return undefined;
      switch (a['type']) {
        case 'align': {
          if (p === undefined) return undefined;
          const shift = a['shift'] as number;
          const k = (a['matched'] as number | undefined) ?? 0;
          if (shift > n || k > p.elements.length || shift + k > n)
            return undefined;
          for (let j = 0; j < k; j++)
            if (p.elements[j]!.value !== xs[shift + j]!.value) return undefined;
          return {
            ...m,
            pattern: { ...p, shift, matched: [...Array(k).keys()] },
          };
        }
        case 'check': {
          if (p === undefined) return undefined;
          const j = a['j'] as number;
          if (j >= p.elements.length || p.shift + j >= n) return undefined;
          const same = p.elements[j]!.value === xs[p.shift + j]!.value;
          return same && !p.matched.includes(j)
            ? {
                ...m,
                pattern: {
                  ...p,
                  matched: [...p.matched, j].sort((x, y) => x - y),
                },
              }
            : m;
        }
        case 'set':
          if (!inRange(a['index'], n)) return undefined;
          return {
            ...m,
            items: xs.map((e, k) =>
              k === a['index'] ? { id: e.id, value: a['value'] as Scalar } : e,
            ),
          };
        case 'swap': {
          const [i, j] = [a['i'], a['j']];
          if (!inRange(i, n) || !inRange(j, n)) return undefined;
          const ys = [...xs];
          [ys[i], ys[j]] = [ys[j]!, ys[i]!];
          return { ...m, items: ys };
        }
        case 'insert': {
          const e = a['element'] as Element;
          if (!inRange(a['index'], n + 1) || xs.some((x) => x.id === e.id))
            return undefined;
          return { ...m, items: insertAt(xs, a['index'], e) };
        }
        case 'remove':
          if (!inRange(a['index'], n)) return undefined;
          return { ...m, items: xs.filter((_, k) => k !== a['index']) };
        case 'compare':
          return inRange(a['i'], n) && inRange(a['j'], n) ? m : undefined;
        case 'highlight':
          return (a['indices'] as number[]).every((i) => inRange(i, n))
            ? m
            : undefined;
        case 'pointer':
          return a['index'] === null || inRange(a['index'], n + 1)
            ? m
            : undefined;
        case 'settle':
          return inRange(a['index'], n) ? m : undefined;
      }
      throw new Error(`unmodelled array action ${String(a['type'])}`);
    }
    case 'stack':
    case 'queue': {
      const xs = m.items;
      const n = xs.length;
      const e = a['element'] as Element;
      switch (a['type']) {
        case 'push':
        case 'enqueue':
          return { ...m, items: [...xs, e] };
        case 'pushFront':
          return { ...m, items: [e, ...xs] };
        case 'pop':
        case 'popBack':
          return n === 0 ? undefined : { ...m, items: xs.slice(0, -1) };
        case 'dequeue':
          return n === 0 ? undefined : { ...m, items: xs.slice(1) };
        case 'peek':
          return n === 0 ? undefined : m;
        case 'highlight':
          return (a['indices'] as number[]).every((i) => inRange(i, n))
            ? m
            : undefined;
      }
      throw new Error(`unmodelled ${m.kind} action ${String(a['type'])}`);
    }
    case 'linkedList': {
      const xs = m.nodes;
      const n = xs.length;
      switch (a['type']) {
        case 'insert': {
          const e = a['element'] as Element;
          if (!inRange(a['index'], n + 1) || xs.some((x) => x.id === e.id))
            return undefined;
          return {
            ...m,
            nodes: insertAt(xs, a['index'], { ...e, next: null, prev: null }),
          };
        }
        case 'remove': {
          if (!inRange(a['index'], n)) return undefined;
          const gone = xs[a['index']]!.id;
          return {
            ...m,
            nodes: xs
              .filter((x) => x.id !== gone)
              .map((x) => ({
                ...x,
                next: x.next === gone ? null : x.next,
                prev: x.prev === gone ? null : x.prev,
              })),
          };
        }
        case 'set':
          if (!inRange(a['index'], n)) return undefined;
          return {
            ...m,
            nodes: xs.map((x, k) =>
              k === a['index'] ? { ...x, value: a['value'] as Scalar } : x,
            ),
          };
        case 'move': {
          // The node leaves its place and is put back at `to`; links stay.
          if (!inRange(a['from'], n) || !inRange(a['to'], n)) return undefined;
          const node = xs[a['from']]!;
          const rest = [...xs.slice(0, a['from']), ...xs.slice(a['from'] + 1)];
          return {
            ...m,
            nodes: [...rest.slice(0, a['to']), node, ...rest.slice(a['to'])],
          };
        }
        case 'link': {
          const field = (a['field'] as 'next' | 'prev' | undefined) ?? 'next';
          if (!inRange(a['from'], n)) return undefined;
          if (a['to'] !== null && !inRange(a['to'], n)) return undefined;
          if (field === 'prev' && !m.doubly) return undefined;
          const to = a['to'] === null ? null : xs[a['to']]!.id;
          return {
            ...m,
            nodes: xs.map((x, k) =>
              k === a['from'] ? { ...x, [field]: to } : x,
            ),
          };
        }
        case 'pointer':
          return a['index'] === null || inRange(a['index'], n) ? m : undefined;
        case 'highlight':
          return (a['indices'] as number[]).every((i) => inRange(i, n))
            ? m
            : undefined;
        case 'visit':
        case 'settle':
          return inRange(a['index'], n) ? m : undefined;
      }
      throw new Error(`unmodelled list action ${String(a['type'])}`);
    }
    case 'table': {
      const rows = m.cells.length;
      const columns = m.cells[0]?.length ?? 0;
      const ok = (c: unknown) => {
        const [r, k] = c as [number, number];
        return inRange(r, rows) && inRange(k, columns);
      };
      switch (a['type']) {
        case 'set': {
          if (!ok(a['cell'])) return undefined;
          const [r, k] = a['cell'] as [number, number];
          return {
            ...m,
            cells: m.cells.map((row, i) =>
              i === r
                ? row.map((v, j) => (j === k ? (a['value'] as Scalar) : v))
                : row,
            ),
          };
        }
        case 'highlight':
        case 'settle':
          return (a['cells'] as unknown[]).every(ok) ? m : undefined;
        case 'depend':
          return ok(a['cell']) && (a['on'] as unknown[]).every(ok)
            ? m
            : undefined;
        case 'resetMarks':
          return m;
      }
      throw new Error(`unmodelled table action ${String(a['type'])}`);
    }
    case 'hashTable': {
      const b = a['bucket'] as number;
      if (a['type'] === 'resetMarks') return m;
      if (!inRange(b, m.buckets.length)) return undefined;
      const chain = m.buckets[b]!;
      const put = (c: Element[]) => ({
        ...m,
        buckets: m.buckets.map((x, i) => (i === b ? c : x)),
      });
      switch (a['type']) {
        case 'insert': {
          const e = a['element'] as Element;
          const index = (a['index'] as number | undefined) ?? chain.length;
          if (!inRange(index, chain.length + 1)) return undefined;
          if (m.buckets.some((c) => c.some((x) => x.id === e.id)))
            return undefined;
          return put(insertAt(chain, index, e));
        }
        case 'remove':
          if (!inRange(a['index'], chain.length)) return undefined;
          return put(chain.filter((_, k) => k !== a['index']));
        case 'set':
          if (!inRange(a['index'], chain.length)) return undefined;
          return put(
            chain.map((x, k) =>
              k === a['index'] ? { ...x, value: a['value'] as Scalar } : x,
            ),
          );
        case 'highlight':
          return ((a['indices'] as number[] | undefined) ?? []).every((i) =>
            inRange(i, chain.length),
          )
            ? m
            : undefined;
        case 'settle':
          return inRange(a['index'], chain.length) ? m : undefined;
      }
      throw new Error(`unmodelled hash action ${String(a['type'])}`);
    }
  }
}

/**
 * The position, in insertion order, of the item a priority queue serves
 * first: a linear scan for the best key, null worst, the earliest on ties.
 */
function frontIndex(order: 'min' | 'max', items: readonly Item[]): number {
  let best = -1;
  for (let k = 0; k < items.length; k++) {
    const key = items[k]!.key;
    if (key === null) {
      if (best < 0) best = k;
      continue;
    }
    const held = best < 0 ? null : items[best]!.key;
    if (held === null || (order === 'min' ? key < held : key > held)) best = k;
  }
  return best;
}

function applyPriorityQueue(
  m: ModelData & { kind: 'priorityQueue' },
  a: A,
): ModelData | undefined {
  const xs = m.items;
  const has = (id: unknown) => xs.some((x) => x.id === id);
  switch (a['type']) {
    case 'insert': {
      const e = a['element'] as Element;
      if (has(e.id) || xs.length >= LIMITS.elementsPerStructure)
        return undefined;
      return { ...m, items: [...xs, { ...e, key: a['key'] as number | null }] };
    }
    case 'extract': {
      const k = frontIndex(m.order, xs);
      return k < 0 ? undefined : { ...m, items: xs.filter((_, j) => j !== k) };
    }
    case 'setKey':
      return has(a['id'])
        ? {
            ...m,
            items: xs.map((x) =>
              x.id === a['id'] ? { ...x, key: a['key'] as number | null } : x,
            ),
          }
        : undefined;
    case 'peek':
      return xs.length === 0 ? undefined : m;
    case 'highlight':
      return (a['ids'] as string[]).every(has) ? m : undefined;
  }
  throw new Error(`unmodelled priority queue action ${String(a['type'])}`);
}

/** The engine state's data, in the model's shape. */
export function dataOf(entry: { kind: string; state: unknown }): unknown {
  const s = entry.state as Record<string, unknown>;
  switch (entry.kind) {
    case 'linkedList':
      return { kind: 'linkedList', doubly: s['doubly'], nodes: s['data'] };
    case 'table':
      return { kind: 'table', cells: s['data'] };
    case 'hashTable':
      return { kind: 'hashTable', buckets: s['data'] };
    case 'priorityQueue':
      return { kind: 'priorityQueue', ...(s['data'] as object) };
    case 'plane': {
      const data = s['data'] as { points: unknown; segments: unknown };
      return { kind: 'plane', points: data.points, segments: data.segments };
    }
    case 'btree': {
      const data = s['data'] as { nodes: unknown; root: unknown };
      const marks = s['marks'] as { pointers: unknown; notes: unknown };
      return {
        kind: 'btree',
        nodes: data.nodes,
        root: data.root,
        pointers: marks.pointers,
        notes: marks.notes,
      };
    }
    case 'tree': {
      const data = s['data'] as { nodes: unknown; roots: unknown };
      const marks = s['marks'] as Record<string, unknown>;
      return {
        kind: 'tree',
        binary: s['binary'],
        nodes: data.nodes,
        roots: data.roots,
        marks: {
          pointers: marks['pointers'],
          notes: marks['notes'],
          namedNotes: marks['namedNotes'],
          edgeMarks: marks['edgeMarks'],
          edgeLabels: marks['edgeLabels'],
        },
      };
    }
    case 'array': {
      const p = s['pattern'] as
        { elements: unknown; shift: unknown; matched: unknown } | undefined;
      return {
        kind: 'array',
        items: s['data'],
        ...(p === undefined
          ? {}
          : {
              pattern: {
                elements: p.elements,
                shift: p.shift,
                matched: p.matched,
              },
            }),
      };
    }
    default:
      return { kind: entry.kind, items: s['data'] };
  }
}
