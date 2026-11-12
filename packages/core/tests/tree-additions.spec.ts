/**
 * The tree additions of ADR 0034: root slots, NIL pointers, named notes,
 * edge marks and labels, and root lists, in the reducer and the layout.
 */
import { describe, expect, it } from 'vitest';

import { textWidth } from '@algoviz/fonts';

import {
  defaultFonts,
  layoutTrace,
  loadTrace,
  noteBox,
  type Scene,
  type SceneBadge,
  type SceneBox,
  type SceneEdge,
  type SceneNode,
  type Trace,
  type TreeState,
} from '../src/index.ts';
import { fitProblems, overlapProblems, sceneProblems } from './scene-check.ts';

type Action = Record<string, unknown>;

function mustLoad(input: unknown): Trace {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const errorsOf = (input: unknown) => {
  const result = loadTrace(input);
  return result.ok
    ? []
    : result.error.map(({ code, path }) => ({ code, path }));
};

/** A document with one tree `t` and one step per list of actions. */
const doc = (decl: Record<string, unknown>, steps: Action[][]) => ({
  version: '1.0',
  structures: { t: { kind: 'tree', ...decl } },
  steps: steps.map((actions) => ({
    actions: actions.map((a) => ({ target: 't', ...a })),
  })),
});

const stateAt = (trace: Trace, frame: number) =>
  trace.frame(frame).state['t']!.state as TreeState;

/** 8 with children 3 (with 1 and 6) and 10 (with a right child 14). */
const bst = {
  binary: true,
  nodes: [
    { id: 'n8', value: 8, children: ['n3', 'n10'] },
    { id: 'n3', value: 3, children: ['n1', 'n6'] },
    { id: 'n1', value: 1 },
    { id: 'n6', value: 6 },
    { id: 'n10', value: 10, children: [null, 'n14'] },
    { id: 'n14', value: 14 },
  ],
};

/** Three roots: a (with child b), c and d. */
const forest = {
  nodes: [
    { id: 'a', value: 'a', children: ['b'] },
    { id: 'b', value: 'b' },
    { id: 'c', value: 'c' },
    { id: 'd', value: 'd' },
  ],
};

describe('root slots (S1)', () => {
  it('put a new root at its slot', () => {
    const trace = mustLoad(
      doc(forest, [
        [
          {
            type: 'addNode',
            node: { id: 'x', value: 1 },
            parent: null,
            slot: 0,
          },
        ],
        [
          {
            type: 'addNode',
            node: { id: 'y', value: 2 },
            parent: null,
            slot: 2,
          },
        ],
        [{ type: 'addNode', node: { id: 'z', value: 3 }, parent: null }],
      ]),
    );
    expect(stateAt(trace, 1).data.roots).toEqual(['x', 'a', 'c', 'd']);
    expect(stateAt(trace, 2).data.roots).toEqual(['x', 'a', 'y', 'c', 'd']);
    expect(stateAt(trace, 3).data.roots).toEqual([
      'x',
      'a',
      'y',
      'c',
      'd',
      'z',
    ]);
  });

  it('cut a subtree to a slot, and move a root to one', () => {
    const trace = mustLoad(
      doc(forest, [
        [{ type: 'detach', node: 'b', slot: 1 }],
        [{ type: 'detach', node: 'd', slot: 0 }],
        [{ type: 'detach', node: 'd' }],
        [{ type: 'detach', node: 'd', slot: 3 }],
      ]),
    );
    expect(stateAt(trace, 1).data.roots).toEqual(['a', 'b', 'c', 'd']);
    expect(stateAt(trace, 1).data.nodes[0]!.children).toEqual([]);
    expect(stateAt(trace, 2).data.roots).toEqual(['d', 'a', 'b', 'c']);
    // Without a slot a root stays where it is.
    expect(stateAt(trace, 3).data.roots).toEqual(['d', 'a', 'b', 'c']);
    expect(stateAt(trace, 4).data.roots).toEqual(['a', 'b', 'c', 'd']);
  });

  it('refuse a slot past the roots', () => {
    expect(
      errorsOf(
        doc(forest, [
          [
            {
              type: 'addNode',
              node: { id: 'x', value: 1 },
              parent: null,
              slot: 4,
            },
          ],
        ]),
      ),
    ).toEqual([{ code: 'OUT_OF_RANGE', path: '$.steps[0].actions[0].slot' }]);
    // A root moving among three roots has slots 0 to 2.
    expect(
      errorsOf(doc(forest, [[{ type: 'detach', node: 'a', slot: 3 }]])),
    ).toEqual([{ code: 'OUT_OF_RANGE', path: '$.steps[0].actions[0].slot' }]);
    expect(
      errorsOf(doc(forest, [[{ type: 'detach', node: 'b', slot: 4 }]])),
    ).toEqual([{ code: 'OUT_OF_RANGE', path: '$.steps[0].actions[0].slot' }]);
  });
});

describe('NIL pointers (S2)', () => {
  const nil = (parent: string, slot: number | string) => ({
    type: 'pointer',
    name: 'x',
    node: { parent, slot },
  });

  it('point at an empty slot, and go when it fills or its parent goes', () => {
    const trace = mustLoad(
      doc(bst, [
        [nil('n10', 'left')],
        [{ type: 'setValue', node: 'n10', value: 11 }],
        [
          {
            type: 'addNode',
            node: { id: 'n9', value: 9 },
            parent: 'n10',
            slot: 'left',
          },
        ],
        [nil('n1', 0), { ...nil('n6', 1), name: 'y' }],
        [{ type: 'removeNode', node: 'n3' }],
      ]),
    );
    expect(stateAt(trace, 1).marks.pointers).toEqual({
      x: { parent: 'n10', slot: 0 },
    });
    expect(stateAt(trace, 2).marks.pointers).toEqual({
      x: { parent: 'n10', slot: 0 },
    });
    expect(stateAt(trace, 3).marks.pointers).toEqual({});
    expect(stateAt(trace, 4).marks.pointers).toEqual({
      x: { parent: 'n1', slot: 0 },
      y: { parent: 'n6', slot: 1 },
    });
    expect(stateAt(trace, 5).marks.pointers).toEqual({});
  });

  it('go when a rotation fills their slot, and stay otherwise', () => {
    const trace = mustLoad(
      doc(bst, [
        [nil('n10', 0), { ...nil('n14', 1), name: 'y' }],
        [{ type: 'rotate', node: 'n10', direction: 'left' }],
      ]),
    );
    // n14 rises; n10 becomes its left child and keeps an empty left slot.
    expect(stateAt(trace, 2).marks.pointers).toEqual({
      x: { parent: 'n10', slot: 0 },
      y: { parent: 'n14', slot: 1 },
    });
    const rotated = mustLoad(
      doc(bst, [
        [{ ...nil('n14', 0), name: 'z' }],
        [{ type: 'rotate', node: 'n10', direction: 'left' }],
      ]),
    );
    expect(stateAt(rotated, 2).marks.pointers).toEqual({});
  });

  it('need a binary tree, an existing parent and an empty slot', () => {
    expect(errorsOf(doc(forest, [[nil('a', 1)]]))).toEqual([
      { code: 'INVALID_OPERATION', path: '$.steps[0].actions[0].node' },
    ]);
    expect(errorsOf(doc(bst, [[nil('n3', 'left')]]))).toEqual([
      { code: 'INVALID_OPERATION', path: '$.steps[0].actions[0].node.slot' },
    ]);
    expect(errorsOf(doc(bst, [[nil('n99', 0)]]))).toEqual([
      { code: 'NOT_FOUND', path: '$.steps[0].actions[0].node.parent' },
    ]);
    expect(errorsOf(doc(bst, [[nil('n1', 2)]]))).toEqual([
      { code: 'INVALID_OPERATION', path: '$.steps[0].actions[0].node.slot' },
    ]);
  });
});

describe('named notes (S3)', () => {
  it('keep one note per field, in the order first set', () => {
    const note = (text: string | null, field?: string) => ({
      type: 'annotate',
      node: 'n3',
      text,
      ...(field === undefined ? {} : { field }),
    });
    const trace = mustLoad(
      doc(bst, [
        [note('s=3', 'size'), note('max=6', 'max'), note('h=2')],
        [note('s=4', 'size')],
        [note(null, 'size'), note(null)],
        [note('s=1', 'size')],
        [{ type: 'removeNode', node: 'n3' }],
      ]),
    );
    const marks = (frame: number) => {
      const { notes, namedNotes } = stateAt(trace, frame).marks;
      return { notes, namedNotes };
    };
    expect(marks(1)).toEqual({
      notes: { n3: 'h=2' },
      namedNotes: { n3: { size: 's=3', max: 'max=6' } },
    });
    expect(Object.keys(marks(2).namedNotes['n3']!)).toEqual(['size', 'max']);
    expect(marks(3)).toEqual({
      notes: {},
      namedNotes: { n3: { max: 'max=6' } },
    });
    expect(Object.keys(marks(4).namedNotes['n3']!)).toEqual(['max', 'size']);
    expect(marks(5)).toEqual({ notes: {}, namedNotes: {} });
  });

  it('hold at most four fields per node', () => {
    const note = (field: string, text: string | null = field) => ({
      type: 'annotate',
      node: 'n3',
      text,
      field,
    });
    const four = ['a', 'b', 'c', 'd'].map((f) => note(f));
    expect(errorsOf(doc(bst, [four, [note('e')]]))).toEqual([
      { code: 'LIMIT_EXCEEDED', path: '$.steps[1].actions[0].field' },
    ]);
    // Changing a field, or removing one first, is fine.
    expect(
      errorsOf(doc(bst, [four, [note('a', 'x'), note('b', null), note('e')]])),
    ).toEqual([]);
  });
});

describe('edge marks and labels (S4)', () => {
  it('stay on an edge, and go when its lower end moves', () => {
    const trace = mustLoad(
      doc(bst, [
        [
          { type: 'markEdge', node: 'n3', mark: 'selected' },
          { type: 'labelEdge', node: 'n3', label: '0' },
          { type: 'labelEdge', node: 'n10', label: 1 },
          { type: 'markEdge', node: 'n6', mark: 'rejected' },
          { type: 'labelEdge', node: 'n14', label: 'r' },
        ],
        [{ type: 'setValue', node: 'n8', value: 7 }],
        // n10 rises: the edges to n10 (now under nothing) and n14 change.
        [{ type: 'rotate', node: 'n8', direction: 'left' }],
        [{ type: 'markEdge', node: 'n6', mark: null }],
      ]),
    );
    const marks = (frame: number) => {
      const { edgeMarks, edgeLabels } = stateAt(trace, frame).marks;
      return { edgeMarks, edgeLabels };
    };
    expect(marks(1)).toEqual({
      edgeMarks: { n3: 'selected', n6: 'rejected' },
      edgeLabels: { n3: '0', n10: 1, n14: 'r' },
    });
    expect(marks(2)).toEqual(marks(1));
    // After the rotation: n10 is the root, n8 its left child, n14 still its
    // right child; n3 still n8's left child.
    expect(marks(3)).toEqual({
      edgeMarks: { n3: 'selected', n6: 'rejected' },
      edgeLabels: { n3: '0', n14: 'r' },
    });
    expect(marks(4).edgeMarks).toEqual({ n3: 'selected' });
  });

  it('go when the lower end is cut off, moved or removed', () => {
    const trace = mustLoad(
      doc(forest, [
        [
          { type: 'markEdge', node: 'b', mark: 'selected' },
          { type: 'labelEdge', node: 'b', label: 'x' },
        ],
        // A new first sibling does not change b's edge.
        [
          {
            type: 'addNode',
            node: { id: 'e', value: 'e' },
            parent: 'a',
            slot: 0,
          },
        ],
        [{ type: 'setChild', parent: 'c', child: 'b' }],
      ]),
    );
    expect(stateAt(trace, 2).marks.edgeMarks).toEqual({ b: 'selected' });
    expect(stateAt(trace, 3).marks.edgeMarks).toEqual({});
    expect(stateAt(trace, 3).marks.edgeLabels).toEqual({});
  });

  it('refuse a root, which has no edge above it', () => {
    expect(
      errorsOf(
        doc(bst, [[{ type: 'markEdge', node: 'n8', mark: 'selected' }]]),
      ),
    ).toEqual([
      { code: 'INVALID_OPERATION', path: '$.steps[0].actions[0].node' },
    ]);
    expect(
      errorsOf(doc(bst, [[{ type: 'labelEdge', node: 'n8', label: '0' }]])),
    ).toEqual([
      { code: 'INVALID_OPERATION', path: '$.steps[0].actions[0].node' },
    ]);
  });
});

/** Scenes of every frame of a document. */
function scenes(input: unknown): Scene[] {
  const trace = mustLoad(input);
  const layout = layoutTrace(trace);
  return Array.from({ length: trace.length + 1 }, (_, k) => layout.sceneAt(k));
}

/** Whether a node's note keeps clear of a straight or routed edge. */
function noteClearOf(n: SceneNode, e: SceneEdge): boolean {
  const size = Math.max(10, n.fontSize * 0.7);
  const box = noteBox(
    {
      x: n.x,
      y: n.y,
      radius: n.radius,
      halfWidth: n.width ? n.width / 2 : n.radius,
    },
    n.labelAngle ?? 0,
    (textWidth(n.label!, defaultFonts.value) * size) / 2,
    size,
  );
  const points = [{ x: e.x1, y: e.y1 }, ...(e.via ?? []), { x: e.x2, y: e.y2 }];
  return points.slice(1).every((q, k) => {
    const p = points[k]!;
    // Sample the segment; a crossing comes within the box.
    for (let t = 0; t <= 1; t += 1 / 64) {
      const x = p.x + (q.x - p.x) * t;
      const y = p.y + (q.y - p.y) * t;
      if (
        Math.abs(x - box.x) < box.halfWidth &&
        Math.abs(y - box.y) < box.halfHeight
      )
        return false;
    }
    return true;
  });
}

const item = <T extends Scene['items'][number]>(
  scene: Scene,
  key: string,
): T => {
  const found = scene.items.find((i) => i.key === key);
  if (found === undefined) throw new Error(`No item ${key}`);
  return found as T;
};

const nodesOf = (scene: Scene) =>
  Object.fromEntries(
    scene.items
      .filter((i): i is SceneNode => i.type === 'node')
      .map((n) => [n.key, [n.x, n.y]]),
  );

const clean = (scene: Scene) => [
  ...sceneProblems(scene),
  ...fitProblems(scene),
  ...overlapProblems(scene),
];

describe('layout of the additions', () => {
  it('draws a NIL box beside its parent, and nodes never move for it', () => {
    const frames = scenes(
      doc(bst, [
        [{ type: 'pointer', name: 'x', node: 'n1' }],
        [{ type: 'pointer', name: 'x', node: { parent: 'n1', slot: 'left' } }],
        [
          {
            type: 'pointer',
            name: 'x',
            node: { parent: 'n14', slot: 'right' },
          },
        ],
        [{ type: 'pointer', name: 'x', node: { parent: 'n10', slot: 'left' } }],
        [{ type: 'pointer', name: 'x', node: 'n8' }],
      ]),
    );
    for (const scene of frames) expect(clean(scene)).toEqual([]);
    for (const scene of frames)
      expect(nodesOf(scene)).toEqual(nodesOf(frames[0]!));
    const n1 = item<SceneNode>(frames[2]!, 't/element/n1');
    const box = item<SceneBox>(frames[2]!, 't/nil/n1/0');
    expect(box.text).toBe('NIL');
    // Left of n1 and a level below it.
    expect(box.x + box.width / 2).toBeLessThan(n1.x);
    expect(box.y).toBeGreaterThan(n1.y + n1.radius);
    const n14 = item<SceneNode>(frames[3]!, 't/element/n14');
    const right = item<SceneBox>(frames[3]!, 't/nil/n14/1');
    expect(right.x + right.width / 2).toBeGreaterThan(n14.x);
    // The badge sits left of the box.
    const badge = item<SceneBadge>(frames[2]!, 't/pointer/x');
    expect(badge.x + badge.width / 2).toBeLessThan(box.x);
    expect(item<SceneEdge>(frames[2]!, 't/nil-edge/n1/0').role).toBe('link');
    expect(frames[1]!.items.some((i) => i.key.startsWith('t/nil'))).toBe(false);
  });

  it('keeps a NIL leaf’s badges clear of the node beside it', () => {
    // RB-DELETE-FIXUP's shape: x at NIL right of p, its sibling w left.
    const [, scene] = scenes(
      doc(
        {
          binary: true,
          nodes: [
            { id: 'p', value: 5, children: ['w', null] },
            { id: 'w', value: 3 },
          ],
        },
        [
          [
            { type: 'pointer', name: 'cursor', node: { parent: 'p', slot: 1 } },
            { type: 'pointer', name: 'other', node: { parent: 'p', slot: 1 } },
          ],
        ],
      ),
    );
    const w = item<SceneNode>(scene!, 't/element/w');
    for (const key of ['t/pointer/cursor', 't/pointer/other']) {
      const badge = item<SceneBadge>(scene!, key);
      expect(badge.x - badge.width / 2, key).toBeGreaterThan(w.x + w.radius);
    }
    expect(clean(scene!)).toEqual([]);
  });

  it('keys the closing link apart from a root named wrap', () => {
    const frames = scenes(
      doc(
        {
          rootList: 'circular',
          nodes: [
            { id: 'wrap', value: 1 },
            { id: 'b', value: 2 },
          ],
        },
        [],
      ),
    );
    expect(clean(frames[0]!)).toEqual([]);
    expect(item<SceneEdge>(frames[0]!, 't/root-link/wrap').x2).toBeLessThan(
      item<SceneNode>(frames[0]!, 't/element/b').x,
    );
  });

  it('joins named notes into one label, the plain note first', () => {
    const [, scene] = scenes(
      doc(bst, [
        [
          { type: 'annotate', node: 'n3', text: 's=3', field: 'size' },
          { type: 'annotate', node: 'n3', text: 'h=2' },
          { type: 'annotate', node: 'n3', text: 'max=6', field: 'max' },
        ],
      ]),
    );
    expect(item<SceneNode>(scene!, 't/element/n3').label).toBe(
      'h=2 · s=3 · max=6',
    );
    expect(clean(scene!)).toEqual([]);
  });

  it('draws marked and labelled edges, labels on the outer side', () => {
    const [, scene] = scenes(
      doc(bst, [
        [
          { type: 'markEdge', node: 'n3', mark: 'selected' },
          { type: 'markEdge', node: 'n10', mark: 'rejected' },
          { type: 'labelEdge', node: 'n3', label: '0' },
          { type: 'labelEdge', node: 'n10', label: '1' },
        ],
      ]),
    );
    const left = item<SceneEdge>(scene!, 't/edge/n3');
    const right = item<SceneEdge>(scene!, 't/edge/n10');
    expect([left.role, left.label, left.labelSide]).toEqual([
      'selected',
      '0',
      'right',
    ]);
    expect([right.role, right.label, right.labelSide]).toEqual([
      'rejected',
      '1',
      'left',
    ]);
    expect(item<SceneEdge>(scene!, 't/edge/n1').role).toBe('link');
    expect(clean(scene!)).toEqual([]);
  });

  it('links the roots of a root list, and lifts pointers at roots', () => {
    const decl = { ...forest, rootList: 'circular' };
    const frames = scenes(
      doc(decl, [
        [
          { type: 'pointer', name: 'min', node: 'c' },
          { type: 'pointer', name: 'x', node: 'b' },
          { type: 'annotate', node: 'c', text: 'd=0', field: 'deg' },
        ],
      ]),
    );
    for (const scene of frames) expect(clean(scene)).toEqual([]);
    const scene = frames[1]!;
    const [a, c, d] = ['a', 'c', 'd'].map((id) =>
      item<SceneNode>(scene, `t/element/${id}`),
    );
    const ac = item<SceneEdge>(scene, 't/root-link/a');
    expect(ac.y1).toBeCloseTo(a!.y);
    expect(ac.y2).toBeCloseTo(c!.y);
    expect(ac.x1).toBeGreaterThan(a!.x);
    expect(ac.x2).toBeLessThan(c!.x);
    expect(item<SceneEdge>(scene, 't/root-link/c').x2).toBeLessThan(d!.x);
    const wrap = item<SceneEdge>(scene, 't/root-wrap');
    expect(wrap.x1).toBeGreaterThan(d!.x);
    expect(wrap.x2).toBeLessThan(a!.x);
    expect(Math.min(...wrap.via!.map((p) => p.y))).toBeLessThan(
      c!.y - c!.radius,
    );
    // `min` is above c; `x`, at a child, stays on the left.
    const min = item<SceneBadge>(scene, 't/pointer/min');
    expect(min.x).toBeCloseTo(c!.x);
    expect(min.y).toBeLessThan(c!.y - c!.radius);
    const b = item<SceneNode>(scene, 't/element/b');
    const x = item<SceneBadge>(scene, 't/pointer/x');
    expect(x.x).toBeLessThan(b.x - b.radius);
    expect(x.y).toBeCloseTo(b.y);
    // The frame without pointers keeps the same nodes.
    expect(nodesOf(frames[0]!)).toEqual(nodesOf(scene));
  });

  it('keeps a root’s notes off the pointer above it', () => {
    // Links on both sides and a child below leave no clear place.
    const frames = scenes(
      doc(
        {
          rootList: 'circular',
          nodes: [
            { id: 'a', value: 7 },
            { id: 'b', value: 17, children: ['c'] },
            { id: 'c', value: 30 },
            { id: 'd', value: 24 },
          ],
        },
        [
          [
            { type: 'pointer', name: 'min', node: 'b' },
            { type: 'annotate', node: 'b', field: 'mark', text: 'marked' },
            { type: 'annotate', node: 'b', field: 'deg', text: 'd=1' },
          ],
        ],
      ),
    );
    const scene = frames[1]!;
    const b = item<SceneNode>(scene, 't/element/b');
    const min = item<SceneBadge>(scene, 't/pointer/min');
    const note = noteBox(
      { x: b.x, y: b.y, radius: b.radius, halfWidth: b.radius },
      b.labelAngle ?? 0,
      (textWidth(b.label!, defaultFonts.value) *
        Math.max(10, b.fontSize * 0.7)) /
        2,
      Math.max(10, b.fontSize * 0.7),
    );
    const apart =
      Math.abs(note.x - min.x) >= note.halfWidth + min.width / 2 ||
      Math.abs(note.y - min.y) >= note.halfHeight + min.height / 2;
    expect(apart).toBe(true);
  });

  it('keeps a short note clear of its parent edge, though another note is long', () => {
    // b hangs left of a, so its parent edge comes from the upper right;
    // d's long note must not make b's note find no place.
    const frames = scenes(
      doc(
        {
          nodes: [
            { id: 'a', value: 24, children: ['b', 'c'] },
            { id: 'b', value: 26 },
            { id: 'c', value: 46 },
            { id: 'd', value: 7 },
          ],
        },
        [
          [
            { type: 'annotate', node: 'b', field: 'mark', text: 'marked' },
            { type: 'annotate', node: 'd', field: 'mark', text: 'marked' },
            { type: 'annotate', node: 'd', field: 'deg', text: 'd=12' },
          ],
        ],
      ),
    );
    const scene = frames[1]!;
    const b = item<SceneNode>(scene, 't/element/b');
    const edge = item<SceneEdge>(scene, 't/edge/b');
    expect(noteClearOf(b, edge)).toBe(true);
  });

  it('puts a root’s note off the root list', () => {
    const frames = scenes(
      doc(
        {
          // c has a child, so the place below it is taken too.
          nodes: [
            { id: 'a', value: 'a', children: ['b'] },
            { id: 'b', value: 'b' },
            { id: 'c', value: 'c', children: ['e'] },
            { id: 'e', value: 'e' },
            { id: 'd', value: 'd' },
          ],
          rootList: 'circular',
        },
        [
          [
            { type: 'pointer', name: 'min', node: 'c' },
            { type: 'annotate', node: 'c', field: 'deg', text: 'd=1' },
          ],
        ],
      ),
    );
    const scene = frames[1]!;
    const c = item<SceneNode>(scene, 't/element/c');
    for (const link of scene.items.filter(
      (i): i is SceneEdge => i.type === 'edge' && i.key.includes('root-'),
    ))
      expect(noteClearOf(c, link), link.key).toBe(true);
  });

  it('draws a plain list without the wrap link', () => {
    const [scene] = scenes(doc({ ...forest, rootList: 'list' }, []));
    expect(scene!.items.some((i) => i.key === 't/root-wrap')).toBe(false);
    expect(
      scene!.items.filter((i) => i.key.startsWith('t/root-link/')),
    ).toHaveLength(2);
    expect(clean(scene!)).toEqual([]);
  });
});
