/**
 * Text a reader sees, in every locale (ADR 0045): an object with a string
 * per locale, written side by side in the recipe, or a plain string for
 * text without words, such as `G` or `d[v]`, the same in every locale.
 */
import type { Locale } from '@algomotion/spec';

export type Localized = Readonly<Record<Locale, string>>;
export type Text = string | Localized;

/** `text` in `locale`. */
export const textIn = (text: Text, locale: Locale): string =>
  typeof text === 'string' ? text : text[locale];
