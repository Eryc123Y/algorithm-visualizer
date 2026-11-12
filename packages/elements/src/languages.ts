/**
 * Which language a player shows its code in, when a document gives the
 * code in several (ADR 0017), and the reader's choice, remembered for the
 * whole site in local storage. Storage is a convenience: when it is
 * missing or refuses (private windows, blocked cookies), the choice lasts
 * for the page only. Players on the page hear of a choice through a window
 * event, and players in other tabs through the `storage` event.
 */
import type { CodeListing } from '@algomotion/core';

/** The local storage key of the reader's choice, one for the whole site. */
export const LANGUAGE_KEY = 'algomotion:language';

/**
 * The window event that tells every player on the page about a reader's
 * choice, so that they all show the same language.
 */
export const LANGUAGE_EVENT = 'algomotion-language';

export interface LanguageEventDetail {
  readonly language: string;
}

// The choice made on this page, for when storage cannot keep it.
let chosen: string | undefined;

/**
 * The reader's remembered choice, if any: from storage, or, when storage
 * refuses, the choice made on this page.
 */
export function storedLanguage(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(LANGUAGE_KEY) ?? undefined;
  } catch {
    return chosen;
  }
}

/** Remembers the reader's choice and tells the other players on the page. */
export function chooseLanguage(language: string): void {
  if (language === '') return;
  chosen = language;
  try {
    globalThis.localStorage?.setItem(LANGUAGE_KEY, language);
  } catch {
    // Storage refused: the choice lasts for this page only.
  }
  const detail: LanguageEventDetail = { language };
  globalThis.dispatchEvent?.(new CustomEvent(LANGUAGE_EVENT, { detail }));
}

const ALIASES = new Map([
  ['py', 'python'],
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['c++', 'cpp'],
]);

/** A language name in one spelling: lower case, short names expanded. */
function canonical(language: string): string {
  const name = language.trim().toLowerCase();
  return ALIASES.get(name) ?? name;
}

/**
 * The listing to show: the first language of `preferences` that the
 * document has, then pseudocode, then the document's first listing.
 * Names match in any case and by their short names (`py`).
 */
export function pickListing(
  listings: readonly CodeListing[],
  preferences: readonly (string | undefined)[],
): CodeListing | undefined {
  for (const language of [...preferences, 'pseudocode']) {
    if (language === undefined) continue;
    const wanted = canonical(language);
    const found = listings.find(
      (l) => l.language !== undefined && canonical(l.language) === wanted,
    );
    if (found !== undefined) return found;
  }
  return listings[0];
}

const NAMES = new Map([
  ['pseudocode', 'Pseudocode'],
  ['python', 'Python'],
  ['py', 'Python'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['c++', 'C++'],
  ['java', 'Java'],
  ['javascript', 'JavaScript'],
  ['js', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['ts', 'TypeScript'],
]);

/** A language's name for the switcher, e.g. "Pseudocode" or "Python". */
export function languageName(language: string | undefined): string {
  if (language === undefined) return 'Code';
  return NAMES.get(language) ?? language;
}
