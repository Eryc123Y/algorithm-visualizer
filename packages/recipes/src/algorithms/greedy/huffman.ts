/**
 * Huffman codes (ADR 0034): the forest is the min-priority queue Q, its
 * roots in queue order, by frequency with ties oldest first. Each round
 * takes the two least trees and joins them under a new node, edges 0 to
 * the left and 1 to the right, which goes back into Q at its place. When
 * one tree is left, each character's codeword is read along its path and
 * written in a table beside the tree.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { NotationError, parseIn, quoted } from '../../notation/error.ts';
import { numberAt } from '../../notation/list.ts';

/** Most characters: a code tree of 31 nodes, which a figure still holds. */
export const MAX_CHARACTERS = 16;

const SYMBOL = /^[^\s:,]{1,8}$/u;

const FREQUENCIES_FORM =
  'characters with their frequencies, separated by spaces or commas, e.g. "a:45 b:13 c:12 d:16 e:9 f:5"';

/** Reads `a:45 b:13 …`, throwing a NotationError at a bad token. */
export function parseFrequencies(text: string): [string, number][] {
  const out: [string, number][] = [];
  for (const match of text.matchAll(/[^\s,]+/g)) {
    const token = match[0];
    const colon = token.lastIndexOf(':');
    if (colon <= 0)
      throw new NotationError(
        `Expected a character and its frequency, such as "a:45", not ${quoted(token)}`,
        match.index,
      );
    out.push([
      token.slice(0, colon),
      numberAt(token.slice(colon + 1), match.index + colon + 1, 'a frequency'),
    ]);
  }
  return out;
}

const Pairs = z
  .array(
    z.tuple([
      z
        .string()
        .regex(
          SYMBOL,
          'A character is 1 to 8 characters, without spaces, colons or commas',
        ),
      z
        .number()
        .positive('A frequency is a positive number')
        .finite('A frequency is a finite number'),
    ]),
  )
  .min(2, 'Give at least two characters: one character needs no code')
  .max(MAX_CHARACTERS)
  .superRefine((pairs, ctx) => {
    const seen = new Set<string>();
    pairs.forEach(([c], k) => {
      if (seen.has(c))
        ctx.addIssue({
          code: 'custom',
          path: [k, 0],
          message: `The character ${JSON.stringify(c)} appears twice; each appears once`,
        });
      seen.add(c);
    });
    if (!Number.isFinite(pairs.reduce((sum, [, f]) => sum + f, 0)))
      ctx.addIssue({
        code: 'custom',
        message: 'The frequencies add up to too large a number',
      });
  });

/** A whole number as JavaScript orders object keys: before the others. */
const INDEX_LIKE = /^(0|[1-9]\d*)$/;

const Frequencies = z
  .union([
    z
      .string()
      .transform((s, ctx) =>
        parseIn(s, ctx, parseFrequencies, `Write ${FREQUENCIES_FORM}.`),
      ),
    z
      .record(z.string(), z.number())
      .superRefine((o, ctx) => {
        // JavaScript puts keys such as "1" first, so their order is lost.
        const index = Object.keys(o).find((k) => INDEX_LIKE.test(k));
        if (index !== undefined)
          ctx.addIssue({
            code: 'custom',
            path: [index],
            message: `An object puts a character such as ${JSON.stringify(index)} first, losing the order that breaks ties; give the frequencies as text or as pairs instead`,
          });
      })
      .transform((o) => Object.entries(o)),
    z.array(z.tuple([z.string(), z.number()])),
  ])
  .pipe(Pairs)
  .describe(
    `The characters and their frequencies, in input order: ${FREQUENCIES_FORM}, an object such as { "a": 45, "b": 13 }, or pairs such as [["a", 45]]. Ties are broken by input order.`,
  );

const Input = z.strictObject({ frequencies: Frequencies });

/** A tree of the queue: its root's id, frequency and age (for ties). */
interface Queued {
  readonly id: string;
  readonly freq: number;
  readonly age: number;
}

/** A node of the code tree. */
interface CodeNode {
  readonly left: string | null;
  readonly right: string | null;
  readonly char?: string;
}

const format = (n: number) => String(n);

