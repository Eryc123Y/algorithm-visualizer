/** Resolves player content and reports failures from its external sources. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAlgorithm } from '@algomotion/recipes';
import { ok } from '@algomotion/spec';

import { documentOf, loadError, type Content } from '../src/content.ts';

const empty: Content = {
  visualization: undefined,
  algorithm: undefined,
  input: undefined,
  src: undefined,
  inline: undefined,
};
const doc = {
  version: '1.0',
  structures: { s: { kind: 'stack', initial: [] } },
  steps: [{ actions: [{ target: 's', type: 'push', element: 1 }] }],
};
const values = { values: [2, 1] };

/** The document (or diagnostics) a registry run exposes to the player. */
function sorted(input?: unknown) {
  const ran = runAlgorithm('bubble-sort', input);
  return ran.ok ? ok(ran.value.document) : ran;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockRejectedValue(new Error('Unexpected fetch')),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('@algomotion/recipes');
  vi.resetModules();
});

describe('documentOf', () => {
  it.each([doc, null, false, 0, ''])(
    'returns an explicit visualization synchronously, even if it is %j',
    (visualization) => {
      expect(
        documentOf({
          visualization,
          algorithm: 'unknown',
          input: 'broken input',
          src: '/missing.json',
          inline: { ignored: true },
        }),
      ).toEqual(ok(visualization));
    },
  );

  it('returns inline content synchronously without an algorithm or URL', () => {
    expect(documentOf({ ...empty, inline: doc })).toEqual(ok(doc));
    expect(documentOf(empty)).toEqual(ok(undefined));
  });

  it('treats empty algorithm and URL attributes as absent', () => {
    expect(
      documentOf({ ...empty, algorithm: '', src: '', inline: doc }),
    ).toEqual(ok(doc));
  });

  it('fetches a document in preference to inline content', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(doc)));
    expect(
      await documentOf({ ...empty, src: '/document.json', inline: null }),
    ).toEqual(ok(doc));
  });

  it.each([
    ['an object', values],
    ['JSON', '{"values":[2,1]}'],
    ['an object without braces', '"values": [2, 1]'],
    ['a notation', '2 1'],
  ])('runs an algorithm with %s as explicit input', async (_, input) => {
    expect(
      await documentOf({
        ...empty,
        algorithm: 'bubble-sort',
        input,
        src: '/missing.json',
        inline: { values: [9, 8, 7] },
      }),
    ).toEqual(sorted(values));
  });

  it.each([null, false, 0])(
    'validates explicit input %j instead of falling back to another source',
    async (input) => {
      const result = await documentOf({
        ...empty,
        algorithm: 'bubble-sort',
        input,
        src: '/missing.json',
        inline: values,
      });
      expect(result).toMatchObject({
        ok: false,
        error: [{ code: 'INVALID_SHAPE', path: '$.input' }],
      });
    },
  );

  it('fetches algorithm input in preference to inline content', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(values)));
    expect(
      await documentOf({
        ...empty,
        algorithm: 'bubble-sort',
        src: '/input.json',
        inline: { values: [9, 8, 7] },
      }),
    ).toEqual(sorted(values));
  });

  it('runs an algorithm with inline input when no input or URL is given', async () => {
    expect(
      await documentOf({ ...empty, algorithm: 'bubble-sort', inline: values }),
    ).toEqual(sorted(values));
  });

  it('runs the default example without input or with empty input text', async () => {
    expect(await documentOf({ ...empty, algorithm: 'bubble-sort' })).toEqual(
      sorted(),
    );
    expect(
      await documentOf({
        ...empty,
        algorithm: 'bubble-sort',
        input: '',
        src: '/missing.json',
        inline: values,
      }),
    ).toEqual(sorted());
  });

  it('returns diagnostics for malformed input text', async () => {
    expect(
      await documentOf({
        ...empty,
        algorithm: 'bubble-sort',
        input: '{"values":',
      }),
    ).toMatchObject({
      ok: false,
      error: [{ code: 'INVALID_JSON', path: '$.input' }],
    });
  });

  it('returns diagnostics for an unknown algorithm', async () => {
    expect(
      await documentOf({ ...empty, algorithm: 'unknown', input: values }),
    ).toMatchObject({
      ok: false,
      error: [
        {
          code: 'UNKNOWN_ALGORITHM',
          path: '$.id',
          message: 'No algorithm with id "unknown"',
        },
      ],
    });
  });

  describe.each([undefined, 'bubble-sort'])(
    'loading a URL with algorithm %s',
    (algorithm) => {
      const content = { ...empty, algorithm, src: '/content.json' };

      it('reports an unsuccessful HTTP status instead of using its JSON', async () => {
        vi.mocked(fetch).mockResolvedValue(
          new Response(JSON.stringify(values), { status: 503 }),
        );
        expect(await documentOf(content)).toEqual({
          ok: false,
          error: [
            {
              code: 'LOAD_FAILED',
              path: '$',
              message: 'Could not load /content.json: HTTP 503',
            },
          ],
        });
      });

      it.each([new Error('Offline'), 'Offline'])(
        'reports a rejected fetch: %s',
        async (error) => {
          vi.mocked(fetch).mockRejectedValue(error);
          expect(await documentOf(content)).toEqual({
            ok: false,
            error: [
              {
                code: 'LOAD_FAILED',
                path: '$',
                message: 'Could not load /content.json: Offline',
              },
            ],
          });
        },
      );

      it('reports malformed response JSON', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response('{'));
        expect(await documentOf(content)).toEqual({
          ok: false,
          error: [
            {
              code: 'LOAD_FAILED',
              path: '$',
              message: expect.stringMatching(
                /^Could not load \/content.json: .+/,
              ),
            },
          ],
        });
      });
    },
  );

  it('reports an unavailable registry and lets a later request recover', async () => {
    vi.resetModules();
    vi.doMock('@algomotion/recipes', () => {
      throw new Error('Chunk unavailable');
    });
    const { documentOf: load } = await import('../src/content.ts');
    const content = { ...empty, algorithm: 'bubble-sort', input: values };
    expect(await load(content)).toEqual({
      ok: false,
      error: [
        {
          code: 'LOAD_FAILED',
          path: '$',
          // Vitest wraps a rejected module factory in its own error.
          message: expect.stringMatching(
            /^Could not load the algorithm registry \(algomotion-recipes.js\): .+/,
          ),
        },
      ],
    });
    expect(load({ ...empty, visualization: doc })).toEqual(ok(doc));

    vi.doUnmock('@algomotion/recipes');
    expect(await load(content)).toEqual(sorted(values));
    expect(await load({ ...content, input: '2 1' })).toEqual(sorted(values));
  });
});

describe('loadError', () => {
  it.each([
    [new Error('Unavailable'), 'Unavailable'],
    ['Unavailable', 'Unavailable'],
    [null, 'null'],
    [undefined, 'undefined'],
    [42, '42'],
  ])('formats a thrown value %s as a diagnostic', (error, message) => {
    expect(loadError('input.json', error)).toEqual({
      code: 'LOAD_FAILED',
      path: '$',
      message: `Could not load input.json: ${message}`,
    });
  });
});
