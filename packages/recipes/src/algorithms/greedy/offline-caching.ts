/**
 * Offline caching with the furthest-in-future strategy, as in CLRS: the
 * whole sequence of requests is known in advance, and a cache holds k
 * blocks. A request for a block in the cache is a hit; otherwise it is a
 * miss, and when the cache is full the block whose next request comes
 * last, or never, makes room. This greedy choice gives the fewest misses
 * possible.
 *
 * The requests are an array with a pointer at the current one; the cache
 * is an array of k slots beside it, and the misses are counted in a cell
 * of their own. An eviction highlights where each cached block is next
 * requested.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { listField } from '../../notation/schema.ts';
import { ordinal } from '../searching/randomized-select.ts';

/**
 * The most requests and the largest cache: 24 requests keep a run to a
 * screen of steps and the request array to one row, and a cache of 6
 * still fits beside it.
 */
export const MAX_REQUESTS = 24;
export const MAX_CACHE = 6;

const Block = z
  .string()
  .regex(/^[A-Za-z0-9_]{1,4}$/, 'A block is a name of 1 to 4 letters or digits')
  .describe(
    'A block, named by a short word such as "a"; names are case-sensitive, so "a" and "A" are two blocks.',
  );

export const offlineCaching = defineAlgorithm({
  id: 'offline-caching',
  title: { en: 'Offline caching', zh: '离线缓存' },
  topic: 'greedy',
  summary: {
    en: 'Serves a known sequence of requests with a cache of k blocks, evicting on each full miss the block requested furthest in the future, for the fewest misses possible.',
    zh: '用容量为 k 个块的缓存处理一串已知的请求：缓存满时未命中，就换出下一次请求最晚的块，使未命中次数最少。',
  },
  input: z.strictObject({
    requests: listField(
      z
        .array(Block)
        .min(1)
        .max(MAX_REQUESTS)
        .describe(
          `The blocks requested, in order, 1 to ${MAX_REQUESTS}, e.g. "a b c d a d e a d b a c".`,
        ),
      'word',
    ),
    k: z
      .int()
      .min(1)
      .max(MAX_CACHE)
      .optional()
      .describe(
        `How many blocks the cache holds, 1 to ${MAX_CACHE}; 3 by default.`,
      ),
  }),
  main: 'requests',
  examples: [
    {
      requests: ['a', 'b', 'c', 'd', 'a', 'd', 'e', 'a', 'd', 'b', 'a', 'c'],
      k: 3,
    },
  ],
  code: {
    pseudocode: `
      FURTHEST-IN-FUTURE(r, n, k)
          C = ∅
          misses = 0
          for i = 0 to n - 1
              if r[i] ∉ C  // @check
                  misses = misses + 1
                  if |C| < k
                      add r[i] to C  // @miss
                  else
                      z = the block of C requested next furthest after i, or never  // @evict
                      replace z by r[i] in C
          return misses  // @done
    `,
    python: `
      def next_use(r, i, block):
          later = [j for j in range(i + 1, len(r)) if r[j] == block]
          return later[0] if later else float('inf')

      def furthest_in_future(r, k):
          cache, misses = [], 0
          for i in range(len(r)):
              if r[i] not in cache:  # @check
                  misses += 1
                  if len(cache) < k:
                      cache.append(r[i])  # @miss
                  else:
                      z = max(cache, key=lambda b: next_use(r, i, b))  # @evict
                      cache[cache.index(z)] = r[i]
          return misses  # @done
    `,
  },
  run({ requests, k: size }, trace) {
    const k = size ?? 3;
    const n = requests.length;
    const R = trace.add('r', { kind: 'array', initial: [...requests] });
    const C = trace.add('cache', {
      kind: 'array',
      label: trace.say({
        en: `the cache, ${k} block${k === 1 ? '' : 's'}`,
        zh: `缓存，${k} 个块`,
      }),
      place: 'side',
      initial: Array.from({ length: k }, () => ''),
    });
    const M = trace.add('misses', {
      kind: 'array',
      label: trace.say({ en: 'misses', zh: '未命中次数' }),
      place: 'side',
      initial: [0],
    });
    const cache: string[] = [];
    let misses = 0;
    const nextUse = (i: number, block: string) => {
      const j = requests.indexOf(block, i + 1);
      return j < 0 ? Infinity : j;
    };

    requests.forEach((block, i) => {
      const slot = cache.indexOf(block);
      if (slot >= 0) {
        trace.step(
          'check',
          {
            en: `Request ${i}, ${block}: it is in the cache, a hit.`,
            zh: `请求 ${i}，${block}：它在缓存中，命中。`,
          },
          {
            vars: { i, misses },
          },
        );
        R.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
        C.highlight({ indices: [slot] });
        return;
      }
      misses += 1;
      if (cache.length < k) {
        cache.push(block);
        trace.step(
          'miss',
          {
            en: `Request ${i}, ${block}: a miss, the ${ordinal(misses)}. The cache has room: ${block} goes into slot ${cache.length - 1}.`,
            zh: `请求 ${i}，${block}：未命中，这是第 ${misses} 次。缓存还有空位：${block} 放进位置 ${cache.length - 1}。`,
          },
          { vars: { i, misses } },
        );
        R.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
        C.set({ index: cache.length - 1, value: block }).highlight({
          indices: [cache.length - 1],
        });
        M.set({ index: 0, value: misses });
        return;
      }
      const uses = cache.map((b) => nextUse(i, b));
      // The furthest next request; ties, such as two blocks never needed
      // again, go to the first slot, as Python's max() does.
      const z = uses.indexOf(Math.max(...uses));
      const when = (b: string, j: number) =>
        j === Infinity ? `${b} never again` : `${b} at ${j}`;
      const whenZh = (b: string, j: number) =>
        j === Infinity ? `${b} 不再需要` : `${b} 在 ${j}`;
      trace.step(
        'evict',
        {
          en: `Request ${i}, ${block}: a miss, the ${ordinal(misses)}, and the cache is full. Next requests: ${cache.map((b, s) => when(b, uses[s]!)).join(', ')}. Evict ${cache[z]}, ${uses[z] === Infinity ? 'never needed again' : 'needed furthest in the future'}, for ${block}.`,
          zh: `请求 ${i}，${block}：未命中，这是第 ${misses} 次，而且缓存已满。各块的下一次请求：${cache.map((b, s) => whenZh(b, uses[s]!)).join('，')}。换出${uses[z] === Infinity ? '不再需要的' : '下一次请求最晚的'} ${cache[z]}，放入 ${block}。`,
        },
        { vars: { i, misses } },
      );
      R.pointer({ name: 'i', index: i }).highlight({
        indices: [i, ...uses.filter((j) => j !== Infinity)],
      });
      cache[z] = block;
      C.set({ index: z, value: block }).highlight({ indices: [z] });
      M.set({ index: 0, value: misses });
    });
    trace.step(
      'done',
      {
        en: `${n} request${n === 1 ? '' : 's'}, ${misses} miss${misses === 1 ? '' : 'es'}: no strategy misses fewer.`,
        zh: `${n} 个请求，未命中 ${misses} 次：没有哪种策略的未命中次数更少。`,
      },
      { vars: { misses } },
    );
    R.pointer({ name: 'i', index: null });
    M.settle({ index: 0 });
  },
});
