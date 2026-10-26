/**
 * Plain models of what each action does to a structure's data, written
 * from the protocol's descriptions rather than from the reducers. A model
 * returns the new data, or `undefined` if the action must be rejected.
 * Marks are left to the invariants.
 */
import type { Scalar, StructureDecl } from '@algoviz/spec';

type Element = { id: string; value: Scalar };
type ListNode = Element & { next: string | null; prev: string | null };
type A = Record<string, unknown>;

export type ModelData =
  | { kind: 'array' | 'stack' | 'queue'; items: Element[] }
  | { kind: 'linkedList'; doubly: boolean; nodes: ListNode[] }
  | { kind: 'table'; cells: Scalar[][] }
  | { kind: 'hashTable'; buckets: Element[][] };

export type ModelKind = ModelData['kind'];
export const modelled: readonly string[] = [
  'array',
  'stack',
  'queue',
  'linkedList',
  'table',
  'hashTable',
];

export function initModel(decl: StructureDecl): ModelData | undefined {
  switch (decl.kind) {
    case 'array':
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
  switch (m.kind) {
    case 'array': {
      const xs = m.items;
      const n = xs.length;
      switch (a['type']) {
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
    default:
      return { kind: entry.kind, items: s['data'] };
  }
}
