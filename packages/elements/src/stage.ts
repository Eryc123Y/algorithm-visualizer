/**
 * Keyed reconciler that draws painted scenes into an <svg> and animates
 * between them (ADR 0010).
 *
 * Each scene item lives in its own <g>, found again by key on the next frame.
 * Its position is a CSS transform, so moving an item is a transform
 * animation; its content is replaced only when it changes. Items that appear
 * fade in; items that disappear fade out and are then removed. Cells that
 * trade places move along opposite arcs so they do not pass through each
 * other.
 */
import { num, serializeNode, type PaintedScene } from '@algoviz/svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Entry {
  readonly el: SVGGElement;
  markup: string;
  x: number;
  y: number;
  exiting: Animation | null;
}

export interface RenderOptions {
  /** Animation length in ms; 0 jumps straight to the new frame. */
  readonly duration: number;
  /**
   * How cells travel: `arc` lifts cells that move sideways so swapped cells
   * pass each other; `linear` moves everything in a straight line.
   * Default `arc`.
   */
  readonly motion?: 'arc' | 'linear';
}

const translate = (x: number, y: number) =>
  `translate(${num(x)}px, ${num(y)}px)`;

/** Height of the arc a moving cell follows, relative to its travel. */
const ARC_RATIO = 0.35;
const MAX_ARC = 34;

export class SceneStage {
  readonly #svg: SVGSVGElement;
  readonly #root: SVGGElement;
  readonly #title: SVGTitleElement;
  readonly #background: SVGRectElement;
  readonly #entries = new Map<string, Entry>();

  constructor(svg: SVGSVGElement) {
    this.#svg = svg;
    const doc = svg.ownerDocument;
    this.#title = doc.createElementNS(SVG_NS, 'title');
    this.#root = doc.createElementNS(SVG_NS, 'g');
    this.#background = doc.createElementNS(SVG_NS, 'rect');
    svg.replaceChildren(this.#title, this.#background, this.#root);
    svg.setAttribute('role', 'img');
  }

  /** Keys currently drawn (including items still fading out). */
  get keys(): string[] {
    return [...this.#entries.keys()];
  }

  render(
    scene: PaintedScene,
    { duration, motion = 'arc' }: RenderOptions,
  ): void {
    const svg = this.#svg;
    svg.setAttribute('viewBox', `0 0 ${num(scene.width)} ${num(scene.height)}`);
    svg.setAttribute('width', num(scene.width));
    svg.setAttribute('height', num(scene.height));
    this.#root.setAttribute('font-family', scene.fontFamily);
    this.#title.textContent = scene.title;
    // Same as renderSvg: the theme's background fills the whole scene.
    const bg = this.#background;
    if (scene.background === null) {
      bg.setAttribute('display', 'none');
    } else {
      bg.removeAttribute('display');
      bg.setAttribute('width', num(scene.width));
      bg.setAttribute('height', num(scene.height));
      bg.setAttribute('fill', scene.background);
    }

    const animate = duration > 0;
    const seen = new Set<string>();

    for (const item of scene.items) {
      seen.add(item.key);
      const markup = serializeNode(item.node);
      let entry = this.#entries.get(item.key);

      if (entry === undefined) {
        const el = svg.ownerDocument.createElementNS(SVG_NS, 'g');
        el.setAttribute('data-key', item.key);
        entry = { el, markup: '', x: item.x, y: item.y, exiting: null };
        this.#entries.set(item.key, entry);
        this.#root.append(el);
        el.style.transform = translate(item.x, item.y);
        if (animate) fade(el, 0, 1, duration);
      } else if (entry.exiting !== null) {
        // Reappeared while fading out: keep the element.
        entry.exiting.cancel();
        entry.exiting = null;
      }

      for (const [name, value] of Object.entries(item.attrs))
        entry.el.setAttribute(name, value);
      if (entry.markup !== markup) {
        entry.el.innerHTML = markup;
        entry.markup = markup;
      }
      if (entry.x !== item.x || entry.y !== item.y) {
        const arc = motion === 'arc' && item.attrs['data-role'] !== undefined;
        moveTo(entry, item.x, item.y, animate ? duration : 0, arc);
      }
    }

    for (const [key, entry] of this.#entries) {
      if (seen.has(key) || entry.exiting !== null) continue;
      if (!animate || typeof entry.el.animate !== 'function') {
        entry.el.remove();
        this.#entries.delete(key);
        continue;
      }
      entry.exiting = fade(entry.el, 1, 0, duration);
      entry.exiting.onfinish = () => {
        entry.el.remove();
        this.#entries.delete(key);
      };
    }
  }
}

function fade(
  el: SVGGElement,
  from: number,
  to: number,
  duration: number,
): Animation {
  if (typeof el.animate !== 'function') return { cancel() {} } as Animation;
  return el.animate([{ opacity: from }, { opacity: to }], {
    duration,
    easing: 'ease-out',
    fill: 'forwards',
  });
}

function moveTo(
  entry: Entry,
  x: number,
  y: number,
  duration: number,
  arc: boolean,
): void {
  const from = translate(entry.x, entry.y);
  const to = translate(x, y);
  const dx = x - entry.x;
  entry.x = x;
  entry.y = y;
  entry.el.style.transform = to;
  if (duration === 0 || typeof entry.el.animate !== 'function') return;

  const keyframes: Keyframe[] = [{ transform: from }];
  if (arc && Math.abs(dx) > 0) {
    // Rightward moves arc up, leftward moves arc down.
    const lift =
      Math.min(MAX_ARC, Math.abs(dx) * ARC_RATIO) * (dx > 0 ? -1 : 1);
    keyframes.push({ transform: translate(x - dx / 2, y + lift), offset: 0.5 });
  }
  keyframes.push({ transform: to });
  entry.el.animate(keyframes, {
    duration,
    easing: 'cubic-bezier(.45,.05,.25,1)',
  });
}
