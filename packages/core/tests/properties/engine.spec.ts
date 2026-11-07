/**
 * Generative tests of the engine, layout and painter: random documents of
 * every kind, built against the evolving state so that most actions are
 * valid and some are not. Run deeper with FUZZ_RUNS=5000.
 */
import { kindNames } from '@algoviz/spec';
import { renderSvg } from '@algoviz/svg';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  bareLayoutOptions,
  compileTrace,
  layoutTrace,
  loadTrace,
} from '../../src/index.ts';
import { fitProblems, overlapProblems, sceneProblems } from '../scene-check.ts';
import { build } from './build.ts';
import { stateProblems } from './invariants.ts';
import { Dice, RUNS } from './random.ts';

const dice = fc.array(fc.nat(), { maxLength: 400 });
const TIMEOUT = 20 * 60_000;

/** fast-check settings: a fixed seed in CI unless FUZZ_SEED is given. */
const params = {
  numRuns: RUNS,
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

describe.each(['all', ...kindNames])('generated documents (%s)', (kind) => {
  const only = kind === 'all' ? undefined : [kind];

  it(
    'load as built, agree with the models, and keep every invariant',
    () => {
      fc.assert(
        fc.property(dice, (values) => {
          const built = build(new Dice(values), only);
          expect(built.problems).toEqual([]);
          const loaded = loadTrace(built.doc);
          if (!built.expected.ok) {
            expect(loaded.ok).toBe(false);
            if (loaded.ok) return;
            const [first] = loaded.error;
            expect([
              first!.code,
              first!.path.startsWith(built.expected.at),
            ]).toEqual([built.expected.code, true]);
            return;
          }
          if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
          const trace = loaded.value;
          expect(trace.frame(trace.length).state).toEqual(built.final);
          for (let i = 0; i <= trace.length; i++)
            for (const [name, entry] of Object.entries(trace.frame(i).state))
              expect(stateProblems(entry), `frame ${i} ${name}`).toEqual([]);
        }),
        params,
      );
    },
    TIMEOUT,
  );

  it(
    'lay out and paint every frame inside a scene of constant size',
    () => {
      fc.assert(
        fc.property(dice, fc.boolean(), (values, bare) => {
          const built = build(new Dice(values), only);
          if (!built.expected.ok) return;
          const loaded = loadTrace(built.doc);
          if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
          const trace = loaded.value;
          const layout = layoutTrace(trace, bare ? bareLayoutOptions : {});
          // Nodes placed by hand may overlap, as their author put them.
          const manual = new Set(
            Object.entries(trace.visualization.structures)
              .filter(([, d]) => d.kind === 'graph' && d.layout === 'manual')
              .map(([name]) => name),
          );
          const first = layout.sceneAt(0);
          for (let i = 0; i <= trace.length; i++) {
            const scene = layout.sceneAt(i);
            expect([scene.width, scene.height], `frame ${i} size`).toEqual([
              first.width,
              first.height,
            ]);
            expect(sceneProblems(scene), `frame ${i}`).toEqual([]);
            expect(overlapProblems(scene, manual), `frame ${i}`).toEqual([]);
            expect(fitProblems(scene), `frame ${i}`).toEqual([]);
            const svg = renderSvg(scene, { theme: i % 2 ? 'dark' : 'light' });
            expect(svg, `frame ${i} svg`).not.toMatch(/NaN|undefined|Infinity/);
          }
        }),
        params,
      );
    },
    TIMEOUT,
  );

  it(
    'serve the same frames whatever the checkpoint interval and access order',
    () => {
      fc.assert(
        fc.property(
          dice,
          fc.integer({ min: 1, max: 5 }),
          fc.array(fc.nat(), { maxLength: 10 }),
          (values, interval, order) => {
            const built = build(new Dice(values), only);
            if (!built.expected.ok) return;
            const loaded = loadTrace(built.doc);
            if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
            const a = loaded.value;
            const b = compileTrace(a.visualization, {
              checkpointInterval: interval,
            });
            if (!b.ok) throw new Error(JSON.stringify(b.error));
            for (const k of order) {
              const i = k % (a.length + 1);
              expect(b.value.frame(i).state).toEqual(a.frame(i).state);
            }
          },
        ),
        params,
      );
    },
    TIMEOUT,
  );
});
