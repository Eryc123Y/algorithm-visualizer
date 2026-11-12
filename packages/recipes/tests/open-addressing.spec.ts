/**
 * Quadratic probing and double hashing against independent references:
 * tables that walk the probe sequence their own way (quadratic probing by
 * jumps of 1, 2, 3, … slots; double hashing by steps of h₂(k)), over
 * random operations, composed or chained. Each sequence must also reach
 * every slot, for the sizes the modules take.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algoviz/spec';

import { findAlgorithm } from '../src/index.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

type Call = { op: 'insert' | 'search'; key: number };
const mod = (k: number, m: number) => ((k % m) + m) % m;

/** The slots a key probes, in order, walked without the closed formula. */
const SEQUENCES = {
  'quadratic-probing': (k: number, m: number) => {
    const out: number[] = [];
    let q = mod(k, m);
    for (let jump = 1; out.length < m; jump++) {
      out.push(q);
      q = (q + jump) % m;
    }
    return out;
  },
  'double-hashing': (k: number, m: number) => {
    const out: number[] = [];
    let q = mod(k, m);
    while (out.length < m) {
      out.push(q);
      q = (q + 1 + mod(k, m - 1)) % m;
    }
    return out;
  },
} as const;
type Id = keyof typeof SEQUENCES;

const SIZES: Record<Id, number[]> = {
  'quadratic-probing': [1, 2, 4, 8, 16],
  'double-hashing': [2, 3, 5, 7, 11, 13],
};

function reference(
  id: Id,
  size: number,
  keys: readonly number[],
  calls: readonly Call[],
) {
  const slots: (number | '')[] = Array.from({ length: size }, () => '');
  const probes: number[] = [];
  const insert = (k: number) => {
    const q = SEQUENCES[id](k, size).find((s) => slots[s] === '')!;
    slots[q] = k;
  };
  keys.forEach(insert);
  const start = [...slots];
  const results = calls.map(({ op, key }) => {
    if (op === 'insert') {
      const seq = SEQUENCES[id](key, size);
      probes.push(seq.findIndex((s) => slots[s] === '') + 1);
      insert(key);
      return null;
    }
    const seq = SEQUENCES[id](key, size);
    const stop = seq.findIndex((s) => slots[s] === key || slots[s] === '');
    probes.push(stop === -1 ? size : stop + 1);
    return stop !== -1 && slots[seq[stop]!] === key;
  });
  return { start, end: slots, results, probes };
}

const slotsAt = (doc: VisualizationInput, frame?: number) =>
  stateOf(replay(doc), 't', 'array', frame).data.map((e) => e.value);

/** The probe steps of each operation of a run. */
const probesOf = (doc: VisualizationInput) =>
  doc.steps.reduce<number[]>((out, s) => {
    if (s.meta?.id !== 'probe') return out;
    if (s.meta.vars?.['i'] === 0) out.push(0);
    out[out.length - 1]! += 1;
    return out;
  }, []);

