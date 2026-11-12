/**
 * Helpers for checking what a document shows, independent of how its
 * author named things: checks look for a structure of the right kind whose
 * states match, not for a particular name.
 */
import {
  highlightCode,
  isCodeLine,
  type ArrayState,
  type BTreeState,
  type PlaneState,
  type GraphState,
  type HashTableState,
  type KindedState,
  type LinkedListState,
  type PriorityQueueState,
  type QueueState,
  type StackState,
  type TableState,
  type Trace,
  type TreeState,
  type VisualizationState,
} from '@algoviz/core';
import type { Scalar, StructureKindName } from '@algoviz/spec';

type StateOf = {
  array: ArrayState;
  stack: StackState;
  queue: QueueState;
  linkedList: LinkedListState;
  tree: TreeState;
  graph: GraphState;
  table: TableState;
  hashTable: HashTableState;
  priorityQueue: PriorityQueueState;
  btree: BTreeState;
  plane: PlaneState;
};

/** A structure seen across the trace: its name and its states by frame. */
export interface Track<K extends StructureKindName> {
  readonly name: string;
  readonly states: readonly StateOf[K][];
  readonly first: StateOf[K];
  readonly last: StateOf[K];
}

/** Every frame's state, in order. */
export const frames = (trace: Trace): VisualizationState[] =>
  Array.from({ length: trace.length + 1 }, (_, i) => trace.frame(i).state);

/** Every structure of kind `kind`, with its state in each frame. */
export function tracks<K extends StructureKindName>(
  trace: Trace,
  kind: K,
): Track<K>[] {
  const all = frames(trace);
  return Object.entries(trace.visualization.structures)
    .filter(([, decl]) => decl.kind === kind)
    .map(([name]) => {
      const states = all.map(
        (state) => (state[name] as KindedState).state as StateOf[K],
      );
      return { name, states, first: states[0]!, last: states.at(-1)! };
    });
}

/** Values of an array, stack or queue, in order. */
export const values = (state: { data: readonly { value: Scalar }[] }) =>
  state.data.map((e) => e.value);

export const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const sortedNumbers = (xs: readonly number[]) =>
  [...xs].sort((a, b) => a - b);

/**
 * The values of a linked list in link order. It starts from a node nothing
 * points to (the longest chain, if a removed node still dangles), or from
 * the first node if every node is pointed to. Stops at a repeat.
 */
export function listOrder(state: LinkedListState): Scalar[] {
  const byId = new Map(state.data.map((n) => [n.id, n]));
  const targets = new Set(state.data.map((n) => n.next));
  const follow = (start: (typeof state.data)[number]) => {
    const out: Scalar[] = [];
    const seen = new Set<string>();
    let node: typeof start | undefined = start;
    while (node !== undefined && !seen.has(node.id)) {
      seen.add(node.id);
      out.push(node.value);
      node = node.next === null ? undefined : byId.get(node.next);
    }
    return out;
  };
  const heads = state.data.filter((n) => !targets.has(n.id));
  const starts = heads.length > 0 ? heads : state.data.slice(0, 1);
  return starts
    .map(follow)
    .reduce<Scalar[]>((a, b) => (b.length > a.length ? b : a), []);
}

/** Whether following `next` from some node returns to a node seen before. */
export function hasCycle(state: LinkedListState): boolean {
  const byId = new Map(state.data.map((n) => [n.id, n]));
  return state.data.some((start) => {
    const seen = new Set<string>();
    let node: typeof start | undefined = start;
    while (node !== undefined) {
      if (seen.has(node.id)) return true;
      seen.add(node.id);
      node = node.next === null ? undefined : byId.get(node.next);
    }
    return false;
  });
}

export const treeNode = (state: TreeState, id: string | null) =>
  id === null ? undefined : state.data.nodes.find((n) => n.id === id);

/** In-order values of a binary tree rooted at `id`. */
export function inorder(state: TreeState, id: string | null): Scalar[] {
  const node = treeNode(state, id);
  if (node === undefined) return [];
  const [left = null, right = null] = node.children;
  return [...inorder(state, left), node.value, ...inorder(state, right)];
}

/** The ids in the subtree rooted at `id`. */
export function subtree(state: TreeState, id: string): string[] {
  const node = treeNode(state, id);
  if (node === undefined) return [];
  return [
    id,
    ...node.children.flatMap((c) => (c === null ? [] : subtree(state, c))),
  ];
}

/** Values on each path from `id` to a leaf. */
export function paths(state: TreeState, id: string): Scalar[][] {
  const node = treeNode(state, id);
  if (node === undefined) return [];
  const children = node.children.filter((c): c is string => c !== null);
  if (children.length === 0) return [[node.value]];
  return children.flatMap((c) =>
    paths(state, c).map((p) => [node.value, ...p]),
  );
}

