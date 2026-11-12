import { describe, expect, it } from 'vitest';

import {
  AnchorName,
  LIMITS,
  minimumVersion,
  parseVisualization,
  type VisualizationInput,
} from '../src/index.ts';

const PSEUDOCODE = 'SWAP(a, i, j)\n    exchange a[i] with a[j]';
const PYTHON =
  'def swap(a, i, j):\n    # exchange\n    a[i], a[j] = a[j], a[i]';

const sources = [
  { language: 'pseudocode', code: PSEUDOCODE, anchors: { swap: 2 } },
  { language: 'python', code: PYTHON, anchors: { swap: 3 } },
];

type Meta = NonNullable<VisualizationInput['steps'][number]['meta']>;

const step = (meta?: Meta) => ({
  actions: [],
  ...(meta === undefined ? {} : { meta }),
});

const doc = (extra: Record<string, unknown> = {}) => ({
  version: '0.3',
  structures: { a: { kind: 'array', initial: [1, 2] } },
  steps: [step({ at: 'swap' }), step({ narration: 'Done.' })],
  sources,
  ...extra,
});

const errorsOf = (input: unknown) => {
  const result = parseVisualization(input);
  return result.ok
    ? []
    : result.error.map(({ code, path }) => ({ code, path }));
};

const messagesOf = (input: unknown) => {
  const result = parseVisualization(input);
  return result.ok ? [] : result.error.map((e) => `${e.message} ${e.hint}`);
};

describe('sources (ADR 0017)', () => {
  it('are carried into the canonical form with anchors and meta.at', () => {
    const result = parseVisualization(doc());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sources).toEqual(sources);
    expect(result.value.source).toBeUndefined();
    expect(result.value.steps[0]?.meta?.at).toBe('swap');
  });

  it('may hold a single language', () => {
    expect(errorsOf(doc({ sources: sources.slice(1) }))).toEqual([]);
  });

  it('may leave a step without an anchor, and sources without anchors', () => {
    const plain = sources.map((s) => ({ ...s, anchors: {} }));
    expect(
      errorsOf(doc({ sources: plain, steps: [step({ narration: 'x' })] })),
    ).toEqual([]);
  });

  it('need at least one source, and a language and anchors in each', () => {
    expect(errorsOf(doc({ sources: [] }))).toEqual([
      { code: 'INVALID_SHAPE', path: '$.sources' },
    ]);
    expect(
      errorsOf(doc({ sources: [{ code: 'x', anchors: {} }], steps: [] })),
    ).toEqual([{ code: 'INVALID_SHAPE', path: '$.sources[0].language' }]);
    expect(
      errorsOf(
        doc({ sources: [{ language: 'python', code: 'x' }], steps: [] }),
      ),
    ).toEqual([{ code: 'INVALID_SHAPE', path: '$.sources[0].anchors' }]);
  });

  it('reject two sources in one language', () => {
    expect(errorsOf(doc({ sources: [sources[1], sources[1]] }))).toEqual([
      { code: 'DUPLICATE_LANGUAGE', path: '$.sources[1].language' },
    ]);
  });

  it('reject a document that gives both source and sources', () => {
    expect(errorsOf(doc({ source: { code: 'x' } }))).toEqual([
      { code: 'MIXED_SOURCES', path: '$.sources' },
    ]);
  });

  it('reject an anchor past the end of its code', () => {
    const [pseudo, python] = sources;
    const far = { ...python!, anchors: { swap: 3, end: 4 } };
    expect(errorsOf(doc({ sources: [pseudo, far] }))).toEqual([
      { code: 'LINE_OUT_OF_RANGE', path: '$.sources[1].anchors.end' },
    ]);
    expect(messagesOf(doc({ sources: [pseudo, far] }))[0]).toContain('python');
  });

  it('reject anchor names that are not kebab-case or that are object properties', () => {
    for (const name of ['Swap', 'swap_2', '2-swap', 'a'.repeat(41)]) {
      expect(AnchorName.safeParse(name).success).toBe(false);
      const bad = [{ ...sources[1]!, anchors: { [name]: 1 } }];
      expect(errorsOf(doc({ sources: bad, steps: [] }))).toEqual([
        {
          code: 'INVALID_SHAPE',
          path: `$.sources[0].anchors${/^[A-Za-z_]\w*$/.test(name) ? `.${name}` : `[${JSON.stringify(name)}]`}`,
        },
      ]);
    }
    expect(AnchorName.safeParse('constructor').success).toBe(false);
  });

  it('reject a __proto__ anchor, which JSON parsing would otherwise drop', () => {
    const input = JSON.parse(
      JSON.stringify(doc({ steps: [] })).replace(
        '"anchors":{"swap":3}',
        '"anchors":{"swap":3,"__proto__":1}',
      ),
    ) as unknown;
    expect(errorsOf(input)).toEqual([
      { code: 'INVALID_SHAPE', path: '$.sources[1].anchors.__proto__' },
    ]);
  });

  it(`hold at most ${LIMITS.sources} languages and ${LIMITS.anchors} anchors each`, () => {
    const many = Array.from({ length: LIMITS.sources + 1 }, (_, k) => ({
      language: `lang${k}`,
      code: 'x',
      anchors: {},
    }));
    expect(errorsOf(doc({ sources: many, steps: [] }))).toEqual([
      { code: 'INVALID_SHAPE', path: '$.sources' },
    ]);
    const anchors = Object.fromEntries(
      Array.from({ length: LIMITS.anchors + 1 }, (_, k) => [`a${k}`, 1]),
    );
    expect(
      errorsOf(doc({ sources: [{ ...sources[1]!, anchors }], steps: [] })),
    ).toEqual([{ code: 'INVALID_SHAPE', path: '$.sources[0].anchors' }]);
  });
});