const runs = (id: Id) =>
  fc
    .constantFrom(...SIZES[id])
    .chain((size) =>
      fc.record({
        size: fc.constant(size),
        keys: fc.array(fc.integer({ min: -40, max: 40 }), { maxLength: size }),
        calls: fc.array(
          fc.record({
            op: fc.constantFrom<'insert' | 'search'>('insert', 'search'),
            key: fc.integer({ min: -40, max: 40 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
      }),
    )
    .map(({ size, keys, calls }) => {
      let room = size - keys.length;
      return {
        size,
        keys,
        calls: calls.filter((c) => c.op === 'search' || room-- > 0),
      };
    })
    .filter(({ calls }) => calls.length > 0);

describe.each(Object.keys(SEQUENCES) as Id[])('%s', (id) => {
  it('reaches every slot from every key, for the sizes it takes', () => {
    for (const m of SIZES[id])
      for (let k = -20; k <= 20; k++)
        expect(new Set(SEQUENCES[id](k, m)).size).toBe(m);
  });

  it('matches the reference on random operations, composed or chained', () => {
    fc.assert(
      fc.property(runs(id), ({ size, keys, calls }) => {
        const run = runOk(id, { from: { size, keys }, ops: calls });
        const ref = reference(id, size, keys, calls);
        expect(slotsAt(run.document, 0)).toEqual(ref.start);
        expect(slotsAt(run.document)).toEqual(ref.end);
        expect(run.results).toEqual(ref.results);
        expect(probesOf(run.document)).toEqual(ref.probes);
        if (calls.length > 1) {
          const one = runOk(id, {
            from: { size, keys },
            ops: calls.slice(0, 1),
          });
          const rest = runOk(id, { from: one.after, ops: calls.slice(1) });
          expect(slotsAt(rest.document)).toEqual(ref.end);
        }
      }),
      fuzz,
    );
  });

  it('refuses a size whose sequence would miss slots, and a full table', () => {
    const bad = id === 'quadratic-probing' ? 6 : 9;
    for (const op of ['search', 'insert'])
      for (const keys of [[], [1, 2]])
        expect(
          runError(`${id}.${op}`, { from: { size: bad, keys }, key: 1 }),
        ).toMatchObject({ code: 'INVALID_ARGUMENT', path: '$.input' });
    const m = SIZES[id][1]!;
    const full = Array.from({ length: m }, (_, k) => k);
    expect(
      runError(`${id}.insert`, { from: { size: m, keys: full }, key: 99 })
        .message,
    ).toContain('The table is full');
  });
});

describe('the examples', () => {
  it('keeps keys near the largest safe integer on their sequences', () => {
    const big = fc.integer({ min: -(2 ** 53 - 1), max: 2 ** 53 - 1 });
    fc.assert(
      fc.property(big, big, (k1, k2) => {
        for (const id of Object.keys(SEQUENCES) as Id[]) {
          const size = SIZES[id].at(-1)!;
          const run = runOk(id, {
            from: { size, keys: [k1] },
            ops: [{ op: 'insert', key: k2 }],
          });
          expect(slotsAt(run.document)).toEqual(
            reference(id, size, [k1, k2], []).end,
          );
        }
      }),
      fuzz,
    );
  });

  it('writes the probe line of each table in Python', () => {
    const python = (id: string) => findAlgorithm(id)!.code.python.code;
    expect(python('quadratic-probing.insert')).toContain(
      'q = (k + i * (i + 1) // 2) % m',
    );
    expect(python('double-hashing.search')).toContain('h2 = 1 + k % (m - 1)');
    expect(python('double-hashing.search')).toContain(
      'q = (k % m + i * h2) % m',
    );
  });

  it('quadratic probing jumps 1, 2 and 3 slots further to place 19', () => {
    const { document } = runOk('quadratic-probing.insert', {
      from: { size: 8, keys: [15, 11, 27, 8, 22] },
      key: 19,
    });
    expect(document.steps.map((s) => s.meta?.vars?.['q'])).toEqual([
      3,
      4,
      6,
      1,
      undefined,
    ]);
  });

  it('double hashing steps 3 slots at a time from slot 1 to place 14', () => {
    const { document } = runOk('double-hashing.insert', {
      from: { size: 13, keys: [79, 69, 98, 72, 50] },
      key: 14,
    });
    expect(document.steps.map((s) => s.meta?.vars?.['q'])).toEqual([
      1,
      4,
      7,
      10,
      undefined,
    ]);
  });
});

for (const id of Object.keys(SEQUENCES) as Id[])
  recipe(
    id,
    runs(id),
    ({ size, keys, calls }) =>
      runOk(id, { from: { size, keys }, ops: calls }).document,
    (trace, { size, keys, calls }) => {
      expect(stateOf(trace, 't', 'array').data.map((e) => e.value)).toEqual(
        reference(id, size, keys, calls).end,
      );
    },
  );
