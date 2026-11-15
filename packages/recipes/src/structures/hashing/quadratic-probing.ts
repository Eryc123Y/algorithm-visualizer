/**
 * A hash table with quadratic probing, as in CLRS with c₁ = c₂ = 1/2: a
 * key k tries h(k, i) = (k + i(i + 1)/2) mod m for i = 0, 1, …, m - 1.
 * The offsets 0, 1, 3, 6, 10, … reach every slot when m is a power of 2,
 * so the table sizes are 1, 2, 4, 8 and 16.
 */
import { mod } from './hash.ts';
import { openAddressing } from './open-addressing.ts';
import { probingCode } from './probing-code.ts';

const isPowerOf2 = (m: number) => (m & (m - 1)) === 0;

export const quadraticProbing = openAddressing({
  id: 'quadratic-probing',
  title: { en: 'Hash table with quadratic probing', zh: '二次探查散列表' },
  summary: {
    en: 'Inserts and searches integer keys one after another in a hash table that probes the slots (k + i(i + 1)/2) mod m, jumping 1, 2, 3, … slots further each time.',
    zh: '在散列表中依次插入和查找整数关键字，依次探查槽 (k + i(i + 1)/2) mod m，每次比上一次多跳 1、2、3、…… 个槽。',
  },
  sequence: {
    en: '(k + i(i + 1)/2) mod m for i = 0, 1, and so on',
    zh: '(k + i(i + 1)/2) mod m（i = 0, 1, …）',
  },
  scheme: {
    slot: (key, i, size) => mod(mod(key, size) + (i * (i + 1)) / 2, size),
    narrate: (key, i, q, size, holds) =>
      i === 0
        ? {
            en: `${key} mod ${size} = ${q}: probe slot ${q}; ${holds.en}.`,
            zh: `${key} mod ${size} = ${q}：探查槽 ${q}；${holds.zh}。`,
          }
        : {
            en: `Jump ${i} further than the last probe: (${mod(key, size)} + ${(i * (i + 1)) / 2}) mod ${size} = ${q}; ${holds.en}.`,
            zh: `比上一次探查多跳 ${i} 个：(${mod(key, size)} + ${(i * (i + 1)) / 2}) mod ${size} = ${q}；${holds.zh}。`,
          },
    unfit: (size) =>
      isPowerOf2(size)
        ? undefined
        : `Quadratic probing reaches every slot only when m is a power of 2, such as 8 or 16, and ${size} is not one`,
  },
  code: probingCode({
    pseudocode: 'q = (k + i(i + 1)/2) mod m',
    python: 'q = (k + i * (i + 1) // 2) % m',
  }),
  sample: { size: 8, keys: [15, 11, 27, 8, 22] },
  run: [
    ...[15, 11, 27, 8, 22, 19].map((key) => ({ op: 'insert' as const, key })),
    { op: 'search', key: 19 },
    { op: 'search', key: 35 },
  ],
  examples: { insert: 19, found: 27, missing: 35 },
});
