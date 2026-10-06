/**
 * Hash tables with h(k) = k mod m.
 */
import type { VisualizationInput } from '@algoviz/spec';

import { Recorder } from './recorder.ts';
import { python } from './source.ts';

/** Separate chaining: inserts keys, then looks one up. */
export function hashChaining(
  keys: readonly number[],
  size: number,
  search?: number,
): VisualizationInput {
  const r = new Recorder({
    title: 'Hash table with chaining',
    source: python(`
      def insert(t, key):
          b = key % len(t)
          t[b].append(key)

      def contains(t, key):
          b = key % len(t)
          for x in t[b]:
              if x == key: return True
          return False
    `),
  });
  const table = r.add('t', { kind: 'hashTable', size });
  const chains: number[][] = Array.from({ length: size }, () => []);
  keys.forEach((key, k) => {
    const b = ((key % size) + size) % size;
    r.step({
      line: 3,
      narration: `${key} mod ${size} = ${b}: append ${key} to bucket ${b}.`,
    });
    table
      .highlight({ bucket: b })
      .insert({ bucket: b, element: { id: `k${k}`, value: key } });
    chains[b]!.push(key);
  });
  if (search !== undefined) {
    const b = ((search % size) + size) % size;
    r.step({
      line: 6,
      narration: `Look for ${search}: ${search} mod ${size} = ${b}.`,
    });
    table.highlight({ bucket: b });
    for (const [index, x] of chains[b]!.entries()) {
      r.step({ line: 8, narration: `Is ${x} = ${search}?` });
      table.highlight({ bucket: b, indices: [index] });
      if (x === search) {
        r.step({ line: 8, narration: `Found ${search}.` });
        table.settle({ bucket: b, index });
        return r.build();
      }
    }
    r.step({
      line: 9,
      narration: `Bucket ${b} has no ${search}: it is not in the table.`,
    });
  }
  return r.build();
}

/** Open addressing with linear probing, drawn as an array of slots. */
export function linearProbing(
  keys: readonly number[],
  size: number,
): VisualizationInput {
  if (keys.length > size) throw new RangeError('More keys than slots');
  const r = new Recorder({
    title: 'Hash table with linear probing',
    source: python(`
      def insert(t, key):
          i = key % len(t)
          while t[i] is not None:
              i = (i + 1) % len(t)
          t[i] = key
    `),
  });
  const slots: (number | null)[] = Array<number | null>(size).fill(null);
  const table = r.add('t', { kind: 'array', initial: slots.map(() => '') });
  for (const key of keys) {
    let i = ((key % size) + size) % size;
    r.step({ line: 2, narration: `${key} mod ${size} = ${i}.` });
    table.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
    while (slots[i] !== null) {
      r.step({
        line: 4,
        narration: `Slot ${i} holds ${slots[i]}: try the next one.`,
      });
      i = (i + 1) % size;
      table.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
    }
    r.step({ line: 5, narration: `Slot ${i} is free: store ${key}.` });
    table.set({ index: i, value: key });
    slots[i] = key;
  }
  r.step('All keys are stored.');
  table.pointer({ name: 'i', index: null });
  return r.build();
}
