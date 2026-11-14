/**
 * Syntax colour in the browser (roadmap 5.6): the same spans the build
 * writes, made with DOM calls, for a snippet the playground changes.
 */
import { tokenize, type Language } from './highlight.ts';

/** Fills `element` with `code`'s tokens as text and spans, no markup. */
export function fillCode(
  element: Element,
  code: string,
  language?: Language,
): void {
  const doc = element.ownerDocument;
  if (language === undefined) {
    element.textContent = code;
    return;
  }
  element.replaceChildren(
    ...tokenize(code, language).map((t) => {
      if (t.kind === undefined) return t.text;
      const span = doc.createElement('span');
      span.className = `tok-${t.kind}`;
      span.textContent = t.text;
      return span;
    }),
  );
}
