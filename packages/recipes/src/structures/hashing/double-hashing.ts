/**
 * A hash table with double hashing, as in CLRS: a key k tries
 * h(k, i) = (h₁(k) + i·h₂(k)) mod m, with h₁(k) = k mod m and
 * h₂(k) = 1 + (k mod (m - 1)). The step h₂(k) is never 0, and with m prime
 * it shares no factor with m, so the probes reach every slot; the table
 * sizes are therefore primes.
 */
import { mod } from './hash.ts';
import { openAddressing } from './open-addressing.ts';
import { probingCode } from './probing-code.ts';

const isPrime = (m: number) => {
  if (m < 2) return false;
  for (let d = 2; d * d <= m; d++) if (m % d === 0) return false;
  return true;
};

/** h₂(k) = 1 + (k mod (m - 1)). */
const step = (key: number, size: number) => 1 + mod(key, size - 1);

export const doubleHashing = openAddressing({
  id: 'double-hashing',
  title: { en: 'Hash table with double hashing', zh: '双重散列表' },
  summary: {
    en: 'Inserts and searches integer keys one after another in a hash table that probes h₁(k), then steps h₂(k) slots at a time, with h₁(k) = k mod m and h₂(k) = 1 + (k mod (m − 1)).',
    zh: '在散列表中依次插入和查找整数关键字：先探查 h₁(k)，再每次前进 h₂(k) 个槽，其中 h₁(k) = k mod m，h₂(k) = 1 + (k mod (m − 1))。',
  },
  sequence: {
    en: '(h₁(k) + i·h₂(k)) mod m for i = 0, 1, and so on',
    zh: '(h₁(k) + i·h₂(k)) mod m（i = 0, 1, …）',
  },
  scheme: {
    slot: (key, i, size) => mod(mod(key, size) + i * step(key, size), size),
    narrate: (key, i, q, size, holds) =>
      i === 0
        ? {
            en: `h₁(${key}) = ${key} mod ${size} = ${q}, and the step is h₂(${key}) = 1 + (${key} mod ${size - 1}) = ${step(key, size)}: probe slot ${q}; ${holds}.`,
            zh: `h₁(${key}) = ${key} mod ${size} = ${q}，步长 h₂(${key}) = 1 + (${key} mod ${size - 1}) = ${step(key, size)}：探查槽 ${q}；${holds}。`,
          }
        : {
            en: `Step ${step(key, size)} slots further: slot ${q}; ${holds}.`,
            zh: `再前进 ${step(key, size)} 个槽：槽 ${q}；${holds}。`,
          },
    unfit: (size) =>
      isPrime(size)
        ? undefined
        : `Double hashing with h₂(k) = 1 + (k mod (m − 1)) reaches every slot when m is prime, such as 7, 11 or 13, and ${size} is not`,
  },
  code: probingCode({
    pseudocode: 'q = (k mod m + i · (1 + k mod (m - 1))) mod m',
    python: 'q = (k % m + i * h2) % m',
    pythonSetup: 'h2 = 1 + k % (m - 1)',
  }),
  sample: { size: 13, keys: [79, 69, 98, 72, 50] },
  run: [
    ...[79, 69, 98, 72, 50, 14].map((key) => ({ op: 'insert' as const, key })),
    { op: 'search', key: 14 },
    { op: 'search', key: 27 },
  ],
  examples: { insert: 14, found: 72, missing: 27 },
});
