/**
 * The engine entry of the Typst plugin (ADR 0026): one JSON request in, one
 * JSON response out. The plugin evaluates this module, bundled with the
 * engine, in QuickJS; tests run it in Node.
 *
 * A request names an algorithm and its input, or passes a document, and
 * asks for one frame (`step`) or a series (`steps`) in a theme. The engine
 * keeps the last few prepared documents, so further figures of a document
 * cost only their own layout and painting. Layout is pure (ADR 0003), so the
 * cache never changes a figure. Its key is the JSON of the source, the
 * theme and the layout, so each entry holds a copy of its document's text as well as the
 * prepared trace; eight entries stay small for documents of the registry's
 * size.
 */
import { z } from 'zod';

import { runAlgorithm } from '@algoviz/recipes';
import { err, formatPath, type Diagnostic, type Result } from '@algoviz/spec';
import {
  prepareFigures,
  type Figure,
  type PreparedFigures,
  type SeriesOptions,
  type ThemeName,
} from '@algoviz/svg';

/** How many prepared documents an engine keeps by default. */
export const CACHE_SIZE = 8;

const selector = z.union([z.string(), z.int()]);

const requestSchema = z
  .strictObject({
    /** A registry id (ADR 0019), run on `input`. */
    algorithm: z.string().optional(),
    input: z.unknown().optional(),
    /** A document, instead of an algorithm. */
    document: z.unknown().optional(),
    /** One frame, with the rules of `selectFrame` (ADR 0020). */
    step: selector.optional(),
    /** A series, with the rules of `selectSeries` (ADR 0025). */
    steps: z.array(selector).optional(),
    /** A built-in theme name; `light` by default. */
    theme: z.string().optional(),
    /** `wide` (default) or `narrow`: where side structures go (ADR 0029). */
    layout: z.string().optional(),
  })
  .superRefine((request, ctx) => {
    const issue = (message: string, path: PropertyKey[] = []) =>
      ctx.addIssue({ code: 'custom', message, path });
    if ((request.algorithm === undefined) === (request.document === undefined))
      issue('Name an algorithm with its input, or pass a document, not both');
    else if (request.document !== undefined && request.input !== undefined)
      issue('A document takes no input', ['input']);
    if (request.step !== undefined && request.steps !== undefined)
      issue('Ask for one step or for steps, not both');
  });

/** A request to the engine, once checked. */
export type Request = z.infer<typeof requestSchema>;

/** The engine's answer: the figures, or why there are none. */
export type Response =
  | {
      readonly ok: true;
      /** Frames of the document, 0 to `frames - 1`. */
      readonly frames: number;
      readonly figures: readonly Figure[];
    }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** Draws figures for requests, keeping the documents it prepared. */
export interface Engine {
  /** Draws the figures a request asks for. Never throws on bad input. */
  render(request: unknown): Response;
  /** How many prepared documents the engine keeps now. */
  readonly cached: number;
}

const failure = (diagnostics: readonly Diagnostic[]): Response => ({
  ok: false,
  diagnostics,
});

/** Loads the request's document, running its algorithm if it names one. */
function prepare(
  request: Request,
): Result<PreparedFigures, readonly Diagnostic[]> {
  let document = request.document;
  if (request.algorithm !== undefined) {
    const run = runAlgorithm(request.algorithm, request.input);
    if (!run.ok) return run;
    document = run.value.document;
  }
  // prepareFigures checks the names, as Typst passes any text.
  return prepareFigures(document, {
    theme: (request.theme ?? 'light') as ThemeName,
    layout: (request.layout ?? 'wide') as NonNullable<SeriesOptions['layout']>,
  });
}

/** An engine that keeps up to `cacheSize` prepared documents. */
export function createEngine(cacheSize = CACHE_SIZE): Engine {
  // Insertion order is recency: a hit moves its entry to the end.
  const cache = new Map<string, PreparedFigures>();

  function prepared(
    request: Request,
  ): Result<PreparedFigures, readonly Diagnostic[]> {
    // Absent fields drop out of the key; `null` stays, as it is a value.
    const key = JSON.stringify({
      algorithm: request.algorithm,
      input: request.input,
      document: request.document,
      theme: request.theme ?? 'light',
      layout: request.layout ?? 'wide',
    });
    const hit = cache.get(key);
    if (hit !== undefined) {
      cache.delete(key);
      cache.set(key, hit);
      return { ok: true, value: hit };
    }
    const result = prepare(request);
    if (result.ok) {
      cache.set(key, result.value);
      while (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
    }
    return result;
  }

  return {
    get cached() {
      return cache.size;
    },
    render(raw) {
      const parsed = requestSchema.safeParse(raw);
      if (!parsed.success)
        return failure(
          parsed.error.issues.map((issue) => ({
            code: 'INVALID_REQUEST',
            path: formatPath(issue.path),
            message: issue.message,
          })),
        );
      const request = parsed.data;
      const source = prepared(request);
      if (!source.ok) return failure(source.error);
      const figures: Result<readonly Figure[], readonly Diagnostic[]> =
        request.step === undefined
          ? source.value.figures(request.steps ?? [])
          : one(source.value.figure(request.step));
      return figures.ok
        ? { ok: true, frames: source.value.frames, figures: figures.value }
        : failure(figures.error);
    },
  };
}

const one = (
  figure: Result<Figure, readonly Diagnostic[]>,
): Result<readonly Figure[], readonly Diagnostic[]> =>
  figure.ok ? { ok: true, value: [figure.value] } : err(figure.error);

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Answers a request given as JSON text with the JSON text of the response.
 * An exception inside the engine, a bug or recursion too deep for the
 * plugin's stack, becomes an `ENGINE_ERROR` diagnostic, so the document
 * still compiles and shows it.
 */
export function respond(engine: Engine, text: string): string {
  let request: unknown;
  try {
    request = JSON.parse(text) as unknown;
  } catch (e) {
    return JSON.stringify(
      failure([{ code: 'INVALID_JSON', path: '$', message: messageOf(e) }]),
    );
  }
  try {
    return JSON.stringify(engine.render(request));
  } catch (e) {
    return JSON.stringify(
      failure([
        {
          code: 'ENGINE_ERROR',
          path: '$',
          message: messageOf(e),
          hint: 'This is a bug in algoviz, or a document too large for the Typst plugin; algoviz export can draw it outside Typst.',
        },
      ]),
    );
  }
}
