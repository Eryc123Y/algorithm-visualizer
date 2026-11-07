/**
 * The committed plugin, run by Node's WebAssembly as Typst runs it, with the
 * engine bytecode built from this checkout (ADR 0026). Its SVG must be the
 * SVG of `exportFigures`, byte for byte.
 */
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';

import { algorithms, runAlgorithm } from '@algoviz/recipes';
import { exportFigures, themes, type ThemeName } from '@algoviz/svg';

import type { Response } from '../src/engine.ts';
import { buildEngine } from '../scripts/engine.ts';
import { instantiatePlugin, type PluginInstance } from '../scripts/host.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const themeNames = Object.keys(themes) as ThemeName[];

let plugin: Uint8Array<ArrayBuffer>;
let bytecode: Uint8Array;
let engine: PluginInstance;

/** A plugin instance with the engine loaded, as after `plugin.transition`. */
async function loaded(): Promise<PluginInstance> {
  const instance = await instantiatePlugin(plugin);
  instance.call('load', bytecode);
  return instance;
}

function render(instance: PluginInstance, request: unknown): Response {
  const output = instance.call(
    'render',
    encoder.encode(JSON.stringify(request)),
  );
  return JSON.parse(decoder.decode(output)) as Response;
}

/** The SVG of each figure `algoviz export` draws for a run. */
function exportedSvg(
  id: string,
  input: unknown,
  steps: readonly (string | number)[],
  theme: ThemeName,
): string[] {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  const series = exportFigures(run.value.document, { steps, theme });
  if (!series.ok) throw new Error(JSON.stringify(series.error));
  return series.value.figures.map((f) => f.svg);
}

function svgOf(response: Response): string[] {
  if (!response.ok) throw new Error(JSON.stringify(response.diagnostics));
  return response.figures.map((f) => f.svg);
}

beforeAll(async () => {
  ({ plugin, bytecode } = await buildEngine());
  engine = await loaded();
});

