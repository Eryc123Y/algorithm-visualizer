/**
 * The hash tables against independent references on plain arrays: chains
 * that grow at the head, and linear probing. They also meet the checks of
 * ADR 0018: frame 0 is the starting table, chained runs agree with one
 * run, and `after` rebuilds the same table. `properties.spec.ts` runs them
 * on random inputs.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algomotion/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Call = { readonly op: 'insert' | 'search'; readonly key: number };

const mod = (k: number, m: number) => ((k % m) + m) % m;

/** Chains with each key put at the head, and the search results. */
function chainingReference(
  size: number,
  keys: readonly number[],
  calls: readonly Call[] = [],
) {
  const chains: number[][] = Array.from({ length: size }, () => []);
  for (const k of keys) chains[mod(k, size)]!.unshift(k);
  const start = chains.map((c) => [...c]);
  const results = calls.map(({ op, key }) => {
    const chain = chains[mod(key, size)]!;
    if (op === 'search') return chain.includes(key);
    chain.unshift(key);
    return null;
  });
  return { start, end: chains, results };
}

/** Slots filled by linear probing, and the search results. */
function probingReference(
  size: number,
  keys: readonly number[],
  calls: readonly Call[] = [],
) {
  const slots: (number | '')[] = Array.from({ length: size }, () => '');
  const insert = (k: number) => {
    let q = mod(k, size);
    while (slots[q] !== '') q = (q + 1) % size;
    slots[q] = k;
  };
  keys.forEach(insert);
  const start = [...slots];
  const results = calls.map(({ op, key }) => {
    if (op === 'search') return slots.includes(key);
    insert(key);
    return null;
  });
  return { start, end: slots, results };
}

const chainsAt = (doc: VisualizationInput, frame?: number) =>
  stateOf(replay(doc), 't', 'hashTable', frame).data.map((c) =>
    c.map((e) => e.value),
  );

const slotsAt = (doc: VisualizationInput, frame?: number) =>
  stateOf(replay(doc), 't', 'array', frame).data.map((e) => e.value);

const keys = [15, 11, 27, 8, 22, 4];

describe('hash-chaining', () => {
  it('puts each key at the head of the chain of k mod m', () => {
    const { document, after } = runOk('hash-chaining.insert', {
      from: { size: 7, keys },
      key: 29,
    });
    const ref = chainingReference(7, [...keys, 29]);
    expect(chainsAt(document)).toEqual(ref.end);
    expect(chainsAt(document, 0)).toEqual(chainingReference(7, keys).start);
    expect(after).toEqual({ size: 7, keys: [...keys, 29] });
    expect(document.steps.map((s) => s.meta?.id)).toEqual(['hash', 'insert']);
  });

  it('walks the chain from the head and settles the key it finds', () => {
    const found = runOk('hash-chaining.search', {
      from: { size: 7, keys },
      key: 15,
    });
    // Bucket 1 holds 22, 8 and 15, head first.
    expect(found.document.steps.map((s) => s.meta?.id)).toEqual([
      'hash',
      'compare',
      'compare',
      'compare',
      'found',
    ]);
    expect(found.results).toEqual([true]);
    const t = stateOf(replay(found.document), 't', 'hashTable');
    expect(t.marks.settled).toEqual(['k0']);

    const missing = runOk('hash-chaining.search', {
      from: { size: 7, keys },
      key: 1,
    });
    expect(missing.results).toEqual([false]);
    expect(missing.document.steps.at(-1)?.meta?.id).toBe('missing');
  });

  it('keeps equal keys as separate entries, as CLRS does', () => {
    const run = runOk('hash-chaining', {
      from: { size: 3, keys: [5, 5] },
      ops: [{ op: 'insert', key: 5 }],
    });
    expect(chainsAt(run.document)).toEqual([[], [], [5, 5, 5]]);
    expect(run.after).toEqual({ size: 3, keys: [5, 5, 5] });
  });

  it('keeps keys near the largest safe integer exact', () => {
    const big = -Number.MAX_SAFE_INTEGER;
    const { document } = runOk('hash-chaining.insert', {
      from: { size: 16, keys: [] },
      key: big,
    });
    expect(chainsAt(document)[mod(big, 16)]).toEqual([big]);
  });

  it('hashes negative keys to a bucket from 0 to m - 1', () => {
    const { document } = runOk('hash-chaining.insert', {
      from: { size: 5, keys: [] },
      key: -3,
    });
    expect(chainsAt(document)).toEqual([[], [], [-3], [], []]);
    expect(document.steps[0]!.meta!.narration).toBe(
      '-3 mod 5 = 2: it goes into bucket 2.',
    );
  });

  it('matches the reference on random operations, composed or chained', () => {
    const key = fc.integer({ min: -30, max: 30 });
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 16 }),
        fc.array(key, { maxLength: 12 }),
        fc.array(fc.record({ op: fc.constantFrom('insert', 'search'), key }), {
          minLength: 2,
          maxLength: 8,
        }),
        (size, start, calls: Call[]) => {
          const run = runOk('hash-chaining', {
            from: { size, keys: start },
            ops: calls,
          });
          const ref = chainingReference(size, start, calls);
          expect(chainsAt(run.document, 0)).toEqual(ref.start);
          expect(chainsAt(run.document)).toEqual(ref.end);
          expect(run.results).toEqual(ref.results);
          expect(run.document.sections).toHaveLength(calls.length);
          // `after` rebuilds the same chains.
          const again = runOk('hash-chaining.search', {
            from: run.after,
            key: 0,
          });
          expect(chainsAt(again.document, 0)).toEqual(ref.end);
          // Two runs chained through `after` end where one run ends.
          const one = runOk('hash-chaining', {
            from: { size, keys: start },
            ops: calls.slice(0, 1),
          });
          const rest = runOk('hash-chaining', {
            from: one.after,
            ops: calls.slice(1),
          });
          expect(chainsAt(rest.document)).toEqual(ref.end);
        },
      ),
      fuzz,
    );
  });

  it('holds at most 24 keys, so `after` can always start the next call', () => {
    const full = Array.from({ length: 24 }, (_, k) => k);
    expect(
      runError('hash-chaining.insert', {
        from: { size: 4, keys: full },
        key: 1,
      }),
    ).toEqual({
      code: 'INVALID_ARGUMENT',
      path: '$.input',
      message: 'The table is full: it holds at most 24 keys',
    });
    for (const [from, path] of [
      [{ size: 0, keys: [] }, '$.input.from.size'],
      [{ size: 17, keys: [] }, '$.input.from.size'],
      [{ size: 4, keys: [1.5] }, '$.input.from.keys[0]'],
      [{ size: 4, keys: [...full, 24] }, '$.input.from.keys'],
    ] as const)
      expect(runError('hash-chaining.search', { from, key: 1 }).path).toBe(
        path,
      );
  });
});

