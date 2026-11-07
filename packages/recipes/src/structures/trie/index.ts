/**
 * A trie of words (ADR 0023): `trie.insert` follows a word from the root,
 * adds the children it lacks in alphabetical order, and marks the node
 * that ends it; `trie.search` follows a word and reports whether its last
 * node is marked. A trie starts from words; `after` lists its words in
 * alphabetical order, since the shape does not depend on their order.
 * Nodes that end a word are settled.
 */
import type { TreeNode } from '@algoviz/spec';
import { z } from 'zod';

import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import {
  afterFirstStep,
  silentHandle,
  silentTrace,
  type Trace,
} from '../../trace.ts';

/** Most words a trie holds, so it fits on one screen. */
export const MAX_WORDS = 8;
/** Most characters of a word. */
export const MAX_WORD_LENGTH = 16;

interface TrieNode {
  readonly ch: string;
  /** Children by character, in alphabetical order. */
  readonly children: readonly (readonly [string, string])[];
  readonly word: boolean;
}

export interface TrieState {
  readonly nodes: ReadonlyMap<string, TrieNode>;
  /** Number for the next node id. */
  readonly next: number;
}

type On = Handle<'tree'>;

const ROOT = 'root';
const EMPTY: TrieState = {
  nodes: new Map([[ROOT, { ch: '', children: [], word: false }]]),
  next: 0,
};

const nodeOf = (s: TrieState, id: string) => s.nodes.get(id)!;
const withNode = (s: TrieState, id: string, n: TrieNode): TrieState => ({
  ...s,
  nodes: new Map(s.nodes).set(id, n),
});
const childOf = (n: TrieNode, ch: string) =>
  n.children.find(([c]) => c === ch)?.[1];

/** Ids in preorder, children in alphabetical order. */
function preorder(s: TrieState, id: string): string[] {
  return [id, ...nodeOf(s, id).children.flatMap(([, c]) => preorder(s, c))];
}

/** The words of the trie, in alphabetical order. */
function wordsOf(s: TrieState, id = ROOT, prefix = ''): string[] {
  const n = nodeOf(s, id);
  const word = prefix + n.ch;
  return [
    ...(n.word ? [word] : []),
    ...n.children.flatMap(([, c]) => wordsOf(s, c, word)),
  ];
}

const contains = (s: TrieState, word: string): boolean => {
  let at: string | undefined = ROOT;
  for (const ch of word) {
    at = childOf(nodeOf(s, at), ch);
    if (at === undefined) return false;
  }
  return nodeOf(s, at).word;
};

/** Settles every node that ends a word, which a declaration cannot show. */
const marked = (s: TrieState, trace: Trace, on: On) =>
  afterFirstStep(trace, () => {
    for (const [id, n] of s.nodes) if (n.word) on.settle({ node: id });
  });

const INSERT = listing('insert', {
  pseudocode: `
    TRIE-INSERT(root, word)
        x = root  // @start
        for each character c of word
            if x.child[c] == NIL
                x.child[c] = NEW-NODE(c)  // @add
            x = x.child[c]  // @follow
        x.word = TRUE  // @mark
  `,
  python: `
    def insert(root, word):
        x = root  # @start
        for c in word:
            if c not in x.children:
                x.children[c] = Node()  # @add
            x = x.children[c]  # @follow
        x.is_word = True  # @mark
  `,
});

function insert(
  s: TrieState,
  word: string,
  trace: Trace,
  on: On,
): Applied<TrieState> {
  if (!contains(s, word) && wordsOf(s).length >= MAX_WORDS)
    throw new RangeError(
      `The trie is full: it holds at most ${MAX_WORDS} words`,
    );
  const t = marked(s, trace, on);
  t.step('start', `Insert "${word}": start at the root.`);
  on.pointer({ name: 'x', node: ROOT });
  let state = s;
  let at = ROOT;
  for (const ch of word) {
    const n = nodeOf(state, at);
    const child = childOf(n, ch);
    if (child !== undefined) {
      t.step('follow', `Follow the child "${ch}".`);
      on.pointer({ name: 'x', node: child }).highlight({ nodes: [child] });
      at = child;
      continue;
    }
    const id = `t${state.next}`;
    // Keep children in alphabetical order.
    const slot = n.children.filter(([c]) => c < ch).length;
    const children = [
      ...n.children.slice(0, slot),
      [ch, id] as const,
      ...n.children.slice(slot),
    ];
    state = withNode({ ...state, next: state.next + 1 }, at, {
      ...n,
      children,
    });
    state = withNode(state, id, { ch, children: [], word: false });
    t.step('add', `There is no child "${ch}" yet: add it and go down.`);
    on.addNode({ node: { id, value: ch }, parent: at, slot });
    on.pointer({ name: 'x', node: id });
    at = id;
  }
  const end = nodeOf(state, at);
  t.step(
    'mark',
    end.word
      ? `"${word}" was in the trie already: its last node stays marked.`
      : `Mark the last node: it ends the word "${word}".`,
  );
  on.settle({ node: at }).pointer({ name: 'x', node: null });
  return { state: withNode(state, at, { ...end, word: true }), result: null };
}

