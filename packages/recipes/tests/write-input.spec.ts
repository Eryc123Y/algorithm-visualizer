/**
 * `writeInput`, the inverse of `readInput` (ADR 0040): the text of an
 * input, for share links, that `readInput` reads back as the same value.
 *
 * Run bigger with `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/write-input.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { readInput, writeInput } from '../src/index.ts';
import { fuzz } from './helpers.ts';

const roundTrip = (value: unknown) => {
  const text = writeInput(value);
  return text === undefined ? undefined : readInput(text);
};

describe('writeInput', () => {
  it('keeps a notation as it is', () => {
    expect(writeInput('A-B 4, B-C 1')).toBe('A-B 4, B-C 1');
    expect(writeInput('5 2 4 6 1 3')).toBe('5 2 4 6 1 3');
    expect(writeInput('insert 4, delete 3')).toBe('insert 4, delete 3');
  });

  it('writes other values as JSON', () => {
    expect(writeInput([5, 2, 4])).toBe('[5,2,4]');
    expect(writeInput({ graph: 'A-B 4', source: 'B' })).toBe(
      '{"graph":"A-B 4","source":"B"}',
    );
    expect(writeInput(7)).toBe('7');
    expect(writeInput(null)).toBe('null');
  });

  it('writes a string as JSON when readInput would read it otherwise', () => {
    expect(writeInput('7')).toBe('"7"');
    expect(writeInput('[5, 2]')).toBe('"[5, 2]"');
    expect(writeInput('"graph": "A-B"')).toBe('"\\"graph\\": \\"A-B\\""');
    expect(writeInput('')).toBe('""');
    expect(writeInput('  ')).toBe('"  "');
    expect(writeInput('{oops')).toBe('"{oops"');
  });

  it('writes no text for no input', () => {
    expect(writeInput(undefined)).toBeUndefined();
  });

  it('is read back as the same value, for any JSON value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(roundTrip(value)).toEqual({
          ok: true,
          value: JSON.parse(JSON.stringify(value)),
        });
      }),
      fuzz,
    );
  });

  it('is read back as the same string, for any string', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (value) => {
        expect(roundTrip(value)).toEqual({ ok: true, value });
      }),
      fuzz,
    );
  });
});
