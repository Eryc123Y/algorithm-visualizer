/**
 * The four properties every recipe must have, shared by the property
 * tests: random inputs give a document that loads and replays the same at
 * any checkpoint interval, ends with the right answer, lays out every
 * frame inside one fixed-size scene, and renders to clean SVG.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace, type Scene, type Trace } from '@algoviz/core';
import { formatErrors, type VisualizationInput } from '@algoviz/spec';
import { renderSvg } from '@algoviz/svg';

export const runs = Number(process.env['FUZZ_RUNS'] ?? 40);

// The shared scene checks of @algoviz/core's tests, by relative path. A
// computed specifier keeps TypeScript from pulling core's sources into this
// project (TS6307); the cast restates the function's signature.
const sceneCheck = new URL('../../core/tests/scene-check.ts', import.meta.url);
const { fitProblems, sceneProblems } = (await import(sceneCheck.href)) as {
  fitProblems: (scene: Scene) => string[];
  sceneProblems: (scene: Scene) => string[];
};
export const TIMEOUT = 600_000;

// By default fast-check keeps lengths to about 10 whatever maxLength says;
// let them reach the maxLength given to each arbitrary.
fc.configureGlobal({ ...fc.readConfigureGlobal(), baseSize: 'medium' });

// ---------------------------------------------------------------------------
// Harness

/** Loads a document, failing with readable errors if it is invalid. */
export function load(doc: VisualizationInput): Trace {
  const result = loadTrace(doc);
  if (!result.ok)
    throw new Error(
      `The document does not load:\n${formatErrors(result.error)}`,
    );
  return result.value;
}

/**
 * Every frame's scene is well formed and as large as frame 0's, in both
 * layouts (ADR 0029).
 */
function checkLayout(trace: Trace): void {
  for (const figure of ['wide', 'narrow'] as const) {
    const layout = layoutTrace(trace, { layout: figure });
    const first = layout.sceneAt(0);
    for (let i = 0; i <= trace.length; i++) {
      const scene = i === 0 ? first : layout.sceneAt(i);
      const problems = [...sceneProblems(scene), ...fitProblems(scene)];
      if (problems.length > 0)
        throw new Error(
          `${figure}, frame ${i} of ${trace.length}: ${problems.slice(0, 5).join('; ')}` +
            (problems.length > 5 ? ` …and ${problems.length - 5} more` : ''),
        );
      if (scene.width !== first.width || scene.height !== first.height)
        throw new Error(
          `${figure}: frame ${i} is ${scene.width}×${scene.height} but frame 0 is ${first.width}×${first.height}`,
        );
    }
  }
}

/** The last frame renders without throwing and without junk numbers. */
function checkRender(trace: Trace): void {
  const svg = renderSvg(layoutTrace(trace).sceneAt(trace.length));
  for (const bad of ['NaN', 'undefined', 'Infinity']) {
    const at = svg.indexOf(bad);
    if (at >= 0)
      throw new Error(
        `The SVG contains "${bad}": …${svg.slice(Math.max(0, at - 160), at + 40)}…`,
      );
  }
}

/**
 * Frames are the same whether replayed from a checkpoint every step, every
 * 7 steps or every 32 (the default): reducers do not share or mutate state.
 */
function checkReplay(trace: Trace): void {
  const doc = trace.visualization;
  const others = [1, 7].map((checkpointInterval) => {
    const result = loadTrace(doc, { checkpointInterval });
    if (!result.ok) throw new Error(formatErrors(result.error));
    return result.value;
  });
  // Read frames backwards too, so that cached checkpoints are reused.
  for (const i of [
    ...Array.from({ length: trace.length + 1 }, (_, k) => k),
    ...Array.from({ length: trace.length + 1 }, (_, k) => trace.length - k),
  ])
    for (const other of others)
      expect(other.frame(i).state, `frame ${i}`).toEqual(trace.frame(i).state);
}

/** The four properties every recipe must have. */
export function recipe<T>(
  name: string,
  arb: fc.Arbitrary<T>,
  build: (input: T) => VisualizationInput,
  semantics: (trace: Trace, input: T) => void,
): void {
  const property = (check: (trace: Trace, input: T) => void) => () => {
    fc.assert(
      fc.property(arb, (input) => {
        check(load(build(input)), input);
      }),
      { numRuns: runs },
    );
  };
  describe(name, () => {
    it(
      'gives a document that loads, and replays the same at any checkpoint interval',
      property(checkReplay),
      TIMEOUT,
    );
    it('ends with the right answer', property(semantics), TIMEOUT);
    it(
      'lays out every frame inside one fixed-size scene',
      property(checkLayout),
      TIMEOUT,
    );
    it('renders the last frame to clean SVG', property(checkRender), TIMEOUT);
  });
}
