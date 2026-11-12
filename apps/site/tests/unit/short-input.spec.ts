/**
 * `shortInput`: the shortest input that runs to the same document, for
 * the snippets of the documentation site (roadmap 3.4). Every field in
 * its notation where one fits, the main field alone where the rest are
 * defaults, and never an input that draws something else.
 */
import { describe, expect, it } from 'vitest';

import {
  algorithms,
  readInput,
  runAlgorithm,
  writeInput,
} from '@algomotion/recipes';

import { shortInput } from '../../src/docs/short-input.ts';

const documentOf = (id: string, input: unknown) => {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(`${id}: ${JSON.stringify(run.error)}`);
  return JSON.stringify(run.value.document);
};

const first = (id: string) => algorithms.find((a) => a.id === id)!.examples[0];

describe('shortInput', () => {
  it('writes a sort’s values as a list alone', () => {
    expect(shortInput('insertion-sort', first('insertion-sort'))).toBe(
      '5 3 8 1 9 2 7',
    );
  });

  it('writes a graph as an edge list, alone when the source is its first node', () => {
    const short = shortInput('dijkstra', first('dijkstra'));
    expect(typeof short).toBe('string');
    expect(short).toMatch(/^[A-Za-z0-9_]+-[A-Za-z0-9_]+ \d+, /);
  });

  it('keeps the fields an operation needs, each in its notation', () => {
    const short = shortInput('bst.delete', first('bst.delete')) as Record<
      string,
      unknown
    >;
    expect(typeof short['from']).toBe('string');
    expect(Object.keys(short)).toContain('key');
  });

  it('writes a sequence’s operations as exercises write them', () => {
    const short = shortInput('bst', first('bst')) as Record<string, unknown>;
    expect(short['ops']).toMatch(/^[a-z-]+ -?\d/);
  });

  it('gives back an input it cannot run unchanged', () => {
    const bad = { values: 'not a list' };
    expect(shortInput('insertion-sort', bad)).toBe(bad);
    expect(shortInput('no-such-algorithm', 5)).toBe(5);
  });

  it('runs to the same document for every example of the registry', () => {
    let shorter = 0;
    let total = 0;
    for (const a of algorithms)
      for (const example of a.examples) {
        total++;
        const short = shortInput(a.id, example);
        expect(documentOf(a.id, short), a.id).toBe(documentOf(a.id, example));
        // As text, as the CLI, LaTeX and the player read it.
        const text = writeInput(short)!;
        const read = readInput(text);
        expect(read.ok, a.id).toBe(true);
        if (read.ok)
          expect(documentOf(a.id, read.value), a.id).toBe(
            documentOf(a.id, example),
          );
        if (JSON.stringify(short) !== JSON.stringify(example)) shorter++;
      }
    // Most examples have a notation or a field to leave out.
    expect(shorter / total).toBeGreaterThan(0.65);
  });
});
