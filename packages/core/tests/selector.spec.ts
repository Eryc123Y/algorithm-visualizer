import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Section } from '@algoviz/spec';

import {
  parseSelector,
  sectionAt,
  selectFrame,
  selectFrames,
  selectorOf,
  selectSeries,
  stepNameAt,
  type Selectable,
} from '../src/index.ts';

/** A document with one step per name (undefined for an unnamed step). */
function docOf(
  names: readonly (string | undefined)[],
  sections?: readonly Section[],
): Selectable {
  return {
    steps: names.map((id) => (id === undefined ? {} : { meta: { id } })),
    ...(sections === undefined ? {} : { sections }),
  };
}

// Two operations of a binary search tree, as ops.bst records them, with an
// unnamed step before the first section.
//          step: 0       1       2        3       4       5       6
const doc = docOf(
  [undefined, 'go', 'go', 'right', 'go', 'no-left', 'go'],
  [
    { id: 'insert-5', title: 'Insert 5', start: 1 },
    { id: 'delete-3', title: 'Delete 3', start: 4 },
  ],
);

const frames = (selector: string | number) => {
  const result = selectFrames(doc, selector);
  return result.ok ? result.value : result.error;
};

describe('parseSelector', () => {
  it.each([
    ['12', { type: 'frame', frame: 12 }],
    ['-1', { type: 'frame', frame: -1 }],
    ['0', { type: 'frame', frame: 0 }],
    ['relax', { type: 'name', name: 'relax' }],
    ['relax#3', { type: 'name', name: 'relax', nth: 3 }],
    [
      'insert-5/fixup-case-3#2',
      { type: 'name', section: 'insert-5', name: 'fixup-case-3', nth: 2 },
    ],
    ['insert-5/go', { type: 'name', section: 'insert-5', name: 'go' }],
    [
      'go..-1',
      {
        type: 'range',
        from: { type: 'name', name: 'go' },
        to: { type: 'frame', frame: -1 },
      },
    ],
    [
      ' 3 .. 5 ',
      {
        type: 'range',
        from: { type: 'frame', frame: 3 },
        to: { type: 'frame', frame: 5 },
      },
    ],
  ])('reads %j', (text, selector) => {
    expect(parseSelector(text)).toEqual({ ok: true, value: selector });
  });

  it.each([
    '',
    ' ',
    '-0',
    '01',
    '1.5',
    '+1',
    'Relax',
    'relax#0',
    'relax#',
    'relax#-1',
    'relax#01',
    '#2',
    'a/b/c',
    '/a',
    'a/',
    'a/3',
    '1..2..3',
    '..3',
    '3..',
    'a b',
    'a'.repeat(41),
    'x'.repeat(10_000),
  ])('rejects %j', (text) => {
    const result = parseSelector(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_SELECTOR');
      expect(result.error.message.length).toBeLessThan(200);
      expect(result.error.hint).toContain('relax#2');
    }
  });
});

