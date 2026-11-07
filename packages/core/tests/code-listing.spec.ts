import { describe, expect, it } from 'vitest';

import { codeListings, frameLines } from '../src/index.ts';

const sources = [
  { language: 'pseudocode', code: 'A\nB\nC', anchors: { go: 2, stop: 3 } },
  { language: 'python', code: 'a\nb\nc\nd', anchors: { go: 4, stop: 1 } },
];

describe('codeListings', () => {
  it('is empty without source code', () => {
    expect(codeListings({})).toEqual([]);
  });

  it('gives source as one listing that points at meta.line', () => {
    const source = { language: 'python', code: 'a\nb' };
    const [listing, ...rest] = codeListings({ source });
    expect(rest).toEqual([]);
    expect(listing?.language).toBe('python');
    expect(listing?.source).toBe(source);
    expect(listing?.lineOf({ meta: { line: 2 } })).toBe(2);
    expect(listing?.lineOf({ meta: {} })).toBeUndefined();
    expect(listing?.lineOf(undefined)).toBeUndefined();
  });

  it('gives each entry of sources as a listing that points at the anchor', () => {
    const listings = codeListings({ sources });
    expect(listings.map((l) => l.language)).toEqual(['pseudocode', 'python']);
    expect(listings.map((l) => l.source)).toEqual(sources);
    const step = { meta: { at: 'go' } };
    expect(listings.map((l) => l.lineOf(step))).toEqual([2, 4]);
    expect(listings.map((l) => l.lineOf({ meta: {} }))).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('never finds an anchor among inherited properties', () => {
    const [listing] = codeListings({ sources });
    expect(listing?.lineOf({ meta: { at: 'constructor' } })).toBeUndefined();
  });

  it('gives the same listings for the same document', () => {
    const doc = { sources };
    expect(codeListings(doc)).toBe(codeListings(doc));
  });
});

describe('frameLines', () => {
  it('maps each language to the line of the step that made a frame', () => {
    const doc = {
      sources,
      steps: [{ meta: { at: 'go' } }, { meta: { at: 'stop' } }, {}],
    };
    expect(frameLines(doc, 0)).toEqual({});
    expect(frameLines(doc, 1)).toEqual({ pseudocode: 2, python: 4 });
    expect(frameLines(doc, 2)).toEqual({ pseudocode: 3, python: 1 });
    expect(frameLines(doc, 3)).toEqual({});
  });
});
