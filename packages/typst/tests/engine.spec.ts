import { describe, expect, it } from 'vitest';

import { algorithms, runAlgorithm } from '@algoviz/recipes';
import { exportFigures } from '@algoviz/svg';

import { createEngine, respond, type Response } from '../src/engine.ts';

const dijkstra = algorithms.find((a) => a.id === 'dijkstra')!.examples[0];
const bst = { from: [8, 3, 10, 1, 6], key: 3 };

/** What `algoviz export` draws for an algorithm and its input. */
function exported(
  id: string,
  input: unknown,
  options: Parameters<typeof exportFigures>[1] = {},
) {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  const series = exportFigures(run.value.document, options);
  if (!series.ok) throw new Error(JSON.stringify(series.error));
  return series.value;
}

function figures(response: Response) {
  if (!response.ok) throw new Error(JSON.stringify(response.diagnostics));
  return response.figures;
}

function codes(response: Response) {
  return response.ok ? [] : response.diagnostics.map((d) => [d.code, d.path]);
}

describe('createEngine', () => {
  it('draws every frame of an algorithm run, as algoviz export does', () => {
    const response = createEngine().render({
      algorithm: 'dijkstra',
      input: dijkstra,
    });
    const series = exported('dijkstra', dijkstra);
    expect(response).toEqual({ ok: true, ...series });
  });

  it('draws the frames that steps select, in a theme', () => {
    const response = createEngine().render({
      algorithm: 'bst.delete',
      input: bst,
      steps: [-1, 0],
      theme: 'dark',
    });
    expect(response).toEqual({
      ok: true,
      ...exported('bst.delete', bst, { steps: [0, -1], theme: 'dark' }),
    });
  });

  it('draws the one frame that step names', () => {
    const series = exported('dijkstra', dijkstra, { steps: ['relax#3'] });
    expect(
      createEngine().render({
        algorithm: 'dijkstra',
        input: dijkstra,
        step: 'relax#3',
      }),
    ).toEqual({ ok: true, ...series });
  });

  it('draws a document', () => {
    const run = runAlgorithm('bst.delete', bst);
    if (!run.ok) throw new Error('run');
    const response = createEngine().render({
      document: run.value.document,
      step: 2,
    });
    expect(figures(response)).toEqual(
      exported('bst.delete', bst, { steps: [2] }).figures,
    );
  });

  it("gives each figure its step's narration", () => {
    const [first, second] = figures(
      createEngine().render({ algorithm: 'bst.delete', input: bst }),
    );
    expect(first!.narration).toBeUndefined();
    expect(second!.narration).toEqual(expect.any(String));
  });

  it('draws the same figures from its cache as when cold', () => {
    const warm = createEngine();
    const requests = [
      { algorithm: 'dijkstra', input: dijkstra, step: 'relax#3' },
      { algorithm: 'bst.delete', input: bst, steps: [1, 2] },
      { algorithm: 'dijkstra', input: dijkstra, steps: ['relax#1', -1] },
      { algorithm: 'dijkstra', input: dijkstra, step: 'relax#3' },
      { algorithm: 'dijkstra', input: dijkstra, step: 0, theme: 'print' },
    ];
    for (const request of requests)
      expect(warm.render(request)).toEqual(createEngine().render(request));
  });

  it('keeps at most its cache size of documents, the most recent', () => {
    const engine = createEngine(2);
    const keys = (key: number) => ({
      algorithm: 'bst.delete',
      input: { ...bst, key },
    });
    engine.render(keys(3));
    engine.render(keys(8));
    expect(engine.cached).toBe(2);
    engine.render(keys(3)); // 3 is now the most recent
    engine.render(keys(10)); // evicts 8
    expect(engine.cached).toBe(2);
    expect(engine.render(keys(8))).toEqual(createEngine().render(keys(8)));
  });

  it('caches by source and theme, not by the steps asked for', () => {
    const engine = createEngine();
    engine.render({ algorithm: 'bst.delete', input: bst, step: 1 });
    engine.render({ algorithm: 'bst.delete', input: bst, steps: [2, 3] });
    engine.render({ algorithm: 'bst.delete', input: bst, theme: 'light' });
    expect(engine.cached).toBe(1);
    engine.render({ algorithm: 'bst.delete', input: bst, theme: 'dark' });
    expect(engine.cached).toBe(2);
  });

  it('does not cache failures', () => {
    const engine = createEngine();
    engine.render({ algorithm: 'bst.delete', input: { from: 'x' } });
    engine.render({ algorithm: 'bst.delete', input: bst, theme: 'neon' });
    expect(engine.cached).toBe(0);
  });
});

