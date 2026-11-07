/**
 * The code of operations in every language (ADR 0017), with marker
 * comments on the lines that steps refer to: `# @swap` in Python and
 * `// @swap` in pseudocode. Markers are stripped from the shown code and
 * become anchors, so line numbers are never written by hand.
 */
import { AnchorName, LIMITS, type AnchoredSource } from '@algoviz/spec';

import { dedent } from './source.ts';

/** Languages of operation code, in the order readers see them (ADR 0017). */
export const LANGUAGES = ['pseudocode', 'python'] as const;
export type Language = (typeof LANGUAGES)[number];

// Markers name steps too, so they are step names: lower-case kebab-case.
const NAME = '([a-z][a-z0-9]*(?:-[a-z0-9]+)*)';
const MARKERS: Readonly<Record<Language, RegExp>> = {
  pseudocode: new RegExp(`\\s*//\\s*@${NAME}\\s*$`),
  python: new RegExp(`\\s*#\\s*@${NAME}\\s*$`),
};

/** Code in one language. */
export interface Snippet {
  readonly language: Language;
  /** The code without markers. */
  readonly code: string;
  /** The 1-based line of each marker, in order of their lines. */
  readonly anchors: ReadonlyMap<string, number>;
  /** The line of a marker; throws for an unknown one. */
  line(anchor: string): number;
}

/** Dedents `code` and reads its markers. */
export function snippet(language: Language, code: string): Snippet {
  const anchors = new Map<string, number>();
  const lines = dedent(code)
    .split('\n')
    .map((text, k) => {
      const match = MARKERS[language].exec(text);
      if (match === null) return text;
      const name = match[1]!;
      if (anchors.has(name)) throw new Error(`Marker @${name} is used twice`);
      if (name.length > LIMITS.nameLength)
        throw new Error(
          `Marker @${name} is longer than ${LIMITS.nameLength} characters`,
        );
      anchors.set(name, k + 1);
      return text.slice(0, match.index);
    });
  return makeSnippet(language, lines.join('\n'), anchors);
}

function makeSnippet(
  language: Language,
  code: string,
  anchors: ReadonlyMap<string, number>,
): Snippet {
  return {
    language,
    code,
    anchors,
    line(anchor) {
      const line = anchors.get(anchor);
      if (line === undefined)
        throw new Error(`No marker @${anchor} in the ${language} code`);
      return line;
    },
  };
}

/** The snippet of an anchored source in one of `LANGUAGES`. */
export function snippetOf(source: AnchoredSource): Snippet {
  const language = LANGUAGES.find((l) => l === source.language);
  if (language === undefined)
    throw new Error(`"${source.language}" is not a language of recipes`);
  return makeSnippet(
    language,
    source.code,
    new Map(Object.entries(source.anchors)),
  );
}

/** The code of one operation in every language, with the same markers. */
export interface Listing {
  /** Lower-case kebab-case; prefixes its anchors when listings are joined. */
  readonly name: string;
  readonly code: Readonly<Record<Language, Snippet>>;
}

/**
 * Reads the code of an operation in every language. Throws unless every
 * language has the same markers, so a step's anchor is a line in each.
 */
export function listing(
  name: string,
  code: Readonly<Record<Language, string>>,
): Listing {
  if (!AnchorName.safeParse(name).success)
    throw new Error(`Listing name "${name}" must be lower-case kebab-case`);
  const snippets = {
    pseudocode: snippet('pseudocode', code.pseudocode),
    python: snippet('python', code.python),
  };
  for (const from of LANGUAGES)
    for (const marker of snippets[from].anchors.keys())
      for (const to of LANGUAGES)
        if (!snippets[to].anchors.has(marker))
          throw new Error(
            `Marker @${marker} of the ${from} code of "${name}" is missing from its ${to} code`,
          );
  return { name, code: snippets };
}

export interface JoinedCode {
  /** The code in every language, as a document gives it. */
  readonly sources: readonly AnchoredSource[];
  /** The document's anchor for a marker of a joined listing. */
  anchor(listing: Listing, marker: string): string;
}

/**
 * Joins distinct listings, in order of first use and with a blank line
 * between them, in every language. With one listing, anchors are its
 * markers; with several, each is prefixed with its listing's name
 * (`insert-go`), so that anchors stay distinct.
 */
export function joinListings(listings: readonly Listing[]): JoinedCode {
  const distinct = [...new Set(listings)];
  const names = new Set<string>();
  for (const { name } of distinct) {
    if (names.has(name))
      throw new Error(`Two different listings are named "${name}"`);
    names.add(name);
  }
  const anchorOf = (l: Listing, marker: string) =>
    distinct.length === 1 ? marker : `${l.name}-${marker}`;
  const sources = LANGUAGES.map((language): AnchoredSource => {
    const anchors: Record<string, number> = {};
    let offset = 0;
    for (const l of distinct) {
      const s = l.code[language];
      for (const [marker, line] of s.anchors) {
        const anchor = anchorOf(l, marker);
        if (
          !AnchorName.safeParse(anchor).success ||
          Object.hasOwn(anchors, anchor)
        )
          throw new Error(`Anchor "${anchor}" is not a distinct anchor name`);
        anchors[anchor] = offset + line;
      }
      offset += s.code.split('\n').length + 1;
    }
    const code = distinct.map((l) => l.code[language].code).join('\n\n');
    return { language, code, anchors };
  });
  return {
    sources,
    anchor(l, marker) {
      if (!distinct.includes(l)) throw new Error('Listing is not joined');
      l.code.pseudocode.line(marker);
      return anchorOf(l, marker);
    },
  };
}
