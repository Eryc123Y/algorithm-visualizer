/**
 * The `btree` kind (ADR 0035) in the engine: each action against states
 * worked out by hand, the errors, marks following keys and nodes, and the
 * drawing: a key keeps its cell through every move, and child edges hang
 * from the gaps between keys.
 */
import { describe, expect, it } from 'vitest';

import {
  layoutTrace,
  loadTrace,
  type BTreeState,
  type Scene,
  type SceneBox,
  type SceneEdge,
  type Trace,
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

const doc = (nodes: unknown[], steps: Action[][]) => ({
  version: '1.0',
  structures: { T: { kind: 'btree', nodes } },
  steps: steps.map((actions) => ({
    actions: actions.map((a) => ({ target: 'T', ...a })),
  })),
});

const stateAt = (trace: Trace, frame?: number) =>
  trace.frame(frame ?? trace.length).state['T']!.state as BTreeState;

/** A state as `node: keys | children`, keys by value, nodes in order. */
const shape = (s: BTreeState) => {
  const byId = new Map(s.data.nodes.map((n) => [n.id, n]));
  const show = (id: string): string => {
    const n = byId.get(id)!;
    const keys = n.keys.map((k) => String(k.value)).join(' ');
    return n.children.length === 0
      ? `[${keys}]`
      : `[${keys}](${n.children.map(show).join(' ')})`;
  };
  return show(s.data.root);
};

/** G with children A C E and H K: a B-tree with t = 2. */
const tree = [
  { id: 'r', keys: [{ id: 'g', value: 'G' }], children: ['a', 'b'] },
  {
    id: 'a',
    keys: [
      { id: 'ka', value: 'A' },
      { id: 'kc', value: 'C' },
      { id: 'ke', value: 'E' },
    ],
  },
  {
    id: 'b',
    keys: [
      { id: 'kh', value: 'H' },
      { id: 'kk', value: 'K' },
    ],
  },
];

describe('btree reducer', () => {
  it('splits around the middle key and grows a new root', () => {
    const trace = mustLoad(
      doc(tree, [
        [{ type: 'split', node: 'r', index: 0, newNode: 'a2' }],
        [
          {
            type: 'insertKey',
            node: 'a',
            index: 1,
            key: { id: 'kb', value: 'B' },
          },
        ],
        [{ type: 'grow', newRoot: 's' }],
      ]),
    );
    expect(shape(stateAt(trace, 1))).toBe('[C G]([A] [E] [H K])');
    expect(shape(stateAt(trace, 2))).toBe('[C G]([A B] [E] [H K])');
    expect(shape(stateAt(trace, 3))).toBe('[](' + '[C G]([A B] [E] [H K]))');
    // The middle key keeps its id as it rises.
    expect(
      stateAt(trace, 1)
        .data.nodes.find((n) => n.id === 'r')!
        .keys.map((k) => k.id),
    ).toEqual(['kc', 'g']);
  });

  it('merges, borrows, lifts and shrinks', () => {
    const trace = mustLoad(
      doc(tree, [
        [{ type: 'borrow', node: 'r', child: 1, from: 'left' }],
        [{ type: 'borrow', node: 'r', child: 0, from: 'right' }],
        [{ type: 'merge', node: 'r', index: 0 }],
        [{ type: 'shrink' }],
      ]),
    );
    expect(shape(stateAt(trace, 1))).toBe('[E]([A C] [G H K])');
    expect(shape(stateAt(trace, 2))).toBe('[G]([A C E] [H K])');
    expect(shape(stateAt(trace, 3))).toBe('[]([A C E G H K])');
    expect(shape(stateAt(trace, 4))).toBe('[A C E G H K]');
    const lifted = mustLoad(
      doc(tree, [[{ type: 'lift', key: 'ke', over: 'g' }]]),
    );
    expect(shape(stateAt(lifted))).toBe('[E]([A C] [H K])');
  });

  it('moves children with a borrow and a merge of inner nodes', () => {
    const inner = [
      { id: 'r', keys: [{ id: 'm', value: 'M' }], children: ['x', 'y'] },
      {
        id: 'x',
        keys: [
          { id: 'd', value: 'D' },
          { id: 'h', value: 'H' },
        ],
        children: ['p', 'q', 'u'],
      },
      { id: 'y', keys: [{ id: 't', value: 'T' }], children: ['v', 'w'] },
      { id: 'p', keys: [{ id: 'a', value: 'A' }] },
      { id: 'q', keys: [{ id: 'f', value: 'F' }] },
      { id: 'u', keys: [{ id: 'j', value: 'J' }] },
      { id: 'v', keys: [{ id: 'p1', value: 'P' }] },
      { id: 'w', keys: [{ id: 'x1', value: 'X' }] },
    ];
    const trace = mustLoad(
      doc(inner, [
        [{ type: 'borrow', node: 'r', child: 1, from: 'left' }],
        [{ type: 'merge', node: 'r', index: 0 }],
      ]),
    );
    expect(shape(stateAt(trace, 1))).toBe(
      '[H]([D]([A] [F]) [M T]([J] [P] [X]))',
    );
    expect(shape(stateAt(trace, 2))).toBe('[]([D H M T]([A] [F] [J] [P] [X]))');
  });

  it('hands a removed node’s pointer and note to the node that stays', () => {
    const trace = mustLoad(
      doc(tree, [
        [
          { type: 'pointer', name: 'x', node: 'b' },
          { type: 'annotate', node: 'b', text: 'right' },
          { type: 'settle', key: 'kh' },
        ],
        [{ type: 'merge', node: 'r', index: 0 }],
        [{ type: 'shrink' }],
      ]),
    );
    expect(stateAt(trace, 2).marks.pointers).toEqual({ x: 'a' });
    expect(stateAt(trace, 2).marks.notes).toEqual({ a: 'right' });
    expect(stateAt(trace, 2).marks.settled).toEqual(['kh']);
    expect(stateAt(trace, 3).data.root).toBe('a');
  });

  it('refuses what would break the shape', () => {
    const one = (action: Action) => errorsOf(doc(tree, [[action]]));
    const at = (field: string) => `$.steps[0].actions[0]${field}`;
    expect(one({ type: 'insertKey', node: 'r', index: 0, key: 1 })).toEqual([
      { code: 'INVALID_OPERATION', path: at('.node') },
    ]);
    expect(one({ type: 'insertKey', node: 'b', index: 3, key: 1 })).toEqual([
      { code: 'OUT_OF_RANGE', path: at('.index') },
    ]);
    expect(one({ type: 'removeKey', key: 'g' })).toEqual([
      { code: 'INVALID_OPERATION', path: at('.key') },
    ]);
    expect(one({ type: 'split', node: 'r', index: 1, newNode: 'z' })).toEqual([
      { code: 'INVALID_OPERATION', path: at('.index') },
    ]);
    expect(one({ type: 'merge', node: 'r', index: 1 })).toEqual([
      { code: 'OUT_OF_RANGE', path: at('.index') },
    ]);
    expect(one({ type: 'shrink' })).toEqual([
      { code: 'INVALID_OPERATION', path: '$.steps[0].actions[0]' },
    ]);
    expect(one({ type: 'borrow', node: 'r', child: 1, from: 'right' })).toEqual(
      [{ code: 'INVALID_OPERATION', path: at('.from') }],
    );
    expect(one({ type: 'lift', key: 'g', over: 'ke' })).toEqual([
      { code: 'INVALID_OPERATION', path: at('.key') },
    ]);
    expect(one({ type: 'lift', key: 'ka', over: 'kh' })).toEqual([
      { code: 'INVALID_OPERATION', path: at('.over') },
    ]);
    // A leaf and an inner node cannot merge.
    const uneven = [
      { id: 'r', keys: [{ id: 'k', value: 5 }], children: ['l', 'n'] },
      { id: 'l', keys: [{ id: 'k1', value: 1 }] },
      { id: 'n', keys: [{ id: 'k8', value: 8 }], children: ['c1', 'c2'] },
      { id: 'c1', keys: [{ id: 'k7', value: 7 }] },
      { id: 'c2', keys: [{ id: 'k9', value: 9 }] },
    ];
    expect(
      errorsOf(doc(uneven, [[{ type: 'merge', node: 'r', index: 0 }]])),
    ).toEqual([{ code: 'INVALID_OPERATION', path: at('.index') }]);
    // A new key may not take an id in use.
    expect(
      one({
        type: 'insertKey',
        node: 'b',
        index: 0,
        key: { id: 'g', value: 1 },
      }),
    ).toEqual([{ code: 'DUPLICATE_ID', path: at('.key.id') }]);
  });

  it('refuses a 33rd key in a node, however it would come', () => {
    const keys = (from: number, n: number, prefix: string) =>
      Array.from({ length: n }, (_, k) => ({
        id: `${prefix}${k}`,
        value: from + k,
      }));
    // A leaf of 32 keys next to a leaf of one.
    const full = [
      { id: 'r', keys: [{ id: 'm', value: 50 }], children: ['l', 's'] },
      { id: 'l', keys: keys(0, 32, 'l') },
      { id: 's', keys: [{ id: 's0', value: 60 }] },
    ];
    const one = (action: Action) => errorsOf(doc(full, [[action]]));
    const at = (field: string) => `$.steps[0].actions[0]${field}`;
    expect(one({ type: 'insertKey', node: 'l', index: 0, key: -1 })).toEqual([
      { code: 'LIMIT_EXCEEDED', path: at('.node') },
    ]);
    expect(one({ type: 'merge', node: 'r', index: 0 })).toEqual([
      { code: 'LIMIT_EXCEEDED', path: at('.index') },
    ]);
    expect(one({ type: 'borrow', node: 'r', child: 0, from: 'right' })).toEqual(
      [{ code: 'LIMIT_EXCEEDED', path: at('.child') }],
    );
    // A parent of 32 keys cannot take the middle key of a split child.
    const wide = [
      {
        id: 'r',
        keys: keys(10, 32, 'r').map((k, i) => ({ ...k, value: 10 * (i + 1) })),
        children: Array.from({ length: 33 }, (_, c) => `c${c}`),
      },
      { id: 'c0', keys: keys(1, 3, 'x') },
      ...Array.from({ length: 32 }, (_, c) => ({
        id: `c${c + 1}`,
        keys: [{ id: `y${c}`, value: 10 * (c + 1) + 5 }],
      })),
    ];
    expect(
      errorsOf(
        doc(wide, [[{ type: 'split', node: 'r', index: 0, newNode: 'z' }]]),
      ),
    ).toEqual([{ code: 'LIMIT_EXCEEDED', path: at('.node') }]);
  });
});

function scenes(input: unknown): Scene[] {
  const trace = mustLoad(input);
  const layout = layoutTrace(trace);
  return Array.from({ length: trace.length + 1 }, (_, k) => layout.sceneAt(k));
}

const box = (scene: Scene, key: string) =>
  scene.items.find((i) => i.key === key) as SceneBox;

describe('btree layout', () => {
  it('keeps each key’s cell through a split, and hangs edges from gaps', () => {
    const frames = scenes(
      doc(tree, [
        [{ type: 'split', node: 'r', index: 0, newNode: 'a2' }],
        [{ type: 'borrow', node: 'r', child: 2, from: 'left' }],
      ]),
    );
    for (const scene of frames)
      expect([
        ...sceneProblems(scene),
        ...fitProblems(scene),
        ...overlapProblems(scene),
      ]).toEqual([]);
    const [before, after] = [frames[0]!, frames[1]!];
    // C rose: same scene key, now on the root's row.
    expect(box(after, 'T/key/kc').y).toBe(box(before, 'T/key/g').y);
    // The edge to b starts at the root's right end, below its last key.
    const g = box(after, 'T/key/g');
    const edge = after.items.find((i) => i.key === 'T/edge/b') as SceneEdge;
    expect(edge.x1).toBeCloseTo(g.x + g.width);
    expect(edge.y1).toBeCloseTo(g.y + g.height);
    expect(
      frames.every(
        (f) => f.width === before.width && f.height === before.height,
      ),
    ).toBe(true);
  });

  it('draws an empty root as one empty cell', () => {
    const [scene] = scenes({
      version: '1.0',
      structures: { T: { kind: 'btree' } },
      steps: [],
    });
    expect(box(scene!, 'T/empty/root').text).toBe('');
  });
});
