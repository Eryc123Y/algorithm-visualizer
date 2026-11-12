import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace } from '@algomotion/core';

import { renderSvg } from '../src/index.ts';

const root = new URL('../../../conformance/', import.meta.url);
const fixtures = ['core/valid', 'spec/valid'].flatMap((dir) =>
  readdirSync(new URL(`${dir}/`, root))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [
      `${dir}/${f}`,
      (
        JSON.parse(readFileSync(new URL(`${dir}/${f}`, root), 'utf8')) as {
          input: unknown;
        }
      ).input,
    ]),
);

describe('painting every valid fixture', () => {
  it.each(fixtures)('%s', (_, input) => {
    const result = loadTrace(input);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const layout = layoutTrace(result.value);
    for (let i = 0; i <= result.value.length; i++) {
      const svg = renderSvg(layout.sceneAt(i));
      expect(svg).not.toMatch(/NaN|undefined|Infinity|function/);
    }
  });
});
