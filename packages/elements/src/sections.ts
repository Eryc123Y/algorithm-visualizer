/**
 * Sections and selectors in the player (ADR 0020): reading the `frame`
 * attribute, choosing the frame a selector opens at, and the strip of
 * sections under the timeline.
 */
import { html, noChange } from 'lit';
import {
  Directive,
  directive,
  PartType,
  type ElementPart,
  type PartInfo,
} from 'lit/directive.js';

import {
  parseSelector,
  selectFrames,
  type SelectorError,
} from '@algomotion/core';
import {
  ok,
  type Result,
  type Section,
  type Visualization,
} from '@algomotion/spec';

/** A frame number, or a selector such as `relax#2` (ADR 0020). */
export type FrameSelector = number | string;

/** A selector that matched nothing, shown until the next one. */
export interface FrameError {
  readonly selector: string;
  readonly error: SelectorError;
}

/**
 * Plain non-negative integers are frame numbers, as before selectors;
 * anything else, including negative numbers, is read as a selector.
 */
export const frameConverter = {
  fromAttribute(value: string | null): FrameSelector {
    const text = (value ?? '0').trim();
    return /^(?:0|[1-9][0-9]{0,8})$/.test(text) ? Number(text) : text;
  },
  toAttribute: (value: FrameSelector): string => String(value),
};

/**
 * Where the player opens for a selector: its first frame, except that a
 * selector that starts with a section opens at the section's first step,
 * because the frame before that step still shows the step before it.
 */
export function openingFrame(
  doc: Visualization,
  selector: FrameSelector,
): Result<number, SelectorError> {
  const range = selectFrames(doc, selector);
  if (!range.ok) return range;
  const parsed =
    typeof selector === 'string' ? parseSelector(selector) : undefined;
  const first =
    parsed?.ok === true
      ? parsed.value.type === 'range'
        ? parsed.value.from
        : parsed.value
      : undefined;
  const section =
    first?.type === 'name' &&
    first.section === undefined &&
    first.nth === undefined
      ? doc.sections?.find((s) => s.id === first.name)
      : undefined;
  return ok(section === undefined ? range.value.from : section.start + 1);
}

/**
 * Sets an element's left edge and width through CSSOM. Lit's `styleMap`
 * writes a style attribute on its first render, which a Content Security
 * Policy without 'unsafe-inline' blocks, as the share page's does
 * (ADR 0040); CSSOM is not blocked.
 */
class Place extends Directive {
  constructor(info: PartInfo) {
    super(info);
    if (info.type !== PartType.ELEMENT)
      throw new Error('place() goes on an element');
  }

  // The arguments only type the directive's call; update() uses them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(_left: string, _width: string): unknown {
    return noChange;
  }

  override update(part: ElementPart, [left, width]: [string, string]) {
    const { style } = part.element as HTMLElement;
    style.left = left;
    style.width = width;
    return noChange;
  }
}

const place = directive(Place);

/**
 * Each section as a stretch of the timeline under the slider, from its
 * first frame to its last, so its left edge marks where it starts. Pointer
 * users click a section to go to its first step; keyboard users press Page
 * Up and Page Down, and the slider's value text names the section.
 */
export function sectionStrip(
  sections: readonly Section[],
  length: number,
  current: Section | undefined,
  seek: (frame: number) => void,
) {
  const percent = (frame: number) => `${(100 * frame) / Math.max(1, length)}%`;
  return html`<div class="sections" part="sections" aria-hidden="true">
    <div class="track">
      ${sections.map((s, k) => {
        const end = sections[k + 1]?.start ?? length;
        return html`<span
          class="section ${s.id === current?.id ? 'current' : ''}"
          ${place(percent(s.start), percent(end - s.start))}
          title=${s.title}
          @click=${() => seek(Math.min(s.start + 1, length))}
          ><span class="label">${s.title}</span></span
        >`;
      })}
    </div>
  </div>`;
}
