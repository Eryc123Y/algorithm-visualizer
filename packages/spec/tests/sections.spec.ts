import { describe, expect, it } from 'vitest';

import {
  minimumVersion,
  parseVisualization,
  PROTOCOL_FEATURES,
  PROTOCOL_VERSIONS,
  StepName,
  type VisualizationInput,
} from '../src/index.ts';

const step = (id?: string) => ({
  actions: [],
  ...(id === undefined ? {} : { meta: { id } }),
});

const doc = (extra: Partial<VisualizationInput> = {}, steps = 3) => ({
  version: '0.2',
  structures: { a: { kind: 'array', initial: [1] } },
  steps: Array.from({ length: steps }, () => step()),
  ...extra,
});

const errorsOf = (input: unknown) => {
  const result = parseVisualization(input);
  return result.ok
    ? []
    : result.error.map(({ code, path }) => ({ code, path }));
};

describe('step names (meta.id)', () => {
  it.each(['relax', 'fixup-case-3', 'insert-5-2', 'a', 'x1', 'a'.repeat(40)])(
    'accepts %j',
    (id) => {
      expect(StepName.safeParse(id).success).toBe(true);
      const result = parseVisualization(doc({ steps: [step(id)] }));
      expect(result.ok && result.value.steps[0]?.meta?.id).toBe(id);
    },
  );

  it.each([
    '',
    'Relax',
    '3-way',
    '-relax',
    'relax-',
    'fix--up',
    'fix_up',
    'fix up',
    'relax#2',
    'a/b',
    'a..b',
    'a'.repeat(41),
  ])('rejects %j', (id) => {
    expect(StepName.safeParse(id).success).toBe(false);
    expect(errorsOf(doc({ steps: [step(id)] }))).toEqual([
      { code: 'INVALID_SHAPE', path: '$.steps[0].meta.id' },
    ]);
  });

  it('may repeat', () => {
    const result = parseVisualization(
      doc({ steps: [step('relax'), step('relax')] }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('sections', () => {
  const sections = [
    { id: 'insert-5', title: 'Insert 5', start: 0 },
    { id: 'delete-3', title: 'Delete 3', start: 2 },
  ];

  it('are carried into the canonical form', () => {
    const result = parseVisualization(doc({ sections }));
    expect(result.ok && result.value.sections).toEqual(sections);
  });

  it('may leave steps before the first section', () => {
    const later = [{ id: 'late', title: 'Late', start: 2 }];
    expect(parseVisualization(doc({ sections: later })).ok).toBe(true);
  });

  it('reports a start past the last step', () => {
    const out = [...sections, { id: 'pop', title: 'Pop', start: 3 }];
    expect(errorsOf(doc({ sections: out }))).toEqual([
      { code: 'SECTION_OUT_OF_RANGE', path: '$.sections[2].start' },
    ]);
    expect(errorsOf(doc({ sections: [sections[0]!] }, 0))).toEqual([
      { code: 'SECTION_OUT_OF_RANGE', path: '$.sections[0].start' },
    ]);
  });

  it('reports a start that is not after the previous one', () => {
    const swapped = [sections[1]!, sections[0]!];
    expect(errorsOf(doc({ sections: swapped }))).toEqual([
      { code: 'SECTION_OUT_OF_ORDER', path: '$.sections[1].start' },
    ]);
    const empty = [sections[0]!, { ...sections[1]!, start: 0 }];
    expect(errorsOf(doc({ sections: empty }))).toEqual([
      { code: 'SECTION_OUT_OF_ORDER', path: '$.sections[1].start' },
    ]);
  });

  it('reports an id used twice', () => {
    const twice = [sections[0]!, { ...sections[1]!, id: 'insert-5' }];
    expect(errorsOf(doc({ sections: twice }))).toEqual([
      { code: 'DUPLICATE_SECTION', path: '$.sections[1].id' },
    ]);
  });

  it('checks the shape of each section', () => {
    expect(
      errorsOf(doc({ sections: [{ id: 'Insert 5', title: '', start: -1 }] })),
    ).toEqual([
      { code: 'INVALID_SHAPE', path: '$.sections[0].id' },
      { code: 'INVALID_SHAPE', path: '$.sections[0].title' },
      { code: 'INVALID_SHAPE', path: '$.sections[0].start' },
    ]);
  });

  it('give hints that say how to fix them', () => {
    const result = parseVisualization(
      doc({ sections: [{ id: 'x', title: 'X', start: 7 }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error[0]?.hint).toContain('0 to 2');
  });
});

describe('protocol version 0.2', () => {
  it('is a version this package reads', () => {
    expect(PROTOCOL_VERSIONS).toContain('0.2');
  });

  it('dates step names and sections to 0.2', () => {
    expect(
      PROTOCOL_FEATURES.filter((f) => f.since === '0.2').map((f) => f.name),
    ).toEqual(['step names', 'sections']);
  });

  it('is what writers record for a document with step names or sections', () => {
    const plain = doc() as VisualizationInput;
    expect(minimumVersion(plain)).toBe('0.1');
    expect(minimumVersion({ ...plain, steps: [step('go')] })).toBe('0.2');
    expect(minimumVersion({ ...plain, sections: [] })).toBe('0.2');
  });

  it('is needed to read step names or sections', () => {
    const named = { ...doc({ steps: [step('go')] }), version: '0.1' };
    const sectioned = {
      ...doc({ sections: [{ id: 'a', title: 'A', start: 0 }] }),
      version: '0.1',
    };
    expect(errorsOf(named)).toEqual([
      { code: 'VERSION_TOO_OLD', path: '$.version' },
    ]);
    expect(errorsOf(sectioned)).toEqual([
      { code: 'VERSION_TOO_OLD', path: '$.version' },
    ]);
    const both = { ...sectioned, steps: [step('go')] };
    const result = parseVisualization(both);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveLength(1);
      expect(result.error[0]?.message).toContain('step names and sections');
      expect(result.error[0]?.hint).toBe('Set "version" to "0.2".');
    }
  });

  it('reports the version alongside other errors', () => {
    const input = {
      ...doc({ steps: [step('go')] }),
      version: '0.1',
      sections: [{ id: 'a', title: 'A', start: 5 }],
    };
    expect(errorsOf(input)).toEqual([
      { code: 'VERSION_TOO_OLD', path: '$.version' },
      { code: 'SECTION_OUT_OF_RANGE', path: '$.sections[0].start' },
    ]);
  });
});