describe('selectFrames', () => {
  it('reads frame numbers, negative ones from the end', () => {
    expect(frames(3)).toEqual({ from: 3, to: 3 });
    expect(frames('3')).toEqual({ from: 3, to: 3 });
    expect(frames(0)).toEqual({ from: 0, to: 0 });
    expect(frames(7)).toEqual({ from: 7, to: 7 });
    expect(frames(-1)).toEqual({ from: 7, to: 7 });
    expect(frames('-8')).toEqual({ from: 0, to: 0 });
  });

  it('rejects frames that do not exist', () => {
    for (const frame of [8, -9, '8', 1.5, Number.NaN])
      expect(frames(frame)).toMatchObject({
        code: 'OUT_OF_RANGE',
        hint: expect.stringContaining('0 (before the first step) to 7'),
      });
  });

  it('gives the frame after the first step of a name', () => {
    expect(frames('go')).toEqual({ from: 2, to: 2 });
    expect(frames('right')).toEqual({ from: 4, to: 4 });
  });

  it('counts steps of a name with #n', () => {
    expect(frames('go#1')).toEqual({ from: 2, to: 2 });
    expect(frames('go#2')).toEqual({ from: 3, to: 3 });
    expect(frames('go#4')).toEqual({ from: 7, to: 7 });
  });

  it('counts only inside a section with section/name#n', () => {
    expect(frames('delete-3/go')).toEqual({ from: 5, to: 5 });
    expect(frames('delete-3/go#2')).toEqual({ from: 7, to: 7 });
    expect(frames('insert-5/go#2')).toEqual({ from: 3, to: 3 });
    expect(frames('insert-5/right')).toEqual({ from: 4, to: 4 });
  });

  it('gives a section as its range of frames', () => {
    // From the frame before its first step to the frame after its last.
    expect(frames('insert-5')).toEqual({ from: 1, to: 4 });
    expect(frames('delete-3')).toEqual({ from: 4, to: 7 });
  });

  it('prefers a section to a step of the same name', () => {
    const both = docOf(
      ['pop', 'push', 'pop'],
      [{ id: 'pop', title: 'Pop', start: 2 }],
    );
    expect(selectFrames(both, 'pop')).toEqual({
      ok: true,
      value: { from: 2, to: 3 },
    });
    expect(selectFrames(both, 'pop#1')).toEqual({
      ok: true,
      value: { from: 1, to: 1 },
    });
  });

  it('gives the range between two selectors, both included', () => {
    expect(frames('go#2..right')).toEqual({ from: 3, to: 4 });
    expect(frames('2..5')).toEqual({ from: 2, to: 5 });
    expect(frames('insert-5..delete-3')).toEqual({ from: 1, to: 7 });
    expect(frames('0..-1')).toEqual({ from: 0, to: 7 });
    expect(frames('right..right')).toEqual({ from: 4, to: 4 });
  });

  it('rejects a range that ends before it starts', () => {
    expect(frames('5..2')).toMatchObject({
      code: 'INVALID_SELECTOR',
      message: expect.stringContaining('ends before it starts'),
    });
    expect(frames('delete-3..go')).toMatchObject({
      code: 'INVALID_SELECTOR',
    });
    // Neighbouring sections share the frame between them.
    expect(frames('delete-3..insert-5')).toEqual({ from: 4, to: 4 });
  });

  it('lists the sections and step names when a name matches nothing', () => {
    const error = frames('relax');
    expect(error).toMatchObject({ code: 'NO_MATCH', path: '$' });
    const { hint } = error as { hint: string };
    expect(hint).toContain('Sections: insert-5, delete-3.');
    expect(hint).toContain('Step names: go, right, no-left.');
  });

  it('says how many steps have a name when #n is too large', () => {
    expect(frames('right#2')).toMatchObject({
      code: 'NO_MATCH',
      message: 'There is only 1 step named "right"',
    });
    expect(frames('go#5')).toMatchObject({
      message: 'There are only 4 steps named "go"',
    });
  });

  it('lists a section’s step names when it has no such step', () => {
    expect(frames('insert-5/no-left')).toMatchObject({
      code: 'NO_MATCH',
      message: 'Section "insert-5" has no step named "no-left"',
      hint: 'Step names in "insert-5": go, right.',
    });
    expect(frames('insert-5/go#3')).toMatchObject({
      message: 'Section "insert-5" has only 2 steps named "go"',
    });
  });

  it('lists the sections when a section does not exist', () => {
    expect(frames('pop/go')).toMatchObject({
      code: 'NO_MATCH',
      message: 'There is no section "pop"',
      hint: 'Sections: insert-5, delete-3.',
    });
  });

  it('says when a document has no names at all', () => {
    const plain = docOf([undefined, undefined]);
    const result = selectFrames(plain, 'go');
    expect(result).toMatchObject({
      ok: false,
      error: {
        hint: 'The document has no sections and its steps have no names; use a frame number from 0 to 2.',
      },
    });
  });

  it('keeps long lists short', () => {
    const many = docOf(Array.from({ length: 100 }, (_, k) => `s${k}`));
    const result = selectFrames(many, 'nope');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.hint).toContain('s29, …');
      expect(result.error.hint).not.toContain('s30');
    }
  });
});

