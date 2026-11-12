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
  title: 'Hash table with quadratic probing',
  summary:
    'Inserts and searches integer keys one after another in a hash table that probes the slots (k + i(i + 1)/2) mod m, jumping 1, 2, 3, … slots further each time.',
  sequence: '(k + i(i + 1)/2) mod m for i = 0, 1, and so on',
  scheme: {
    slot: (key, i, size) => mod(mod(key, size) + (i * (i + 1)) / 2, size),
    narrate: (key, i, q, size, holds) =>
      i === 0
        ? `${key} mod ${size} = ${q}: probe slot ${q}; ${holds}.`
        : `Jump ${i} further than the last probe: (${mod(key, size)} + ${(i * (i + 1)) / 2}) mod ${size} = ${q}; ${holds}.`,
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
