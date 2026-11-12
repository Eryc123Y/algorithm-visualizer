/**
 * Share links on random content (ADR 0040): whatever a writer makes, the
 * reader reads back unchanged, and no text makes the reader throw.
 *
 * Run bigger with `FUZZ_RUNS=2000 npx vitest run --project spec share`;
 * replay a failure with its `FUZZ_SEED`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  readShareFragment,
  shareFragment,
  type ShareContent,
} from '../src/index.ts';

const settings = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 60),
  ...(process.env['FUZZ_SEED'] === undefined
    ? {}
    : { seed: Number(process.env['FUZZ_SEED']) }),
};

/**
 * Text that has a UTF-8 form (any code points, no lone surrogates), at
 * most `max` UTF-16 code units, the unit the reader's limits count.
 */
const text = (max: number) =>
  fc
    .string({ unit: 'grapheme', maxLength: Math.min(max, 60) })
    .filter((s) => s.length <= max);

const view = fc.record(
  {
    frame: fc.oneof(
      fc.integer({ min: -5, max: 10_000 }).filter((n) => n !== 0),
      text(200).filter((s) => s !== '0'),
    ),
    theme: text(200),
  },
  { requiredKeys: [] },
);

const content: fc.Arbitrary<ShareContent> = fc.oneof(
  fc
    .tuple(fc.jsonValue({ maxDepth: 4 }), view)
    .map(([document, v]) => ({ ...v, document })),
  fc
    .tuple(
      text(200).filter((s) => s !== ''),
      fc.option(text(500), { nil: undefined }),
      view,
    )
    .map(([algorithm, input, v]) => ({
      ...v,
      algorithm,
      ...(input === undefined ? {} : { input }),
    })),
);

/** What a reader gives back: the frame as text, as an attribute takes it. */
function expected(c: ShareContent): ShareContent {
  const frame = c.frame === undefined ? {} : { frame: String(c.frame) };
  return 'document' in c
    ? { ...c, ...frame, document: JSON.parse(JSON.stringify(c.document)) }
    : { ...c, ...frame };
}

describe('share links on random content', () => {
  it('read back what was written', async () => {
    await fc.assert(
      fc.asyncProperty(content, async (c) => {
        const fragment = await shareFragment(c);
        expect(fragment.ok).toBe(true);
        if (!fragment.ok) return;
        expect(await readShareFragment(fragment.value)).toEqual({
          ok: true,
          value: expected(c),
        });
      }),
      settings,
    );
  });

  it('never throw on any fragment', async () => {
    const piece = fc.oneof(
      fc.constantFrom('v=1', 'v=2', 'doc=', 'alg=', 'in=', 'frame=', '&', '='),
      fc.string({ unit: 'binary', maxLength: 40 }),
      fc.base64String({ maxLength: 60 }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(piece, { maxLength: 8 }), async (pieces) => {
        const result = await readShareFragment(pieces.join(''));
        if (!result.ok)
          for (const e of result.error)
            expect(['INVALID_LINK', 'LINK_TOO_LARGE']).toContain(e.code);
      }),
      settings,
    );
  });

  it('never throw on any compressed payload', async () => {
    const base64url = fc
      .base64String({ minLength: 4, maxLength: 200 })
      .map((s) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    await fc.assert(
      fc.asyncProperty(base64url, async (payload) => {
        const result = await readShareFragment(`v=1&doc=${payload}`);
        if (!result.ok) expect(result.error[0]!.code).toBe('INVALID_LINK');
      }),
      settings,
    );
  });
});
