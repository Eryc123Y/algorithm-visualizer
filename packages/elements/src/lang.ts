/**
 * The language a player inherits, as HTML inherits `lang`: the element's
 * own, or its closest ancestor's (ADR 0045). One observer for the page
 * tells every player when a `lang` changes anywhere in the document; a
 * change inside a shadow root reaches its players when they reconnect.
 */
import { localeOf, type Locale } from '@algomotion/spec';

/**
 * The `lang` around `el`: its own or its closest ancestor's, crossing
 * shadow roots to their hosts, as a component's player inherits the
 * page's language.
 */
export function langAround(el: Element): string | undefined {
  for (let at: Element | null = el; at !== null;) {
    const found = at.closest('[lang]');
    if (found !== null) return found.getAttribute('lang') ?? undefined;
    const root = at.getRootNode();
    at = root instanceof ShadowRoot ? root.host : null;
  }
  return undefined;
}

/** The locale `el` is in, from the closest `lang` around it. */
export const localeAround = (el: Element): Locale => localeOf(langAround(el));

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