describe('linear-probing', () => {
  it('stores each key in the first free slot from k mod m on', () => {
    const some = keys.slice(0, 4);
    const { document, after } = runOk('linear-probing.insert', {
      from: { size: 7, keys: some },
      key: 29,
    });
    expect(slotsAt(document)).toEqual(probingReference(7, [...some, 29]).end);
    expect(slotsAt(document, 0)).toEqual(probingReference(7, some).start);
    expect(after).toEqual({ size: 7, keys: [...some, 29] });
    // 29 mod 7 = 1: slots 1 and 2 are taken, 3 is free.
    expect(document.steps.map((s) => s.meta?.id)).toEqual([
      'probe',
      'probe',
      'probe',
      'store',
    ]);
  });

  it('stores an equal key in a slot of its own, as CLRS does', () => {
    const { document } = runOk('linear-probing.insert', {
      from: { size: 4, keys: [5, 5] },
      key: 5,
    });
    expect(slotsAt(document)).toEqual(['', 5, 5, 5]);
  });

  it('wraps around from the last slot to the first', () => {
    const { document } = runOk('linear-probing.insert', {
      from: { size: 4, keys: [3] },
      key: 7,
    });
    expect(slotsAt(document)).toEqual([7, '', '', 3]);
  });

  it('stops at the key, at an empty slot, or after m probes', () => {
    const from = { size: 7, keys };
    const ids = (key: number, f: object = from) =>
      runOk('linear-probing.search', { from: f, key }).document.steps.map(
        (s) => s.meta?.id,
      );
    // Slots 1, 2 and 3 hold 15, 8 and 22; slot 0 is empty.
    expect(ids(22)).toEqual(['probe', 'probe', 'probe', 'found']);
    expect(ids(0)).toEqual(['probe', 'missing']);
    const full = { size: 3, keys: [0, 1, 2] };
    expect(ids(5, full)).toEqual(['probe', 'probe', 'probe', 'exhausted']);
    expect(
      runOk('linear-probing.search', { from: full, key: 5 }).results,
    ).toEqual([false]);
  });

  it('keeps keys near the largest safe integer exact', () => {
    const big = Number.MAX_SAFE_INTEGER;
    const { document } = runOk('linear-probing.insert', {
      from: { size: 16, keys: [mod(big, 16)] },
      key: big,
    });
    expect(slotsAt(document)[(mod(big, 16) + 1) % 16]).toBe(big);
  });

  it('matches the reference on random operations, composed or chained', () => {
    const key = fc.integer({ min: -30, max: 30 });
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 16 }),
        fc.array(key, { maxLength: 16 }),
        fc.array(fc.record({ op: fc.constantFrom('insert', 'search'), key }), {
          minLength: 2,
          maxLength: 8,
        }),
        (size, keys, picks: Call[]) => {
          const start = keys.slice(0, size);
          // Inserts only while there is room.
          let room = size - start.length;
          const calls = picks.filter((c) => c.op === 'search' || room-- > 0);
          fc.pre(calls.length > 0);
          const run = runOk('linear-probing', {
            from: { size, keys: start },
            ops: calls,
          });
          const ref = probingReference(size, start, calls);
          expect(slotsAt(run.document, 0)).toEqual(ref.start);
          expect(slotsAt(run.document)).toEqual(ref.end);
          expect(run.results).toEqual(ref.results);
          const again = runOk('linear-probing.search', {
            from: run.after,
            key: 0,
          });
          expect(slotsAt(again.document, 0)).toEqual(ref.end);
          const one = runOk('linear-probing', {
            from: { size, keys: start },
            ops: calls.slice(0, 1),
          });
          if (calls.length > 1) {
            const rest = runOk('linear-probing', {
              from: one.after,
              ops: calls.slice(1),
            });
            expect(slotsAt(rest.document)).toEqual(ref.end);
          }
        },
      ),
      fuzz,
    );
  });

  it('refuses a key that does not fit, and more keys than slots', () => {
    expect(
      runError('linear-probing.insert', {
        from: { size: 2, keys: [1, 2] },
        key: 3,
      }),
    ).toEqual({
      code: 'INVALID_ARGUMENT',
      path: '$.input',
      message:
        'The table is full: all 2 slots hold keys, so 3 cannot be inserted',
    });
    expect(
      runError('linear-probing.search', {
        from: { size: 2, keys: [1, 2, 3] },
        key: 3,
      }),
    ).toEqual({
      code: 'INVALID_ARGUMENT',
      path: '$.input',
      message: '3 keys do not fit into 2 slots',
    });
  });
});