describe('the plugin', () => {
  it('imports only the protocol and exports compile, load and render', async () => {
    const module = await WebAssembly.compile(plugin);
    expect(
      WebAssembly.Module.imports(module)
        .map((i) => `${i.module}.${i.name}`)
        .toSorted(),
    ).toEqual([
      'typst_env.wasm_minimal_protocol_send_result_to_host',
      'typst_env.wasm_minimal_protocol_write_args_to_buffer',
    ]);
    expect(
      WebAssembly.Module.exports(module)
        .map((e) => e.name)
        .toSorted(),
    ).toEqual(['compile', 'load', 'memory', 'render']);
  });

  it('draws every registry example in every theme as exportFigures does', () => {
    for (const algorithm of algorithms)
      for (const input of algorithm.examples)
        for (const theme of themeNames)
          expect(
            svgOf(render(engine, { algorithm: algorithm.id, input, theme })),
            `${algorithm.id} in ${theme}`,
          ).toEqual(exportedSvg(algorithm.id, input, [], theme));
  });

  it('draws one step', () => {
    const input = algorithms.find((a) => a.id === 'dijkstra')!.examples[0];
    expect(
      svgOf(render(engine, { algorithm: 'dijkstra', input, step: 'relax#3' })),
    ).toEqual(exportedSvg('dijkstra', input, ['relax#3'], 'light'));
  });

  it('draws a document', () => {
    const run = runAlgorithm('bst.delete', { from: [8, 3, 10, 1, 6], key: 3 });
    if (!run.ok) throw new Error('run');
    const response = render(engine, {
      document: run.value.document,
      steps: [0, -1],
      theme: 'print',
    });
    const series = exportFigures(run.value.document, {
      steps: [0, -1],
      theme: 'print',
    });
    if (!series.ok) throw new Error(JSON.stringify(series.error));
    expect(response).toEqual({ ok: true, ...series.value });
  });

  it('draws the same from its cache as a fresh instance', async () => {
    const input = algorithms.find((a) => a.id === 'dijkstra')!.examples[0];
    const requests = [
      { algorithm: 'dijkstra', input, step: 'relax#2' },
      { algorithm: 'dijkstra', input, steps: ['relax#1', -1] },
      { algorithm: 'dijkstra', input, step: 'relax#2' },
    ];
    for (const request of requests)
      expect(render(engine, request)).toEqual(render(await loaded(), request));
  });

  it('reports errors as diagnostics', () => {
    const codes = (request: unknown) => {
      const response = render(engine, request);
      return response.ok ? [] : response.diagnostics.map((d) => d.code);
    };
    expect(codes({ algorithm: 'nope', input: {} })).toEqual([
      'UNKNOWN_ALGORITHM',
    ]);
    expect(codes({ algorithm: 'bst.delete', input: { from: 1 } })).toContain(
      'INVALID_SHAPE',
    );
    expect(
      codes({
        algorithm: 'bst.delete',
        input: { from: [1], key: 1 },
        step: 'x',
      }),
    ).toEqual(['NO_MATCH']);
    expect(
      codes({
        algorithm: 'bst.delete',
        input: { from: [1], key: 1 },
        theme: 'x',
      }),
    ).toEqual(['UNKNOWN_THEME']);
    expect(codes({ steps: [] })).toEqual(['INVALID_REQUEST']);
    const response = engine.call('render', encoder.encode('{'));
    expect(JSON.parse(decoder.decode(response))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'INVALID_JSON' }],
    });
  });

  it('stops deep recursion with a RangeError, not a trap', async () => {
    // A probe in place of the engine: it recurses n levels and reports
    // whether QuickJS stopped it. Typst's wasmi traps at about 750 levels,
    // so QuickJS must stop recursion before that (tests/typst runs the same
    // probe in Typst).
    const instance = await instantiatePlugin(plugin);
    const probe = `globalThis.renderRequest = (text) => {
      const f = (k) => (k === 0 ? 0 : 1 + f(k - 1));
      try { return String(f(JSON.parse(text))); } catch (e) { return String(e); }
    };`;
    instance.call('load', instance.call('compile', encoder.encode(probe)));
    const depth = (n: number) =>
      decoder.decode(instance.call('render', encoder.encode(String(n))));
    expect(depth(500)).toBe('500');
    expect(depth(5000)).toBe('RangeError: Maximum call stack size exceeded');
    expect(depth(500)).toBe('500');
  });

  it('sees a clock that always reads 0, so random numbers repeat', async () => {
    const probe = `globalThis.renderRequest = () =>
      JSON.stringify([Date.now(), Math.random(), Math.random()]);`;
    const run = async () => {
      const instance = await instantiatePlugin(plugin);
      instance.call('load', instance.call('compile', encoder.encode(probe)));
      return JSON.parse(
        decoder.decode(instance.call('render', encoder.encode('{}'))),
      ) as number[];
    };
    const first = await run();
    expect(first[0]).toBe(0);
    expect(await run()).toEqual(first);
  });

  it('refuses to render before the engine is loaded', async () => {
    const bare = await instantiatePlugin(plugin);
    expect(() => bare.call('render', encoder.encode('{}'))).toThrow(
      'the engine is not loaded',
    );
  });

  it('refuses bytecode that is not an engine', async () => {
    const bare = await instantiatePlugin(plugin);
    expect(() => bare.call('load', encoder.encode('not bytecode'))).toThrow();
    const other = bare.call('compile', encoder.encode('export const x = 1;'));
    expect(() => bare.call('load', other)).toThrow('renderRequest');
  });

  it('reports source that does not compile', async () => {
    const bare = await instantiatePlugin(plugin);
    expect(() => bare.call('compile', encoder.encode('let = ;'))).toThrow(
      'variable name expected',
    );
  });
});

const params = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 30),
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

describe('generated requests', () => {
  const examples = algorithms.flatMap((a) =>
    a.examples.map((input) => ({ id: a.id, input })),
  );

  it('draw what exportFigures draws, frame numbers in any order', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...examples),
        fc.constantFrom(...themeNames),
        fc.array(fc.integer({ min: -4, max: 12 }), { maxLength: 4 }),
        ({ id, input }, theme, picks) => {
          const run = runAlgorithm(id, input);
          if (!run.ok) throw new Error(id);
          const frames = run.value.document.steps.length + 1;
          const steps = picks.filter((p) => p >= -frames && p < frames);
          expect(
            svgOf(render(engine, { algorithm: id, input, steps, theme })),
          ).toEqual(exportedSvg(id, input, steps, theme));
        },
      ),
      params,
    );
  });
});