describe('meta.at', () => {
  it('must be an anchor of every source, naming the language that lacks it', () => {
    const [pseudo, python] = sources;
    const partial = [pseudo, { ...python!, anchors: {} }];
    expect(errorsOf(doc({ sources: partial }))).toEqual([
      { code: 'UNKNOWN_ANCHOR', path: '$.steps[0].meta.at' },
    ]);
    const [message] = messagesOf(doc({ sources: partial }));
    expect(message).toContain('"swap"');
    expect(message).toContain('python');
    expect(message).not.toContain('pseudocode source');
  });

  it('names every language that lacks it, and the anchors there are', () => {
    const none = sources.map((s) => ({ ...s, anchors: { other: 1 } }));
    const [message] = messagesOf(doc({ sources: none }));
    expect(message).toContain('pseudocode and python');
    expect(message).toContain('"other"');
  });

  it('is not looked up among inherited properties', () => {
    // A kebab-case name such as "constructor" must not find
    // Object.prototype.constructor.
    const input = doc({ steps: [step({ at: 'constructor' })] });
    expect(errorsOf(input)).toEqual([
      { code: 'INVALID_SHAPE', path: '$.steps[0].meta.at' },
    ]);
  });

  it('needs sources', () => {
    const withoutSources = { ...doc(), sources: undefined };
    expect(errorsOf(withoutSources)).toEqual([
      { code: 'UNKNOWN_ANCHOR', path: '$.steps[0].meta.at' },
    ]);
    expect(
      errorsOf(doc({ sources: undefined, source: { code: 'x' } })),
    ).toEqual([{ code: 'MIXED_SOURCES', path: '$.steps[0].meta.at' }]);
  });

  it('replaces meta.line: a line with sources is rejected', () => {
    expect(errorsOf(doc({ steps: [step({ line: 1 })] }))).toEqual([
      { code: 'MIXED_SOURCES', path: '$.steps[0].meta.line' },
    ]);
  });

  it('is a step name: lower-case kebab-case', () => {
    expect(errorsOf(doc({ steps: [step({ at: 'Swap' })] }))).toEqual([
      { code: 'INVALID_SHAPE', path: '$.steps[0].meta.at' },
    ]);
  });
});

describe('sources in 1.0 (ADR 0043)', () => {
  it('need no version beyond 1.0', () => {
    expect(minimumVersion(doc() as unknown as VisualizationInput)).toBe('1.0');
  });

  it('are read in a document of any 0.x version', () => {
    expect(errorsOf(doc({ version: '0.2' }))).toEqual([]);
  });

  it('are not needed for source and meta.line', () => {
    const old = {
      version: '0.1',
      source: { language: 'python', code: 'x = 1' },
      structures: { a: { kind: 'array', initial: [1] } },
      steps: [step({ line: 1 })],
    };
    expect(errorsOf(old)).toEqual([]);
  });
});
