/** Code in several languages in the MCP tools (ADR 0017). */
import { describe, expect, it } from 'vitest';

import { formatInspect, inspect } from '../src/inspect.ts';
import { validate } from '../src/validate.ts';

const sources: {
  language: string;
  code: string;
  anchors: Record<string, number>;
}[] = [
  {
    language: 'pseudocode',
    code: 'SORT-TWO(a)\n    if a[0] > a[1]\n        exchange a[0] with a[1]',
    anchors: { compare: 2, swap: 3 },
  },
  {
    language: 'python',
    code: 'def sort_two(a):\n    if a[0] > a[1]:\n        # put them in order\n        a[0], a[1] = a[1], a[0]',
    anchors: { compare: 2, swap: 4 },
  },
];

const doc = (steps: object[], code = sources) => ({
  version: '1.0',
  sources: code,
  structures: { a: { kind: 'array', initial: [2, 1] } },
  steps,
});

const compare = {
  actions: [{ target: 'a', type: 'compare', i: 0, j: 1 }],
  meta: { id: 'compare', at: 'compare', narration: 'Compare 2 and 1.' },
};
const swap = {
  actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }],
  meta: { id: 'swap', at: 'swap', narration: 'Swap them.' },
};

const warnings = (input: unknown) => {
  const report = validate(input);
  return report.valid ? report.warnings : report.errors;
};

describe('validate with sources', () => {
  it('warns nothing about a document whose steps point at code lines', () => {
    expect(warnings(doc([compare, swap]))).toEqual([]);
  });

  it('warns when no step points at an anchor', () => {
    const plain = { actions: [], meta: { narration: 'Look.' } };
    expect(warnings(doc([plain]))).toMatchObject([
      { code: 'UNUSED_SOURCE', path: '$.sources' },
    ]);
  });

  it('warns about an anchor that steps use on a blank or comment-only line', () => {
    const [pseudo, python] = sources;
    const off = [
      pseudo!,
      {
        ...python!,
        code: `${python!.code}\n`,
        anchors: { compare: 3, swap: 5 },
      },
    ];
    expect(warnings(doc([compare, swap], off))).toMatchObject([
      { code: 'ANCHOR_NOT_ON_CODE', path: '$.sources[1].anchors.compare' },
      { code: 'ANCHOR_NOT_ON_CODE', path: '$.sources[1].anchors.swap' },
    ]);
  });

  it('reports a missing anchor with the language that lacks it', () => {
    const [pseudo, python] = sources;
    const report = validate(
      doc([swap], [pseudo!, { ...python!, anchors: { compare: 2 } }]),
    );
    expect(report.valid).toBe(false);
    if (report.valid) return;
    expect(report.errors[0]).toMatchObject({
      code: 'UNKNOWN_ANCHOR',
      path: '$.steps[0].meta.at',
    });
    expect(report.errors[0]?.message).toContain('python');
  });
});

describe('inspect with sources', () => {
  it("reports a frame's anchor and its line in every language", () => {
    const report = inspect(doc([compare, swap]), [1, 2]);
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(
      report.value.described.map(({ at, lines }) => ({ at, lines })),
    ).toEqual([
      { at: 'compare', lines: { pseudocode: 2, python: 2 } },
      { at: 'swap', lines: { pseudocode: 3, python: 4 } },
    ]);
    expect(formatInspect(report.value)).toContain(
      'at swap (pseudocode line 3, python line 4)',
    );
  });

  it('reports no anchor for the initial frame', () => {
    const report = inspect(doc([compare]), [0]);
    expect(report.ok && report.value.described[0]).not.toHaveProperty('at');
  });
});
