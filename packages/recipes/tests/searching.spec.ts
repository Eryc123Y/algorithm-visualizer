/**
 * `binary-search` against an independent reference, Array.prototype
 * methods, and the halving bound. `properties.spec.ts` runs it on random
 * inputs.
 */
import { describe, expect, it } from 'vitest';

import { replay, runError, runOk, stateOf } from './helpers.ts';

const ids = (values: readonly number[], target: number) =>
  runOk('binary-search', { values, target }).document.steps.map(
    (s) => s.meta?.id,
  );

describe('binary-search', () => {
  const sorted = [1, 3, 4, 7, 9, 11, 15];

  it.each([...sorted, 0, 5, 16].map((t) => [t]))('looks for %i', (target) => {
    const { document } = runOk('binary-search', { values: sorted, target });
    const a = stateOf(replay(document), 'a', 'array');
    const found = sorted.indexOf(target);
    expect(a.marks.settled).toEqual(found < 0 ? [] : [`e${found}`]);
    expect(document.steps.at(-1)?.meta?.id).toBe(
      found < 0 ? 'missing' : 'found',
    );
    // Each look halves the range: at most ⌈log2(n + 1)⌉ of them.
    const looks = ids(sorted, target).filter((id) => id === 'mid');
    expect(looks.length).toBeLessThanOrEqual(
      Math.ceil(Math.log2(sorted.length + 1)),
    );
  });

  it('removes the hi pointer when the range falls off the left end', () => {
    const { document } = runOk('binary-search', {
      values: sorted,
      target: 0,
    });
    const pointers = stateOf(replay(document), 'a', 'array').marks.pointers;
    expect(pointers).toEqual({ lo: 0 });
  });

  it('finds one of several equal values', () => {
    const values = [2, 2, 2, 2, 5];
    const { document } = runOk('binary-search', { values, target: 2 });
    const a = stateOf(replay(document), 'a', 'array');
    const [settled] = a.marks.settled;
    expect(a.data.find((e) => e.id === settled)?.value).toBe(2);
  });

  it('follows the range lo..hi the code keeps', () => {
    const { document } = runOk('binary-search', {
      values: sorted,
      target: 6,
    });
    const trace = replay(document);
    const pointers = stateOf(trace, 'a', 'array').marks.pointers;
    // 6 falls between 4 (index 2) and 7 (index 3).
    expect(pointers).toMatchObject({ lo: 3, hi: 2 });
  });

  it('refuses values that are not sorted, naming the first pair out of order', () => {
    expect(
      runError('binary-search', { values: [1, 5, 3, 7], target: 3 }),
    ).toEqual({
      code: 'INVALID_ARGUMENT',
      path: '$.input',
      message: 'The values must be sorted: 5 at position 1 comes before 3',
    });
  });

  it('takes 1 to 32 finite numbers and a finite target', () => {
    for (const values of [[], Array.from({ length: 33 }, () => 1)])
      expect(runError('binary-search', { values, target: 1 })).toMatchObject({
        code: 'INVALID_SHAPE',
        path: '$.input.values',
      });
    expect(
      runError('binary-search', { values: [1], target: Number.NaN }).path,
    ).toBe('$.input.target');
  });
});