/** Numbers in a short text, e.g. "d=4" → [4]. */
export const numbersIn = (text: string): number[] =>
  [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** The value of each graph node's note, if it holds exactly one number. */
export function noteNumbers(state: GraphState): Map<string, number> {
  const out = new Map<string, number>();
  for (const [node, text] of Object.entries(state.marks.notes)) {
    const numbers = numbersIn(text);
    if (numbers.length === 1) out.set(node, numbers[0]!);
  }
  return out;
}

/** The node set of a graph state. */
export const nodeIds = (state: GraphState) => state.data.nodes.map((n) => n.id);

/**
 * Finds the first structure of `kind` for which `test` returns no
 * problems, or reports the problems of the closest one.
 */
export function anyTrack<K extends StructureKindName>(
  trace: Trace,
  kind: K,
  test: (track: Track<K>) => string[],
): string[] {
  const candidates = tracks(trace, kind);
  if (candidates.length === 0) return [`no ${kind} structure`];
  let best: string[] | undefined;
  for (const track of candidates) {
    const problems = test(track);
    if (problems.length === 0) return [];
    if (best === undefined || problems.length < best.length)
      best = problems.map((p) => `${track.name}: ${p}`);
  }
  return best!;
}

/** Returns `[message]` unless `ok`. */
export const expect = (ok: boolean, message: string): string[] =>
  ok ? [] : [message];

/**
 * Problems with code shown in pseudocode and Python (ADR 0017): both
 * languages in `sources`, every step with actions pointing at an anchor,
 * at least `minAnchors` distinct anchors, each on a line of code in every
 * language, and a procedure named in capitals in the pseudocode.
 */
export function twoLanguages(trace: Trace, minAnchors = 2): string[] {
  const { sources, steps } = trace.visualization;
  const languages = (sources ?? []).map((s) => s.language);
  if (!languages.includes('pseudocode') || !languages.includes('python'))
    return ['does not give the code in both pseudocode and Python (`sources`)'];
  const unanchored = steps.filter(
    (s) => s.actions.length > 0 && s.meta?.at === undefined,
  ).length;
  const used = [
    ...new Set(
      steps.flatMap((s) => (s.meta?.at === undefined ? [] : [s.meta.at])),
    ),
  ];
  const offCode = sources!.flatMap(({ language, code, anchors }) => {
    const lines = code.split('\n');
    return used
      .filter(
        (at) => !isCodeLine(lines[(anchors[at] ?? 0) - 1] ?? '', language),
      )
      .map((at) => `${language} @${at}`);
  });
  const pseudocode = sources!.find((s) => s.language === 'pseudocode')!;
  const procedure = highlightCode(pseudocode.code, 'pseudocode').some((line) =>
    line.some((t) => t.kind === 'function'),
  );
  return [
    ...expect(
      unanchored === 0,
      `${unanchored} steps with actions point at no code line (\`meta.at\`)`,
    ),
    ...expect(
      used.length >= minAnchors,
      `points at ${used.length} anchors, fewer than ${minAnchors}`,
    ),
    ...expect(
      offCode.length === 0,
      `anchors on blank or comment lines: ${offCode.join(', ')}`,
    ),
    ...expect(
      procedure,
      'the pseudocode names no procedure in capitals, as CLRS does',
    ),
  ];
}

/** A value as a number; numeric strings count, null does not. */
export const num = (v: Scalar): number => (v === null ? NaN : Number(v));
export const nums = (vs: readonly Scalar[]) => vs.map(num);
export const str = (vs: readonly Scalar[]) => vs.map((v) => String(v));

export const selected = (s: GraphState) =>
  s.data.edges.filter((e) => s.marks.edgeMarks[e.id] === 'selected');
export const rejected = (s: GraphState) =>
  s.data.edges.filter((e) => s.marks.edgeMarks[e.id] === 'rejected');

/** Most of `count(state)` gained in one step: 1 when added one at a time. */
export const maxGain = <S>(states: readonly S[], count: (s: S) => number) =>
  Math.max(0, ...states.slice(1).map((s, i) => count(s) - count(states[i]!)));

/** A graph whose nodes and edges are exactly these (by endpoints). */
export function graphIs(
  t: Track<'graph'>,
  nodes: readonly string[],
  edges: readonly (readonly [string, string, number?])[],
  directed: boolean,
): string[] {
  const g = t.first;
  const key = (a: string, b: string) =>
    directed ? `${a}>${b}` : [a, b].sort().join('|');
  const want = edges.map(([a, b, w]) => `${key(a, b)}:${w ?? ''}`).sort();
  const got = g.data.edges
    .map(
      (e) =>
        `${key(e.from, e.to)}:${typeof e.weight === 'number' ? e.weight : ''}`,
    )
    .sort();
  return [
    ...expect(
      g.directed === directed,
      directed ? 'is not directed' : 'is directed',
    ),
    ...expect(
      same(sortedNodes(g), [...nodes].sort()),
      `has nodes ${JSON.stringify(sortedNodes(g))}`,
    ),
    ...expect(same(got, want), `has edges ${JSON.stringify(got)}`),
  ];
}
export const sortedNodes = (g: Track<'graph'>['first']) =>
  [...nodeIds(g)].sort();
