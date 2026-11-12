/**
 * The code a document shows, one listing per language (ADR 0017), and the
 * line a step points at in each: `meta.line` in the single `source`, or
 * the line of the step's anchor `meta.at` in each entry of `sources`.
 */
import type { AnchoredSource, Source, StepMeta } from '@algomotion/spec';

/** The code of a document in one language. */
export interface CodeListing {
  /** The language, if the document names one. */
  readonly language: string | undefined;
  /** The code and its language, as the document gives them. */
  readonly source: Source | AnchoredSource;
  /** The 1-based line a step points at in this code, if any. */
  lineOf(
    step: { readonly meta?: StepMeta | undefined } | undefined,
  ): number | undefined;
}

/** What listings are read from: a document, canonical or not. */
export interface WithCode {
  readonly source?: Source | undefined;
  readonly sources?: readonly AnchoredSource[] | undefined;
}

const anchored = (source: AnchoredSource): CodeListing => ({
  language: source.language,
  source,
  lineOf: (step) => {
    const at = step?.meta?.at;
    return at !== undefined && Object.hasOwn(source.anchors, at)
      ? source.anchors[at]
      : undefined;
  },
});

const single = (source: Source): CodeListing => ({
  language: source.language,
  source,
  lineOf: (step) => step?.meta?.line,
});

// A loaded document keeps its objects, so its listings are made once.
const cache = new WeakMap<WithCode, readonly CodeListing[]>();

/**
 * The document's code, one listing per language in the order the document
 * gives them: none without code, one for `source`, one per entry of
 * `sources`. The same document gives the same array.
 */
export function codeListings(doc: WithCode): readonly CodeListing[] {
  const cached = cache.get(doc);
  if (cached !== undefined) return cached;
  const listings =
    doc.sources !== undefined
      ? doc.sources.map(anchored)
      : doc.source !== undefined
        ? [single(doc.source)]
        : [];
  cache.set(doc, listings);
  return listings;
}

/**
 * The line of each named language that frame `index` points at: the line
 * of the step that produced it. Frame 0, the initial state, points at none.
 */
export function frameLines(
  doc: WithCode & {
    readonly steps: readonly { readonly meta?: StepMeta | undefined }[];
  },
  index: number,
): Record<string, number> {
  const step = index > 0 ? doc.steps[index - 1] : undefined;
  const lines: Record<string, number> = {};
  for (const listing of codeListings(doc)) {
    const line = listing.lineOf(step);
    if (listing.language !== undefined && line !== undefined)
      lines[listing.language] = line;
  }
  return lines;
}
