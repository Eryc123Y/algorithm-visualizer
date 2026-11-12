/**
 * A plain model of the `tree` kind's data, written from the protocol's
 * descriptions (the MCP guide and ADR 0034) rather than from the reducer:
 * nodes with ordered child slots and the roots in order, and the marks
 * that hang on the shape: pointers (at nodes or NIL slots), plain and
 * named notes, and edge marks and labels, which go when their edge does.
 * Returns the new model, or `undefined` if the action must be rejected.
 */
import { LIMITS, type Scalar, type TreeDecl } from '@algoviz/spec';

export interface ModelNode {
  readonly id: string;
  readonly value: Scalar;
  readonly children: readonly (string | null)[];
  readonly color: 'red' | 'black' | null;
}

type NilTarget = { readonly parent: string; readonly slot: number };
type Rec<V> = Readonly<Record<string, V>>;

/** The marks the model follows; the order of keys is the order set. */
export interface ModelMarks {
  readonly pointers: Rec<string | NilTarget>;
  readonly notes: Rec<string>;
  readonly namedNotes: Rec<Rec<string>>;
  readonly edgeMarks: Rec<string>;
  readonly edgeLabels: Rec<string | number>;
}

export interface TreeModel {
  readonly kind: 'tree';
  readonly binary: boolean;
  readonly nodes: readonly ModelNode[];
  readonly roots: readonly string[];
  readonly marks: ModelMarks;
}

/** Most named notes on one node (ADR 0034). */
const NAMED_NOTES = 4;

const emptyMarks: ModelMarks = {
  pointers: {},
  notes: {},
  namedNotes: {},
  edgeMarks: {},
  edgeLabels: {},
};

const keep = <V>(r: Rec<V>, test: (key: string, value: V) => boolean) =>
  Object.fromEntries(Object.entries(r).filter(([k, v]) => test(k, v)));

const setOrDrop = <V>(r: Rec<V>, key: string, value: V | null): Rec<V> =>
  value === null ? keep(r, (k) => k !== key) : { ...r, [key]: value };

/** Each child's edge: its parent, and its slot in a binary tree. */
const edgesOf = (m: TreeModel) =>
  new Map(
    m.nodes.flatMap((n) =>
      n.children.flatMap((c, slot) =>
        c === null ? [] : [[c, m.binary ? `${n.id}/${slot}` : n.id] as const],
      ),
    ),
  );

/**
 * The marks after a change of shape from `before` to `after`: marks on
 * removed nodes go, NIL pointers go when their slot is no longer empty,
 * and edge marks and labels go when their edge changed.
 */
function followMarks(before: TreeModel, after: TreeModel): TreeModel {
  const ids = new Set(after.nodes.map((n) => n.id));
  const [was, is] = [edgesOf(before), edgesOf(after)];
  const same = (id: string) => is.has(id) && is.get(id) === was.get(id);
  const empty = (t: NilTarget) =>
    after.nodes.find((n) => n.id === t.parent)?.children[t.slot] === null;
  const m = after.marks;
  return {
    ...after,
    marks: {
      pointers: keep(m.pointers, (_, t) =>
        typeof t === 'string' ? ids.has(t) : empty(t),
      ),
      notes: keep(m.notes, (id) => ids.has(id)),
      namedNotes: keep(m.namedNotes, (id) => ids.has(id)),
      edgeMarks: keep(m.edgeMarks, same),
      edgeLabels: keep(m.edgeLabels, same),
    },
  };
}

/** Applies an action, then lets the marks follow the shape. */
export function applyTreeModel(m: TreeModel, a: A): TreeModel | undefined {
  const next = applyAction(m, a);
  return next === undefined ? undefined : followMarks(m, next);
}

/** Sets a mark, or `undefined` if the action must be rejected. */
function applyMark(m: TreeModel, a: A): TreeModel | undefined {
  const marks = m.marks;
  const node = a['node'] as string;
  const set = (patch: Partial<ModelMarks>): TreeModel => ({
    ...m,
    marks: { ...marks, ...patch },
  });
  switch (a['type']) {
    case 'pointer':
      return set({
        pointers: setOrDrop(
          marks.pointers,
          a['name'] as string,
          a['node'] as string | NilTarget | null,
        ),
      });
    case 'annotate': {
      const text = a['text'] as string | null;
      const field = a['field'] as string | undefined;
      if (field === undefined)
        return set({ notes: setOrDrop(marks.notes, node, text) });
      const fields = marks.namedNotes[node] ?? {};
      if (
        text !== null &&
        !Object.hasOwn(fields, field) &&
        Object.keys(fields).length >= NAMED_NOTES
      )
        return undefined;
      const next = setOrDrop(fields, field, text);
      return set({
        namedNotes: setOrDrop(
          marks.namedNotes,
          node,
          Object.keys(next).length === 0 ? null : next,
        ),
      });
    }
    case 'markEdge':
      return set({
        edgeMarks: setOrDrop(marks.edgeMarks, node, a['mark'] as string | null),
      });
    case 'labelEdge':
      return set({
        edgeLabels: setOrDrop(
          marks.edgeLabels,
          node,
          a['label'] as string | number | null,
        ),
      });
    default:
      return m;
  }
}

