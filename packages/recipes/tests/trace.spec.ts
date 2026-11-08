import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  defineAlgorithm,
  defineStructure,
  listingTrace,
  Recorder,
  recordingTrace,
  runModule,
  silentTrace,
} from '../src/index.ts';
import { joinListings, listing } from '../src/snippet.ts';

const code = {
  pseudocode: 'SWAP(a)\n    exchange a[0] with a[1]  // @swap',
  python: 'def swap(a):\n    a[0], a[1] = a[1], a[0]  # @swap',
};

/** A recording trace over `code`, and the recorder behind it. */
function recording() {
  const { sources } = joinListings([listing('swap', code)]);
  const recorder = new Recorder({ sources });
  return { recorder, trace: recordingTrace(recorder, new Set(['swap'])) };
}

describe('recordingTrace', () => {
  it('starts steps at anchors, named after them unless told otherwise', () => {
    const { recorder, trace } = recording();
    const a = trace.add('a', { kind: 'array', initial: [2, 1] });
    trace.step('swap', 'Swap 2 and 1.', { vars: { i: 0 } });
    a.swap({ i: 0, j: 1 });
    trace.step('swap', 'Swap them back.', { id: 'undo' });
    a.swap({ i: 0, j: 1 });
    trace.step(null, 'Done.', { id: 'done' });
    expect(recorder.build().steps.map((s) => s.meta)).toEqual([
      { id: 'swap', at: 'swap', narration: 'Swap 2 and 1.', vars: { i: 0 } },
      { id: 'undo', at: 'swap', narration: 'Swap them back.' },
      { id: 'done', narration: 'Done.' },
    ]);
  });

  it('starts sections', () => {
    const { recorder, trace } = recording();
    trace.add('a', { kind: 'array', initial: [2, 1] });
    trace.section('first', 'First');
    trace.step('swap', 'Swap.');
    expect(recorder.build().sections).toEqual([
      { id: 'first', title: 'First', start: 0 },
    ]);
  });

  it('throws an Error, not a RangeError, for unknown anchors and empty narrations', () => {
    const { trace } = recording();
    const unknown = () => trace.step('swop', 'Swap.');
    expect(unknown).toThrow('No anchor "swop" in the code');
    expect(unknown).not.toThrow(RangeError);
    expect(() => trace.step('swap', ' ')).toThrow('A step needs a narration');
  });
});

describe('silentTrace', () => {
  it('records nothing, and its handles chain', () => {
    const trace = silentTrace();
    const a = trace.add('a', { kind: 'array', initial: [1] });
    expect(a.swap({ i: 0, j: 0 }).settle({ index: 0 })).toBe(a);
    trace.step('anything', 'Ignored.');
    trace.section('any', 'Ignored');
  });
});

describe('listingTrace', () => {
  const other = listing('other', {
    pseudocode: 'OTHER()\n    return  // @end',
    python: 'def other():\n    return  # @end',
  });

  it('prefixes anchors of joined listings, keeps the marker as the name, and runs `first` once', () => {
    const swap = listing('swap', code);
    const joined = joinListings([swap, other]);
    const recorder = new Recorder({ sources: joined.sources });
    const anchors = new Set(Object.keys(joined.sources[0]!.anchors));
    const base = recordingTrace(recorder, anchors);
    let cleared = 0;
    const trace = listingTrace(base, joined, other, () => (cleared += 1));
    trace.add('a', { kind: 'array', initial: [1] });
    trace.step('end', 'End.');
    trace.step('end', 'End again.');
    expect(cleared).toBe(1);
    expect(recorder.build().steps.map((s) => s.meta)).toEqual([
      { id: 'end', at: 'other-end', narration: 'End.' },
      { id: 'end', at: 'other-end', narration: 'End again.' },
    ]);
  });
});

describe('runModule', () => {
  const swap = defineAlgorithm({
    id: 'swap-two',
    title: 'Swap two',
    topic: 'sorting',
    summary: 'Swaps two values.',
    input: z.strictObject({ values: z.array(z.number()).length(2) }),
    examples: [{ values: [2, 1] }],
    code,
    run({ values }, trace) {
      if (values[0] === values[1]) throw new RangeError('Equal values');
      if (values[0] === 0) throw new TypeError('A bug');
      const a = trace.add('a', { kind: 'array', initial: values });
      trace.step('swap', 'Swap.');
      a.swap({ i: 0, j: 1 });
    },
  });

  it('records a run with the module’s title and code', () => {
    const run = runModule(swap, { values: [2, 1] });
    expect(run.ok && run.value.document.title).toBe('Swap two');
    expect(run.ok && run.value.results).toEqual([]);
    expect(run.ok && 'after' in run.value).toBe(false);
  });

  it('turns a RangeError into INVALID_ARGUMENT, and lets other errors through', () => {
    expect(runModule(swap, { values: [1, 1] })).toEqual({
      ok: false,
      error: [
        { code: 'INVALID_ARGUMENT', path: '$.input', message: 'Equal values' },
      ],
    });
    expect(() => runModule(swap, { values: [0, 1] })).toThrow(TypeError);
  });

  it('reports schema errors under $.input', () => {
    expect(runModule(swap, { values: [1] })).toMatchObject({
      ok: false,
      error: [{ code: 'INVALID_SHAPE', path: '$.input.values' }],
    });
    expect(runModule(swap, null)).toMatchObject({
      ok: false,
      error: [{ code: 'INVALID_SHAPE', path: '$.input' }],
    });
  });

  it('rejects code whose languages mark different anchors', () => {
    expect(() =>
      defineAlgorithm({
        ...swap,
        code: { pseudocode: 'SWAP(a)', python: code.python },
        run: () => undefined,
      }),
    ).toThrow(/@swap/);
  });
});

describe('defineStructure', () => {
  const structure = (operations: { name: string; args: z.ZodRawShape }[]) =>
    defineStructure({
      id: 'cell',
      title: 'Cell',
      topic: 'lists',
      summary: 'A cell.',
      name: 'cell',
      kind: 'array',
      from: z.array(z.number()),
      examples: [{ from: [], ops: [{ op: 'set' }] }],
      start: () => null,
      describe: () => [],
      declare: () => ({ kind: 'array', initial: [] }),
      clear: () => undefined,
      operations: operations.map((op) => ({
        ...op,
        title: op.name,
        summary: 'An operation.',
        examples: [{ from: [] }],
        code: listing('set', code),
        titleOf: () => op.name,
        apply: (state: null) => ({ state, result: null }),
      })),
    });

  it('rejects operations with clashing or reserved names', () => {
    expect(() => structure([{ name: 'set', args: {} }])).not.toThrow();
    expect(() =>
      structure([
        { name: 'set', args: {} },
        { name: 'set', args: {} },
      ]),
    ).toThrow('Operation "set" needs a distinct kebab-case name');
    expect(() => structure([{ name: 'Set', args: {} }])).toThrow(/kebab-case/);
    for (const key of ['op', 'from'])
      expect(() =>
        structure([{ name: 'set', args: { [key]: z.number() } }]),
      ).toThrow(`Operation "set" may not have an argument "${key}"`);
  });
});
