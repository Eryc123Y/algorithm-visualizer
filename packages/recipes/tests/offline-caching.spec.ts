/**
 * Offline caching against an independent reference: the fewest misses
 * possible, by trying every choice of block to evict on each full miss
 * (memoized over the request and the set cached). Furthest in future
 * must miss exactly that often, and its cache must hold the block each
 * request asks for.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algoviz/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

/** The fewest misses serving r from request i with `cache` held. */
function fewest(r: readonly string[], k: number): number {
  const memo = new Map<string, number>();
  const go = (i: number, cache: readonly string[]): number => {
    if (i === r.length) return 0;
    const key = `${i}|${[...cache].sort().join(',')}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    let best: number;
    if (cache.includes(r[i]!)) best = go(i + 1, cache);
    else if (cache.length < k) best = 1 + go(i + 1, [...cache, r[i]!]);
    else
      best =
        1 +
        Math.min(
          ...cache.map((_, z) =>
            go(
              i + 1,
              cache.map((b, s) => (s === z ? r[i]! : b)),
            ),
          ),
        );
    memo.set(key, best);
    return best;
  };
  return go(0, []);
}

function check(
  doc: VisualizationInput,
  requests: readonly string[],
  k: number,
): void {
  const trace = replay(doc);
  const misses = stateOf(trace, 'misses', 'array').data[0]!.value;
  expect(misses).toBe(fewest(requests, k));
  const kinds = doc.steps.map((s) => s.meta?.id);
  expect(kinds.filter((x) => x !== 'check' && x !== 'done')).toHaveLength(
    misses as number,
  );
  // After each request, its block is in the cache.
  requests.forEach((block, i) => {
    const cache = stateOf(trace, 'cache', 'array', i + 1).data.map(
      (e) => e.value,
    );
    expect(cache).toContain(block);
    expect(cache.filter((b) => b !== '').length).toBe(
      new Set(cache.filter((b) => b !== '')).size,
    );
  });
}

describe('offline-caching', () => {
  it('misses 7 times on the example, with a cache of 3', () => {
    const r = ['a', 'b', 'c', 'd', 'a', 'd', 'e', 'a', 'd', 'b', 'a', 'c'];
    const doc = runOk('offline-caching', undefined).document;
    check(doc, r, 3);
    expect(doc.steps.at(-1)!.meta!.narration).toContain('7 misses');
  });

  it('takes the requests alone, with a cache of 3, and evicts the first of ties', () => {
    const doc = runOk('offline-caching', 'x y z w').document;
    check(doc, ['x', 'y', 'z', 'w'], 3);
    // x, y and z are never needed again: x, in slot 0, goes.
    expect(
      stateOf(replay(doc), 'cache', 'array').data.map((e) => e.value),
    ).toEqual(['w', 'y', 'z']);
  });

  it('misses no more than any choice of evictions, on random requests', () => {
    fc.assert(
      fc.property(inputs, ({ requests, k }) =>
        check(runOk('offline-caching', { requests, k }).document, requests, k),
      ),
      fuzz,
    );
  });

  it('takes 1 to 24 short block names and a cache of 1 to 6', () => {
    expect(runError('offline-caching', { requests: [] }).path).toBe(
      '$.input.requests',
    );
    expect(runError('offline-caching', { requests: ['toolong'] }).path).toBe(
      '$.input.requests[0]',
    );
    expect(runError('offline-caching', { requests: ['a'], k: 7 }).path).toBe(
      '$.input.k',
    );
  });
});

const inputs = fc.record({
  requests: fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), {
    minLength: 1,
    maxLength: 16,
  }),
  k: fc.integer({ min: 1, max: 4 }),
});

recipe(
  'offline-caching',
  inputs,
  ({ requests, k }) => runOk('offline-caching', { requests, k }).document,
  (trace, { requests, k }) => check(trace.visualization, requests, k),
);
