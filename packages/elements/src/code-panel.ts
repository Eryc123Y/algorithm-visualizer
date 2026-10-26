/**
 * Lines of the source panel: `source.code` highlighted by `highlightCode`
 * from @algoviz/core, one `.line` per source line, with the current step's
 * line marked. Token colours are the `--algo-code-*` custom properties.
 */
import { html, type TemplateResult } from 'lit';

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

const token = ({ kind, text }: CodeToken) =>
  kind === 'plain' ? text : html`<span class="tok-${kind}">${text}</span>`;

/** The panel's lines; `current` is the 1-based line of the current step. */
export function codeLines(
  source: Source,
  current: number | undefined,
): TemplateResult[] {
  return linesOf(source).map(
    (line, k) =>
      html`<span class="line ${current === k + 1 ? 'current' : ''}"
        >${line.map(token)}</span
      >`,
  );
}
