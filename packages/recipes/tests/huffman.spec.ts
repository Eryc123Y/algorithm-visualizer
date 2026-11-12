/**
 * Huffman codes (ADR 0034) against independent references: the codewords
 * against a plain implementation with the same order for ties, their
 * cost against the optimal cost (any Huffman tree's, computed by summing
 * merges), and the code against being prefix-free. The figure is checked
 * too: the queue's roots stay in order, and edges carry 0 and 1.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { parseFrequencies } from '../src/algorithms/greedy/huffman.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Pairs = [string, number][];

/** A plain Huffman with ties oldest first: each character's codeword. */
function reference(pairs: Pairs): Map<string, string> {
  type T = { freq: number; age: number; chars: [string, string][] };
  let queue: T[] = pairs.map(([c, f], age) => ({
    freq: f,
    age,
    chars: [[c, '']],
  }));
  const order = (a: T, b: T) => a.freq - b.freq || a.age - b.age;
  let age = pairs.length;
  while (queue.length > 1) {
    queue.sort(order);
    const [x, y, ...rest] = queue;
    queue = [
      ...rest,
      {
        freq: x!.freq + y!.freq,
        age: age++,
        chars: [
          ...x!.chars.map(([c, w]): [string, string] => [c, `0${w}`]),
          ...y!.chars.map(([c, w]): [string, string] => [c, `1${w}`]),
        ],
      },
    ];
  }
  return new Map(queue[0]!.chars);
}

/** The least cost of any prefix code: the sum of every merge's weight. */
function optimalCost(freqs: number[]): number {
  const q = [...freqs];
  let cost = 0;
  while (q.length > 1) {
    q.sort((a, b) => a - b);
    const merged = q.shift()! + q.shift()!;
    cost += merged;
    q.push(merged);
  }
  return cost;
}

const codesOf = (input: object) => {
  const trace = replay(runOk('huffman', input).document);
  const table = stateOf(trace, 'codes', 'table');
  return { trace, codes: table.data.map((row) => row[1] as string) };
};

describe('huffman', () => {
  it('gives CLRS’s code for its six characters', () => {
    const { codes, trace } = codesOf({
      frequencies: 'a:45 b:13 c:12 d:16 e:9 f:5',
    });
    expect(codes).toEqual(['0', '101', '100', '111', '1101', '1100']);
    // Q starts sorted by frequency, as in CLRS's figure.
    const q0 = stateOf(trace, 'Q', 'tree', 0);
    expect(
      q0.data.roots.map((id) => q0.data.nodes.find((n) => n.id === id)!.value),
    ).toEqual(['f:5', 'e:9', 'c:12', 'b:13', 'd:16', 'a:45']);
  });

  it('labels edges 0 and 1 and ends with one tree', () => {
    const { trace } = codesOf({ frequencies: { x: 1, y: 1, z: 2 } });
    const q = stateOf(trace, 'Q', 'tree');
    expect(q.data.roots).toHaveLength(1);
    const labels = Object.values(q.marks.edgeLabels).sort();
    expect(labels).toEqual(['0', '0', '1', '1']);
  });

  it('reads the notation and refuses what it cannot code', () => {
    expect(parseFrequencies('a:45, b:1.5 ::2')).toEqual([
      ['a', 45],
      ['b', 1.5],
      [':', 2],
    ]);
    expect(() => parseFrequencies('a45')).toThrow(
      /character and its frequency/,
    );
    expect(runError('huffman', { frequencies: 'a:3' }).message).toMatch(
      /at least two/,
    );
    expect(runError('huffman', { frequencies: 'a:3 a:4' }).message).toMatch(
      /once/,
    );
    expect(runError('huffman', { frequencies: 'a:3 b:0' }).message).toMatch(
      /positive/,
    );
  });

  it('agrees with the references on random frequencies', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
          minLength: 2,
          maxLength: 16,
        }),
        fc.array(fc.integer({ min: 1, max: 40 }), {
          minLength: 16,
          maxLength: 16,
        }),
        (chars, weights) => {
          const pairs: Pairs = chars.map((c, k) => [c, weights[k]!]);
          const { codes, trace } = codesOf({ frequencies: pairs });
          const expected = reference(pairs);
          expect(codes).toEqual(pairs.map(([c]) => expected.get(c)));
          // Optimal, and prefix-free.
          const cost = pairs.reduce(
            (s, [, f], k) => s + f * codes[k]!.length,
            0,
          );
          expect(cost).toBe(optimalCost(pairs.map(([, f]) => f)));
          for (const a of codes)
            for (const b of codes)
              if (a !== b) expect(b.startsWith(a)).toBe(false);
          // The queue's roots are in order of frequency in every frame.
          for (let k = 0; k <= trace.length; k++) {
            const q = stateOf(trace, 'Q', 'tree', k);
            const freq = (id: string) => {
              const v = q.data.nodes.find((n) => n.id === id)!.value;
              return typeof v === 'number'
                ? v
                : Number(String(v).split(':')[1]);
            };
            const fs = q.data.roots.map(freq);
            expect(fs).toEqual([...fs].sort((a, b) => a - b));
          }
        },
      ),
      fuzz,
    );
  });
});