describe('selectFrame', () => {
  it('gives one frame', () => {
    expect(selectFrame(doc, 'go#2')).toEqual({ ok: true, value: 3 });
    expect(selectFrame(doc, -1)).toEqual({ ok: true, value: 7 });
    expect(selectFrame(doc, '4..4')).toEqual({ ok: true, value: 4 });
  });

  it('rejects a range of several frames, naming its ends', () => {
    const result = selectFrame(doc, 'insert-5');
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_SELECTOR',
        message: '"insert-5" is frames 1 to 4, not one frame',
      },
    });
    if (!result.ok) expect(result.error.hint).toContain('insert-5/');
  });
});

describe('stepNameAt and sectionAt', () => {
  it('give the name and section of the step that produced a frame', () => {
    expect(stepNameAt(doc, 0)).toBeUndefined();
    expect(stepNameAt(doc, 1)).toBeUndefined();
    expect(stepNameAt(doc, 2)).toBe('go');
    expect(stepNameAt(doc, 6)).toBe('no-left');
    expect(sectionAt(doc, 0)).toBeUndefined();
    expect(sectionAt(doc, 1)).toBeUndefined();
    expect(sectionAt(doc, 2)?.id).toBe('insert-5');
    // The frame before a section's first step ends the section before it.
    expect(sectionAt(doc, 4)?.id).toBe('insert-5');
    expect(sectionAt(doc, 5)?.id).toBe('delete-3');
    expect(sectionAt(doc, 7)?.id).toBe('delete-3');
  });
});

describe('selectorOf', () => {
  it('gives the most specific selector of a frame', () => {
    expect(selectorOf(doc, 0)).toBe('0');
    expect(selectorOf(doc, 1)).toBe('1');
    expect(selectorOf(doc, 2)).toBe('insert-5/go');
    expect(selectorOf(doc, 3)).toBe('insert-5/go#2');
    expect(selectorOf(doc, 7)).toBe('delete-3/go#2');
    const plain = docOf(['go', 'go']);
    expect(selectorOf(plain, 2)).toBe('go#2');
  });
});

