/**
 * A hash table with linear probing (ADR 0023): a key k tries the slots
 * h(k, i) = (k + i) mod m for i = 0, 1, …, m - 1.
 */
import { mod } from './hash.ts';
import { openAddressing } from './open-addressing.ts';
import { probingCode } from './probing-code.ts';

export const linearProbing = openAddressing({
  id: 'linear-probing',
  title: { en: 'Hash table with linear probing', zh: '线性探查散列表' },
  summary: {
    en: 'Inserts and searches integer keys one after another in a hash table that probes the slots (k + i) mod m for i = 0, 1, and so on.',
    zh: '在散列表中依次插入和查找整数关键字，对 i = 0, 1, …，依次探查槽 (k + i) mod m。',
  },
  sequence: {
    en: '(k + i) mod m for i = 0, 1, and so on',
    zh: '(k + i) mod m（i = 0, 1, …）',
  },
  scheme: {
    slot: (key, i, size) => mod(mod(key, size) + i, size),
    narrate: (key, i, q, size, holds) =>
      i === 0
        ? {
            en: `${key} mod ${size} = ${q}: probe slot ${q}; ${holds.en}.`,
            zh: `${key} mod ${size} = ${q}：探查槽 ${q}；${holds.zh}。`,
          }
        : {
            en: `Probe the next slot, ${q}; ${holds.en}.`,
            zh: `探查下一个槽 ${q}；${holds.zh}。`,
          },
  },
  code: probingCode({
    pseudocode: 'q = (k + i) mod m',
    python: 'q = (k + i) % m',
  }),
  sample: { size: 7, keys: [15, 11, 27, 8, 22] },
  run: [
    ...[15, 11, 27, 8, 22].map((key) => ({ op: 'insert' as const, key })),
    { op: 'search', key: 22 },
    { op: 'search', key: 5 },
  ],
  examples: { insert: 29, found: 22, missing: 4 },
});