export const huffman = defineAlgorithm({
  id: 'huffman',
  title: 'Huffman codes',
  topic: 'greedy',
  summary:
    'Builds an optimal prefix code by joining the two least frequent trees until one is left, then reads each codeword along its path.',
  input: Input,
  main: 'frequencies',
  examples: [
    {
      frequencies: [
        ['a', 45],
        ['b', 13],
        ['c', 12],
        ['d', 16],
        ['e', 9],
        ['f', 5],
      ],
    },
    {
      frequencies: [
        ['x', 1],
        ['y', 1],
        ['z', 2],
      ],
    },
  ],
  code: {
    pseudocode: `
      HUFFMAN(C)  // each character c of C has a frequency c.freq
          Q = a min-priority queue of C, keyed on freq  // ties: oldest first
          while Q holds more than one tree
              x = EXTRACT-MIN(Q); y = EXTRACT-MIN(Q)  // the two least  // @extract
              z = a new node with z.left = x and z.right = y  // @merge
              z.freq = x.freq + y.freq
              INSERT(Q, z)
          return EXTRACT-MIN(Q)  // the root of the code tree  // @done

      CODEWORD(c)  // walk down from the root to c
          a 0 for every step left, a 1 for every step right  // @code
    `,
    python: `
      import heapq

      def huffman(freq):
          # freq maps each character to its frequency, in input order;
          # equal frequencies leave the queue oldest first
          Q = [(f, age, c) for age, (c, f) in enumerate(freq.items())]
          heapq.heapify(Q)
          age = len(Q)
          while len(Q) > 1:
              fx, _, x = heapq.heappop(Q)  # @extract
              fy, _, y = heapq.heappop(Q)
              z = (x, y)  # left child x, right child y  # @merge
              heapq.heappush(Q, (fx + fy, age, z))
              age += 1
          return Q[0][2]  # the root of the code tree  # @done

      def codewords(x, path=''):
          if isinstance(x, str):
              return {x: path}  # @code
          left, right = x
          return codewords(left, path + '0') | codewords(right, path + '1')
    `,
  },
  run({ frequencies }, trace) {
    const n = frequencies.length;
    // The queue in order: by frequency, ties oldest first.
    const before = (a: Queued, b: Queued) => a.freq - b.freq || a.age - b.age;
    let queue: Queued[] = frequencies
      .map(([, freq], k) => ({ id: `c${k}`, freq, age: k }))
      .sort(before);
    const nodes = new Map<string, CodeNode>(
      frequencies.map(([char], k) => [
        `c${k}`,
        { left: null, right: null, char },
      ]),
    );
    const Q = trace.add('Q', {
      kind: 'tree',
      binary: true,
      nodes: queue.map((q) => ({
        id: q.id,
        value: `${frequencies[Number(q.id.slice(1))]![0]}:${format(q.freq)}`,
      })),
      roots: queue.map((q) => q.id),
    });
    const codes = trace.add('codes', {
      kind: 'table',
      place: 'side',
      label: 'codewords',
      rows: n,
      columns: 2,
      initial: frequencies.map(([, freq]) => [freq, null]),
      rowLabels: frequencies.map(([char]) => char),
      columnLabels: ['freq', 'code'],
    });
    const name = (q: Queued) =>
      nodes.get(q.id)!.char === undefined
        ? format(q.freq)
        : `${nodes.get(q.id)!.char}:${format(q.freq)}`;
    for (let k = 0; queue.length > 1; k++) {
      const [x, y] = [queue[0]!, queue[1]!];
      trace.step(
        'extract',
        `Take the two least trees out of Q: ${name(x)} and ${name(y)}.`,
      );
      Q.highlight({ nodes: [x.id, y.id] });
      const rest = queue.slice(2);
      const z: Queued = { id: `z${k}`, freq: x.freq + y.freq, age: n + k };
      const at = rest.filter((q) => before(q, z) < 0).length;
      trace.step(
        'merge',
        `Join them under a new node of frequency ${format(x.freq)} + ${format(y.freq)} = ${format(z.freq)}, 0 to the left and 1 to the right, and put it back into Q${rest.length === 0 ? ', where it is the only tree' : at === rest.length ? ' last' : at === 0 ? ' first' : ` after ${name(rest[at - 1]!)}`}.`,
      );
      // x and y are still the first two roots until they become children.
      Q.addNode({
        node: { id: z.id, value: z.freq },
        parent: null,
        slot: at + 2,
      })
        .setChild({ parent: z.id, child: x.id, slot: 'left' })
        .setChild({ parent: z.id, child: y.id, slot: 'right' })
        .labelEdge({ node: x.id, label: '0' })
        .labelEdge({ node: y.id, label: '1' })
        .highlight({ nodes: [z.id] });
      nodes.set(z.id, { left: x.id, right: y.id });
      queue = [...rest.slice(0, at), z, ...rest.slice(at)];
    }
    const root = queue[0]!;
    trace.step(
      'done',
      `Q holds one tree: the code tree, of total frequency ${format(root.freq)}. Each codeword is the path from the root down to its character.`,
    );
    Q.settle({ node: root.id });
    // Codewords along each path, in input order.
    const paths = new Map<string, [string, string[]]>();
    const walk = (id: string, code: string, path: string[]) => {
      const node = nodes.get(id)!;
      if (node.char !== undefined) paths.set(id, [code, path]);
      if (node.left !== null) walk(node.left, `${code}0`, [...path, node.left]);
      if (node.right !== null)
        walk(node.right, `${code}1`, [...path, node.right]);
    };
    walk(root.id, '', []);
    let shown: string[] = [];
    frequencies.forEach(([char], k) => {
      const [code, path] = paths.get(`c${k}`)!;
      trace.step(
        'code',
        `${char}: ${code
          .split('')
          .map((b) => (b === '0' ? 'left' : 'right'))
          .join(', ')} gives the codeword ${code}.`,
      );
      for (const id of shown) Q.markEdge({ node: id, mark: null });
      for (const id of path) Q.markEdge({ node: id, mark: 'selected' });
      Q.highlight({ nodes: [`c${k}`] });
      codes.set({ cell: [k, 1], value: code }).highlight({ cells: [[k, 1]] });
      shown = path;
    });
  },
});