describe('selectSeries', () => {
  const series = (...selectors: (string | number)[]) => {
    const result = selectSeries(doc, selectors);
    return result.ok ? result.value : result.error;
  };

  it('gives every frame without selectors', () => {
    expect(series()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('joins frames and ranges in timeline order, without repeats', () => {
    expect(series('go#2')).toEqual([3]);
    expect(series('delete-3/go#2', 'insert-5/go', -1)).toEqual([2, 7]);
    expect(series('delete-3', 0)).toEqual([0, 4, 5, 6, 7]);
    expect(series('insert-5', 'go#2..5')).toEqual([1, 2, 3, 4, 5]);
    expect(series(3, '3', 'go#2')).toEqual([3]);
    expect(series('0..-1')).toEqual(series());
  });

  it('stops at the first selector that fails, with its error', () => {
    expect(series('go', 'nope', 99)).toMatchObject({
      code: 'NO_MATCH',
      message: 'No section or step is named "nope"',
    });
    expect(series(1, 99)).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(series('go,relax')).toMatchObject({ code: 'INVALID_SELECTOR' });
  });
});

// Generated documents, against a brute-force reading of ADR 0020.

const NAMES = ['go', 'relax', 'swap'] as const;
const SECTION_IDS = ['s-a', 's-b', 's-c', 'relax'] as const;

const documents = fc
  .array(fc.option(fc.constantFrom(...NAMES), { nil: undefined }), {
    minLength: 1,
    maxLength: 30,
  })
  .chain((names) =>
    fc.uniqueArray(fc.nat(names.length - 1), { maxLength: 4 }).map((starts) => {
      const sorted = starts.toSorted((a, b) => a - b);
      const sections = sorted.map((start, k) => ({
        id: SECTION_IDS[k]!,
        title: `Section ${k}`,
        start,
      }));
      return docOf(names, sections);
    }),
  );

/** Frames where step `name` ends, within steps [lo, hi). */
function namedFrames(d: Selectable, name: string, lo = 0, hi = d.steps.length) {
  const out: number[] = [];
  for (let s = lo; s < hi; s++)
    if (d.steps[s]!.meta?.id === name) out.push(s + 1);
  return out;
}

function sectionBounds(d: Selectable, id: string) {
  const list = d.sections ?? [];
  const k = list.findIndex((s) => s.id === id);
  if (k < 0) return undefined;
  return { lo: list[k]!.start, hi: list[k + 1]?.start ?? d.steps.length };
}

const params = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 60),
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

describe('selectors on generated documents', () => {
  it('agree with a brute-force reading of every selector form', () => {
    fc.assert(
      fc.property(
        documents,
        fc.constantFrom(...NAMES, ...SECTION_IDS),
        fc.constantFrom(...SECTION_IDS),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: -40, max: 40 }),
        (d, name, section, nth, frame) => {
          const length = d.steps.length;
          const got = (s: string) => {
            const r = selectFrames(d, s);
            return r.ok ? r.value : undefined;
          };

          // Frame numbers.
          const index = frame < 0 ? length + 1 + frame : frame;
          const inRange = index >= 0 && index <= length;
          expect(got(String(frame))).toEqual(
            inRange ? { from: index, to: index } : undefined,
          );

          // name#n, and section/name#n.
          const all = namedFrames(d, name);
          const nthFrame = all[nth - 1];
          expect(got(`${name}#${nth}`)).toEqual(
            nthFrame === undefined
              ? undefined
              : { from: nthFrame, to: nthFrame },
          );
          const bounds = sectionBounds(d, section);
          const inside =
            bounds === undefined
              ? []
              : namedFrames(d, name, bounds.lo, bounds.hi);
          const insideFrame = inside[nth - 1];
          expect(got(`${section}/${name}#${nth}`)).toEqual(
            insideFrame === undefined
              ? undefined
              : { from: insideFrame, to: insideFrame },
          );

          // A bare name: a section if there is one, else the first step.
          const asSection = sectionBounds(d, name);
          const bare = got(name);
          if (asSection !== undefined)
            expect(bare).toEqual({ from: asSection.lo, to: asSection.hi });
          else
            expect(bare).toEqual(
              all[0] === undefined ? undefined : { from: all[0], to: all[0] },
            );

          // Ranges join the two ends when both exist and are in order.
          const a = got(`${name}#${nth}`);
          const b = got(String(frame));
          const joined = got(`${name}#${nth}..${frame}`);
          if (a === undefined || b === undefined || a.from > b.to)
            expect(joined).toBeUndefined();
          else expect(joined).toEqual({ from: a.from, to: b.to });

          // Every frame's own selector names exactly that frame.
          for (let f = 0; f <= length; f++)
            expect(got(selectorOf(d, f))).toEqual({ from: f, to: f });

          // Sections tile the frames from the first section to the end.
          const list = d.sections ?? [];
          list.forEach((s, k) => {
            const range = got(s.id)!;
            expect(range.from).toBe(s.start);
            expect(range.to).toBe(list[k + 1]?.start ?? length);
            for (let f = range.from + 1; f <= range.to; f++)
              expect(sectionAt(d, f)?.id).toBe(s.id);
          });
        },
      ),
      params,
    );
  });
});

describe('series on generated documents', () => {
  it('are the union of what each selector names, in order', () => {
    const selectors = fc.array(
      fc.oneof(
        fc.constantFrom(...NAMES, ...SECTION_IDS),
        fc
          .tuple(fc.constantFrom(...NAMES), fc.integer({ min: 1, max: 4 }))
          .map(([name, nth]) => `${name}#${nth}`),
        fc.integer({ min: -35, max: 35 }),
        fc
          .tuple(
            fc.integer({ min: 0, max: 30 }),
            fc.integer({ min: -30, max: -1 }),
          )
          .map(([a, b]) => `${a}..${b}`),
      ),
      { maxLength: 5 },
    );
    fc.assert(
      fc.property(documents, selectors, (d, list) => {
        const result = selectSeries(d, list);
        const ranges = list.map((s) => selectFrames(d, s));
        const failed = ranges.find((r) => !r.ok);
        if (failed !== undefined) {
          expect(result).toEqual(failed);
          return;
        }
        if (!result.ok) throw new Error('expected a series');
        const want = new Set<number>();
        if (list.length === 0)
          for (let f = 0; f <= d.steps.length; f++) want.add(f);
        for (const r of ranges)
          if (r.ok)
            for (let f = r.value.from; f <= r.value.to; f++) want.add(f);
        expect(result.value).toEqual([...want].toSorted((a, b) => a - b));
      }),
      params,
    );
  });
});