describe('errors', () => {
  const render = (request: unknown) => codes(createEngine().render(request));

  it('reports the engine diagnostics', () => {
    expect(render({ algorithm: 'dijkstr', input: {} })).toEqual([
      ['UNKNOWN_ALGORITHM', '$.id'],
    ]);
    expect(
      render({ algorithm: 'bst.delete', input: { from: [1], key: 'a' } }),
    ).toEqual([['INVALID_SHAPE', '$.input.key']]);
    expect(
      render({ algorithm: 'bst.delete', input: bst, theme: 'neon' }),
    ).toEqual([['UNKNOWN_THEME', '$.theme']]);
    expect(render({ document: { version: '0.2' } })[0]).toEqual([
      'INVALID_SHAPE',
      '$.structures',
    ]);
  });

  it('reports selectors that name nothing, or several frames for one', () => {
    const response = createEngine().render({
      algorithm: 'dijkstra',
      input: dijkstra,
      step: 'relax#99',
    });
    expect(response).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'NO_MATCH', path: '$' }],
    });
    if (!response.ok) expect(response.diagnostics[0]!.hint).toContain('relax');
    expect(
      render({ algorithm: 'dijkstra', input: dijkstra, step: '1..3' }),
    ).toEqual([['INVALID_SELECTOR', '$']]);
    expect(
      render({ algorithm: 'dijkstra', input: dijkstra, steps: [99] }),
    ).toEqual([['OUT_OF_RANGE', '$']]);
  });

  it('reports a malformed request', () => {
    expect(render({ input: bst })).toEqual([['INVALID_REQUEST', '$']]);
    expect(render({ algorithm: 'bst.delete', document: {} })).toEqual([
      ['INVALID_REQUEST', '$'],
    ]);
    expect(render({ document: {}, input: {} })).toEqual([
      ['INVALID_REQUEST', '$.input'],
    ]);
    expect(render({ algorithm: 'bst.delete', step: 1, steps: [1] })).toEqual([
      ['INVALID_REQUEST', '$'],
    ]);
    expect(render({ algorithm: 'bst.delete', step: 1.5 })).toEqual([
      ['INVALID_REQUEST', '$.step'],
    ]);
    expect(render({ algorithm: 'bst.delete', theme: 3 })).toEqual([
      ['INVALID_REQUEST', '$.theme'],
    ]);
    expect(render({ algorithm: 'bst.delete', stpe: 1 })).toEqual([
      ['INVALID_REQUEST', '$'],
    ]);
    expect(render([])).toEqual([['INVALID_REQUEST', '$']]);
  });
});

describe('respond', () => {
  it('answers JSON text with JSON text', () => {
    const engine = createEngine();
    const request = { algorithm: 'bst.delete', input: bst, step: 1 };
    expect(JSON.parse(respond(engine, JSON.stringify(request)))).toEqual(
      engine.render(request),
    );
  });

  it('reports an exception inside the engine as a diagnostic', () => {
    const broken = {
      cached: 0,
      render(): never {
        throw new RangeError('Maximum call stack size exceeded');
      },
    };
    expect(JSON.parse(respond(broken, '{}'))).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'ENGINE_ERROR',
          path: '$',
          message: 'Maximum call stack size exceeded',
        },
      ],
    });
  });

  it('reports text that is not JSON', () => {
    expect(JSON.parse(respond(createEngine(), '{'))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'INVALID_JSON', path: '$' }],
    });
  });
});
