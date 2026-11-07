/**
 * Lines of the source panel: the code highlighted by `highlightCode` from
 * @algoviz/core, one `.line` per source line, with the current step's line
 * marked. Token colours are the `--algo-code-*` custom properties.
 * Procedure names in pseudocode are set in small capitals, as in CLRS
 * (ADR 0017).
 */
import { html, nothing, type TemplateResult } from 'lit';

import { highlightCode, type CodeLine, type CodeToken } from '@algoviz/core';
import type { Source } from '@algoviz/spec';

// A loaded document keeps its source object, so each source is highlighted once.
const highlighted = new WeakMap<Source, readonly CodeLine[]>();

function linesOf(source: Source): readonly CodeLine[] {
  const cached = highlighted.get(source);
  if (cached !== undefined) return cached;
  const lines = highlightCode(source.code, source.language);
  highlighted.set(source, lines);
  return lines;
}

/**
 * A procedure name such as `INSERTION-SORT`: the first letter of each part
 * stays a capital and the rest are small capitals. The text is unchanged,
 * so copying the code gives the name as written.
 */
const procedure = (text: string) =>
  html`<span class="tok-function tok-procedure"
    >${text
      .split('-')
      .map(
        (part, k) =>
          html`${k > 0 ? '-' : ''}${part.charAt(0)}${
            part.length > 1
              ? html`<span class="small-caps">${part.slice(1)}</span>`
              : nothing
          }`,
      )}</span
  >`;

const token =
  (language: string | undefined) =>
  ({ kind, text }: CodeToken) =>
    kind === 'plain'
      ? text
      : kind === 'function' && language === 'pseudocode'
        ? procedure(text)
        : html`<span class="tok-${kind}">${text}</span>`;

/** The panel's lines; `current` is the 1-based line of the current step. */
export function codeLines(
  source: Source,
  current: number | undefined,
): TemplateResult[] {
  const tokenOf = token(source.language);
  return linesOf(source).map(
    (line, k) =>
      html`<span class="line ${current === k + 1 ? 'current' : ''}"
        >${line.map(tokenOf)}</span
      >`,
  );
}