const SEARCH = listing('search', {
  pseudocode: `
    TRIE-SEARCH(root, word)
        x = root  // @start
        for each character c of word
            if x.child[c] == NIL
                return FALSE  // @missing
            x = x.child[c]  // @follow
        return x.word  // @end
  `,
  python: `
    def search(root, word):
        x = root  # @start
        for c in word:
            if c not in x.children:
                return False  # @missing
            x = x.children[c]  # @follow
        return x.is_word  # @end
  `,
});

function search(
  s: TrieState,
  word: string,
  trace: Trace,
  on: On,
): Applied<TrieState> {
  const t = marked(s, trace, on);
  t.step('start', `Search for "${word}": start at the root.`);
  on.pointer({ name: 'x', node: ROOT });
  let at = ROOT;
  for (const ch of word) {
    const child = childOf(nodeOf(s, at), ch);
    if (child === undefined) {
      t.step(
        'missing',
        `There is no child "${ch}": "${word}" is not in the trie.`,
      );
      on.pointer({ name: 'x', node: null });
      return { state: s, result: false };
    }
    t.step('follow', `Follow the child "${ch}".`);
    on.pointer({ name: 'x', node: child }).highlight({ nodes: [child] });
    at = child;
  }
  const found = nodeOf(s, at).word;
  t.step(
    'end',
    found
      ? `The last node ends a word: "${word}" is in the trie.`
      : `The last node ends no word: "${word}" is only a prefix of words in the trie.`,
  );
  on.highlight({ nodes: [at] });
  return { state: s, result: found };
}

const Word = z
  .string()
  .min(1)
  .max(MAX_WORD_LENGTH)
  .describe(`A word of 1 to ${MAX_WORD_LENGTH} characters.`);

type From = readonly string[];

const op = operationsOf<TrieState, From, 'tree'>();
const sample = ['tea', 'ten', 'to', 'in', 'inn'];

/** A trie of words. */
export const trie = defineStructure<TrieState, From, 'tree'>({
  id: 'trie',
  title: 'Trie',
  topic: 'trees',
  summary:
    'Inserts and searches words one after another in a trie, where each word is a path of characters from the root.',
  name: 'trie',
  kind: 'tree',
  from: z
    .array(Word)
    .max(MAX_WORDS)
    .describe(
      `Up to ${MAX_WORDS} words that build the starting trie, e.g. ["tea", "ten", "to"].`,
    ),
  examples: [
    {
      from: [],
      ops: [
        ...['tea', 'ten', 'to', 'inn', 'in'].map((word) => ({
          op: 'insert',
          word,
        })),
        { op: 'search', word: 'te' },
        { op: 'search', word: 'in' },
      ],
    },
  ],
  start(from) {
    const trace = silentTrace();
    const on = silentHandle('tree');
    return from.reduce((s, word) => insert(s, word, trace, on).state, EMPTY);
  },
  describe: (s) => wordsOf(s),
  declare(s) {
    const nodes = preorder(s, ROOT).map((id): TreeNode => {
      const { ch, children } = nodeOf(s, id);
      return children.length === 0
        ? { id, value: ch }
        : { id, value: ch, children: children.map(([, c]) => c) };
    });
    return { kind: 'tree', nodes, roots: [ROOT] };
  },
  clear(on) {
    on.pointer({ name: 'x', node: null });
  },
  operations: [
    op({
      name: 'insert',
      title: 'insert',
      summary:
        'Inserts a word, adding the children its path lacks and marking the node that ends it.',
      args: { word: Word.describe('The word to insert.') },
      examples: [{ from: sample, word: 'tent' }],
      code: INSERT,
      titleOf: ({ word }) => `insert ${word}`,
      apply: (s, { word }, trace, on) => insert(s, word, trace, on),
    }),
    op({
      name: 'search',
      title: 'search',
      summary:
        'Follows a word from the root and reports whether the node it ends at marks a word.',
      args: { word: Word.describe('The word to look for.') },
      examples: [
        { from: sample, word: 'ten' },
        { from: sample, word: 'te' },
      ],
      code: SEARCH,
      titleOf: ({ word }) => `search ${word}`,
      apply: (s, { word }, trace, on) => search(s, word, trace, on),
    }),
  ],
});
