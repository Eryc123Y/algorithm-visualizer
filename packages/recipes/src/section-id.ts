/**
 * Section ids from operation titles (ADR 0020): "insert 5" becomes
 * `insert-5`, and a repeat becomes `insert-5-2`.
 */
import { LIMITS } from '@algomotion/spec';

const MAX = LIMITS.nameLength;

/** `base` cut so that `suffix` fits, without a trailing hyphen. */
const fit = (base: string, suffix: string) =>
  `${base.slice(0, MAX - suffix.length).replace(/-+$/, '')}${suffix}`;

/** Lower-case kebab-case that starts with a letter. */
function slug(title: string): string {
  const s = title
    .toLowerCase()
    // A minus sign, so that "push -3" and "push 3" differ.
    .replace(/(^|\s)-(?=\d)/g, '$1minus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s === '') return 'part';
  return /^[a-z]/.test(s) ? s : `part-${s}`;
}

/** One distinct section id per title, in order. */
export function sectionIds(titles: readonly string[]): string[] {
  const used = new Set<string>();
  return titles.map((title) => {
    const base = slug(title);
    let id = fit(base, '');
    for (let n = 2; used.has(id); n++) id = fit(base, `-${n}`);
    used.add(id);
    return id;
  });
}
