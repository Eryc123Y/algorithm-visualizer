import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseVisualization, Visualization } from '../src/index.ts';

const root = new URL('../../../conformance/spec/', import.meta.url);

function load(dir: string): [string, Record<string, unknown>][] {
  const url = new URL(`${dir}/`, root);
  return readdirSync(url)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [
      f,
      JSON.parse(readFileSync(new URL(f, url), 'utf8')) as Record<
        string,
        unknown
      >,
    ]);
}

describe('conformance: valid documents', () => {
  it.each(load('valid'))('%s', (_, fixture) => {
    const result = parseVisualization(fixture['input']);
    expect(result).toEqual({ ok: true, value: fixture['expected'] });
    // The canonical output must itself satisfy the canonical schema.
    if (result.ok)
      expect(Visualization.safeParse(result.value).success).toBe(true);
  });
});

describe('conformance: invalid documents', () => {
  it.each(load('invalid'))('%s', (_, fixture) => {
    const result = parseVisualization(fixture['input']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const actual = result.error.map(({ code, path }) => ({ code, path }));
      expect(actual).toEqual(fixture['expectedErrors']);
    }
  });
});
