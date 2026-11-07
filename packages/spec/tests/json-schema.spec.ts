import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_VERSION,
  PROTOCOL_VERSIONS,
  SCHEMA_ID,
  visualizationJsonSchema,
} from '../src/index.ts';

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

  it('states the structure-count limits that Zod enforces at runtime', () => {
    const schema = visualizationJsonSchema() as {
      properties: {
        structures: { minProperties?: number; maxProperties?: number };
      };
    };
    expect(schema.properties.structures.minProperties).toBe(1);
    expect(schema.properties.structures.maxProperties).toBe(16);
  });

  it('accepts every protocol version the parser reads, and no other', () => {
    const schema = visualizationJsonSchema() as {
      properties: { version: { enum?: unknown; const?: unknown } };
    };
    expect(schema.properties.version.enum).toEqual([...PROTOCOL_VERSIONS]);
    expect(schema.properties.version.const).toBeUndefined();
  });

  it('describes step names and sections for LLMs (ADR 0020)', () => {
    const schema = visualizationJsonSchema() as {
      properties: { sections: { type: string; maxItems: number } };
    };
    expect(schema.properties.sections).toMatchObject({
      type: 'array',
      maxItems: 1000,
    });
    const text = JSON.stringify(schema);
    expect(text).toContain('^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$');
    expect(text).toContain('"maxLength":40');
  });

  it('is identified by the newest protocol version', () => {
    expect(SCHEMA_ID).toBe(
      `urn:algoviz:schema:visualization:${PROTOCOL_VERSION}`,
    );
  });

  it('forbids both forms of a table or hash table, as the parser does', () => {
    const text = JSON.stringify(visualizationJsonSchema());
    expect(text).toContain('"not":{"required":["initial","cells"]}');
    expect(text).toContain('"not":{"required":["initial","buckets"]}');
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
