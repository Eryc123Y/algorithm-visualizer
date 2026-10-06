import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadTrace } from '../src/index.ts';

const root = new URL('../../../conformance/core/', import.meta.url);

type Fixture = Record<string, unknown>;

function load(dir: string): [string, Fixture][] {
  const url = new URL(`${dir}/`, root);
  return readdirSync(url)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [
      f,
      JSON.parse(readFileSync(new URL(f, url), 'utf8')) as Fixture,
    ]);
}

describe('conformance: replay', () => {
  it.each(load('valid'))('%s', (_, fixture) => {
    const result = loadTrace(fixture['input']);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const trace = result.value;
    expect(trace.length).toBe(fixture['expectedLength']);
    const frames = fixture['expectedFrames'] as {
      index: number;
      state: unknown;
    }[];
    for (const { index, state } of frames)
      expect(trace.frame(index).state, `frame ${index}`).toEqual(state);
  });
});

describe('conformance: replay errors', () => {
  it.each(load('invalid'))('%s', (_, fixture) => {
    const result = loadTrace(fixture['input']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const actual = result.error.map(({ code, path }) => ({ code, path }));
      expect(actual).toEqual(fixture['expectedErrors']);
    }
  });
});
