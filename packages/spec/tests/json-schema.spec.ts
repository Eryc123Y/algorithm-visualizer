import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { visualizationJsonSchema } from '../src/index.ts';

describe('visualizationJsonSchema', () => {
  it('matches the committed schema file (run `npm run generate:schema -w @algoviz/spec`)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(
        new URL('../schema/visualization.schema.json', import.meta.url),
        'utf8',
      ),
    );
    expect(committed).toEqual(visualizationJsonSchema());
  });

  it('documents every array action for LLMs', () => {
    const text = JSON.stringify(visualizationJsonSchema());
    for (const type of [
      'set',
      'swap',
      'insert',
      'remove',
      'compare',
      'highlight',
      'pointer',
      'settle',
    ])
      expect(text).toContain(`"const":"${type}"`);
  });
});