type A = Record<string, unknown>;

export function initTreeModel(decl: TreeDecl): TreeModel {
  return {
    kind: 'tree',
    binary: decl.binary,
    nodes: decl.nodes.map((n) => ({
      id: n.id,
      value: n.value,
      children: decl.binary
        ? [n.children?.[0] ?? null, n.children?.[1] ?? null]
        : [...(n.children ?? [])],
      color: n.color ?? null,
    })),
    roots: [...decl.roots],
    marks: emptyMarks,
  };
}

const insertAt = <T>(xs: readonly T[], i: number, x: T): T[] => [
  ...xs.slice(0, i),
  x,
  ...xs.slice(i),
];

/** A whole number from 0 to `max`, or undefined for anything else. */
const slotUpTo = (slot: unknown, max: number): number | undefined =>
  typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot <= max
    ? slot
    : undefined;

function applyAction(m: TreeModel, a: A): TreeModel | undefined {
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const has = (id: unknown): id is string =>
    typeof id === 'string' && byId.has(id);
  const parentOf = (id: string) => m.nodes.find((n) => n.children.includes(id));
  const set = (id: string, f: (n: ModelNode) => ModelNode): TreeModel => ({
    ...m,
    nodes: m.nodes.map((n) => (n.id === id ? f(n) : n)),
  });
  /** The model without `id` in its parent's slot or among the roots. */
  const unhook = (t: TreeModel, id: string): TreeModel => ({
    ...t,
    roots: t.roots.filter((r) => r !== id),
    nodes: t.nodes.map((n) =>
      !n.children.includes(id)
        ? n
        : {
            ...n,
            children: t.binary
              ? n.children.map((c) => (c === id ? null : c))
              : n.children.filter((c) => c !== id),
          },
    ),
  });
  const below = (id: string): Set<string> => {
    const out = new Set<string>();
    const walk = (x: string) => {
      out.add(x);
      for (const c of byId.get(x)?.children ?? []) if (c !== null) walk(c);
    };
    walk(id);
    return out;
  };
  const putChild = (
    t: TreeModel,
    parent: string,
    slot: number,
    child: string,
  ): TreeModel => {
    const p = t.nodes.find((n) => n.id === parent)!;
    if (!t.binary)
      return {
        ...t,
        nodes: t.nodes.map((n) =>
          n.id === parent
            ? { ...n, children: insertAt(n.children, slot, child) }
            : n,
        ),
      };
    const displaced = p.children[slot] ?? null;
    return {
      ...t,
      roots: displaced === null ? t.roots : [...t.roots, displaced],
      nodes: t.nodes.map((n) =>
        n.id === parent
          ? {
              ...n,
              children: n.children.map((c, k) => (k === slot ? child : c)),
            }
          : n,
      ),
    };
  };

  switch (a['type']) {
    case 'addNode': {
      const node = a['node'] as { id: string; value: Scalar; color?: string };
      if (byId.has(node.id) || m.nodes.length >= LIMITS.elementsPerStructure)
        return undefined;
      const fresh: ModelNode = {
        id: node.id,
        value: node.value,
        children: m.binary ? [null, null] : [],
        color: (node.color as ModelNode['color'] | undefined) ?? null,
      };
      const added = { ...m, nodes: [...m.nodes, fresh] };
      if (a['parent'] === null) {
        const slot =
          a['slot'] === undefined
            ? m.roots.length
            : slotUpTo(a['slot'], m.roots.length);
        if (slot === undefined) return undefined;
        return { ...added, roots: insertAt(m.roots, slot, fresh.id) };
      }
      if (!has(a['parent'])) return undefined;
      const parent = byId.get(a['parent'])!;
      if (!m.binary) {
        const slot =
          a['slot'] === undefined
            ? parent.children.length
            : slotUpTo(a['slot'], parent.children.length);
        return slot === undefined
          ? undefined
          : putChild(added, parent.id, slot, fresh.id);
      }
      const slot =
        a['slot'] === undefined
          ? parent.children.indexOf(null)
          : slotUpTo(a['slot'], 1);
      if (slot === undefined || slot < 0 || parent.children[slot] !== null)
        return undefined;
      return putChild(added, parent.id, slot, fresh.id);
    }
    case 'removeNode': {
      if (!has(a['node'])) return undefined;
      const gone = below(a['node']);
      const t = unhook(m, a['node']);
      return { ...t, nodes: t.nodes.filter((n) => !gone.has(n.id)) };
    }
    case 'setChild': {
      if (!has(a['parent'])) return undefined;
      if (a['child'] !== null && !has(a['child'])) return undefined;
      if (a['slot'] === undefined && (m.binary || a['child'] === null))
        return undefined;
      if (m.binary && slotUpTo(a['slot'], 1) === undefined) return undefined;
      const parent = byId.get(a['parent'])!;
      if (a['child'] === null) {
        const current = parent.children[a['slot'] as number] ?? null;
        if (current === null) return m;
        const t = unhook(m, current);
        return { ...t, roots: [...t.roots, current] };
      }
      const child = a['child'];
      if (below(child).has(parent.id)) return undefined;
      const t = unhook(m, child);
      const target = t.nodes.find((n) => n.id === parent.id)!;
      const slot = m.binary
        ? (a['slot'] as number)
        : a['slot'] === undefined
          ? target.children.length
          : slotUpTo(a['slot'], target.children.length);
      return slot === undefined
        ? undefined
        : putChild(t, parent.id, slot, child);
    }
    case 'detach': {
      if (!has(a['node'])) return undefined;
      const id = a['node'];
      const others = m.roots.filter((r) => r !== id);
      const slot =
        a['slot'] === undefined
          ? others.length
          : slotUpTo(a['slot'], others.length);
      if (slot === undefined) return undefined;
      if (m.roots.includes(id) && a['slot'] === undefined) return m;
      const t = unhook(m, id);
      return { ...t, roots: insertAt(others, slot, id) };
    }
    case 'rotate': {
      if (!has(a['node']) || !m.binary) return undefined;
      const [up, down] = a['direction'] === 'left' ? [1, 0] : [0, 1];
      const x = byId.get(a['node'])!;
      const y = x.children[up] ?? null;
      if (y === null) return undefined;
      const inner = byId.get(y)!.children[down] ?? null;
      const parent = parentOf(x.id);
      return {
        ...m,
        roots: m.roots.map((r) => (r === x.id ? y : r)),
        nodes: m.nodes.map((n) => {
          const slots = [...n.children];
          if (n.id === x.id) slots[up] = inner;
          if (n.id === y) slots[down] = x.id;
          if (n.id === parent?.id) slots[slots.indexOf(x.id)] = y;
          return { ...n, children: slots };
        }),
      };
    }
    case 'setValue':
      return has(a['node'])
        ? set(a['node'], (n) => ({ ...n, value: a['value'] as Scalar }))
        : undefined;
    case 'swapValues': {
      if (!has(a['a']) || !has(a['b'])) return undefined;
      const [va, vb] = [byId.get(a['a'])!.value, byId.get(a['b'])!.value];
      return {
        ...m,
        nodes: m.nodes.map((n) =>
          n.id === a['a']
            ? { ...n, value: vb }
            : n.id === a['b']
              ? { ...n, value: va }
              : n,
        ),
      };
    }
    case 'setColor':
      return has(a['node'])
        ? set(a['node'], (n) => ({
            ...n,
            color: a['color'] as ModelNode['color'],
          }))
        : undefined;
    case 'highlight':
      return (a['nodes'] as unknown[]).every(has) ? m : undefined;
    case 'compare':
      return has(a['a']) && has(a['b']) ? m : undefined;
    case 'visit':
    case 'settle':
    case 'group':
      return has(a['node']) ? m : undefined;
    case 'annotate':
      return has(a['node']) ? applyMark(m, a) : undefined;
    case 'markEdge':
    case 'labelEdge':
      return has(a['node']) && !m.roots.includes(a['node'])
        ? applyMark(m, a)
        : undefined;
    case 'pointer': {
      const target = a['node'];
      if (target === null || typeof target === 'string')
        return target === null || has(target) ? applyMark(m, a) : undefined;
      const { parent, slot } = target as NilTarget;
      const p = byId.get(parent);
      return m.binary &&
        p !== undefined &&
        slot <= 1 &&
        p.children[slot] === null
        ? applyMark(m, a)
        : undefined;
    }
    default:
      throw new Error(`unmodelled tree action ${String(a['type'])}`);
  }
}
