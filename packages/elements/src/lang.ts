/**
 * The language a player inherits, as HTML inherits `lang`: the element's
 * own, or its closest ancestor's (ADR 0045). One observer for the page
 * tells every player when a `lang` changes anywhere.
 */
import { localeOf, type Locale } from '@algomotion/spec';

/** The locale `el` is in, from the closest `lang` around it. */
export const localeAround = (el: Element): Locale =>
  localeOf(el.closest('[lang]')?.getAttribute('lang'));

const listeners = new Set<() => void>();
let observer: MutationObserver | undefined;

/** Calls `listener` whenever a `lang` changes in the page; returns the undo. */
export function onLangChange(listener: () => void): () => void {
  listeners.add(listener);
  if (
    observer === undefined &&
    typeof MutationObserver === 'function' &&
    typeof document !== 'undefined'
  ) {
    observer = new MutationObserver(() => {
      for (const l of listeners) l();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
      subtree: true,
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      observer?.disconnect();
      observer = undefined;
    }
  };
}
