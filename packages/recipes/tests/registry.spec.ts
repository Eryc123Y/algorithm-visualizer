/**
 * The generic tests of ADR 0019: every module in the registry is checked
 * the same way, so adding a module adds its checks. Each module also has
 * its own tests against an independent reference implementation.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isCodeLine } from '@algoviz/core';
import { parseVisualization, StepName } from '@algoviz/spec';

import {
  algorithms,
  findAlgorithm,
  LANGUAGES,
  runAlgorithm,
  runModule,
  sourcesOf,
  TOPIC_TITLES,
  TOPICS,
  type Algorithm,
  type AlgorithmRun,
} from '../src/index.ts';
import { CODE_SYNTAX, sourceProblems } from './code-checks.ts';

/** Lower-case kebab-case, with a dotted operation for data structures. */
const ID =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?$/;

function run(algorithm: Algorithm, input: unknown): AlgorithmRun {
  const result = runModule(algorithm, input);
  if (!result.ok)
    throw new Error(
      `${algorithm.id} fails on ${JSON.stringify(input)}: ${JSON.stringify(result.error)}`,
    );
  return result.value;
}

describe('the registry', () => {
  it('has unique, well-formed ids', () => {
    const ids = algorithms.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(ID);
  });

  it('lists every operation of a structure next to its sequence', () => {
    for (const { id } of algorithms.filter((a) => a.id.includes('.')))
      expect(findAlgorithm(id.split('.')[0]!)).toBeDefined();
  });

  it('groups modules by topic in menu order', () => {
    const topics = algorithms.map((a) => TOPICS.indexOf(a.topic));
    expect(topics).toEqual([...topics].sort((x, y) => x - y));
    for (const topic of TOPICS) expect(TOPIC_TITLES[topic]).not.toBe('');
  });

  it('runs a module by id', () => {
    const { examples } = findAlgorithm('bst.search')!;
    const result = runAlgorithm('bst.search', examples[0]);
    expect(result.ok).toBe(true);
  });

  it('reports unknown ids, bad shapes and inputs it cannot show', () => {
    expect(runAlgorithm('bogosort', {})).toMatchObject({
      ok: false,
      error: [{ code: 'UNKNOWN_ALGORITHM', path: '$.id' }],
    });
    expect(runAlgorithm('bst.search', { from: [1], key: 'x' })).toMatchObject({
      ok: false,
      error: [{ code: 'INVALID_SHAPE', path: '$.input.key' }],
    });
    expect(runAlgorithm('min-heap.pop', { from: [] })).toMatchObject({
      ok: false,
      error: [
        {
          code: 'INVALID_ARGUMENT',
          path: '$.input',
          message: 'The heap is empty: there is nothing to pop',
        },
      ],
    });
  });
});

describe.each(algorithms.map((a) => [a.id, a] as const))(
  '%s',
  (_, algorithm) => {
    it('describes itself', () => {
      expect(algorithm.title).not.toBe('');
      expect(algorithm.summary).toMatch(/^[A-Z].*\.$/);
      expect(TOPICS).toContain(algorithm.topic);
    });

    it('has an input schema that converts to JSON Schema', () => {
      const schema = z.toJSONSchema(algorithm.input, { io: 'input' });
      expect(schema.type).toBe('object');
    });

    it('shows its code in every language, with the same anchors', () => {
      const sources = sourcesOf(algorithm.code);
      expect(sources.map((s) => s.language)).toEqual(LANGUAGES);
      const [first, ...rest] = sources.map((s) =>
        Object.keys(s.anchors).sort(),
      );
      for (const anchors of rest) expect(anchors).toEqual(first);
      for (const source of sources) expect(sourceProblems(source)).toEqual([]);
    });

    it.each(algorithm.examples.map((input, k) => [k + 1, input] as const))(
      'runs example %i into a valid document whose every step is narrated, named and on a line of code',
      (_, input) => {
        expect(algorithm.input.safeParse(input).success).toBe(true);
        const { document } = run(algorithm, input);
        expect(parseVisualization(document).ok).toBe(true);
        expect(document.steps.length).toBeGreaterThan(0);
        // The code in every language, pseudocode first (ADR 0017).
        expect(document.source).toBeUndefined();
        expect(document.sources!.map((s) => s.language)).toEqual(LANGUAGES);
        for (const source of document.sources!)
          expect(sourceProblems(source)).toEqual([]);
        for (const [k, step] of document.steps.entries()) {
          const where = `step ${k + 1}`;
          const meta = step.meta ?? {};
          expect(meta.narration, where).toMatch(/\S/);
          expect(meta.narration, where).not.toMatch(CODE_SYNTAX);
          expect(StepName.safeParse(meta.id).success, where).toBe(true);
          // The quality bar: every step points at a line of code in every
          // language.
          expect(meta.at, where).toBeDefined();
          for (const { language, code, anchors } of document.sources!) {
            const line = anchors[meta.at!];
            expect(line, `${where} in ${language}`).toBeDefined();
            expect(
              isCodeLine(code.split('\n')[line! - 1]!, language),
              `${where} in ${language}`,
            ).toBe(true);
          }
        }
      },
    );

    it('gives the same document for the same input, as JSON or not', () => {
      for (const input of algorithm.examples) {
        const json = JSON.parse(JSON.stringify(input)) as unknown;
        expect(run(algorithm, json)).toEqual(run(algorithm, input));
      }
    });
  },
);
