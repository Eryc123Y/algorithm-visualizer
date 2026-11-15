/**
 * The languages algomotion shows a run in (ADR 0045): English and
 * Simplified Chinese. Not part of the protocol: a document is in one
 * language, whichever its writer chose, and says nothing about it.
 */

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  (LOCALES as readonly unknown[]).includes(value);

/** The locale a BCP 47 tag names, if it names one we have. */
function known(tag: string): Locale | undefined {
  const primary = tag.split(/[-_]/, 1)[0]!.toLowerCase();
  return isLocale(primary) ? primary : undefined;
}

/**
 * The locale for a BCP 47 tag, or for a reader's tags in order of
 * preference (`navigator.languages`): the first that names a language we
 * have. Any Chinese tag is `zh`, Traditional ones too, since Simplified
 * Chinese reads more easily than English for them. Otherwise `en`.
 */
export function localeOf(
  tags: string | readonly string[] | null | undefined,
): Locale {
  const list = typeof tags === 'string' ? [tags] : (tags ?? []);
  for (const tag of list) {
    const locale = known(tag);
    if (locale !== undefined) return locale;
  }
  return 'en';
}
