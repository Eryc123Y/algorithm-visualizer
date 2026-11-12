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
import {
  num,
  serializeNode,
  type PaintedScene,
  type SvgNode,
} from '@algomotion/svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Builds a painted node as SVG elements. Nothing is parsed as markup:
 * text becomes text nodes and values become attributes, so labels from an
 * untrusted document stay text, and pages can enforce Trusted Types
 * (ADR 0040).
 */
function build(doc: Document, node: SvgNode): SVGElement {
  const el = doc.createElementNS(SVG_NS, node.tag);
  for (const [name, value] of Object.entries(node.attrs))
    el.setAttribute(name, value);
  if (node.text !== undefined) el.textContent = node.text;
  for (const child of node.children ?? []) el.append(build(doc, child));
  return el;
}

interface Entry {
  readonly el: SVGGElement;
  /** The content's markup, kept only to tell whether it changed. */
  markup: string;
  x: number;
  y: number;
  /** Degrees; accumulated so successive moves take the shortest turn. */
  rotate: number | undefined;
  scaleX: number | undefined;
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

const transformOf = (
  x: number,
  y: number,
  rotate: number | undefined,
  scaleX: number | undefined,
) =>
  `translate(${num(x)}px, ${num(y)}px)` +
  (rotate === undefined ? '' : ` rotate(${num(rotate)}deg)`) +
  (scaleX === undefined ? '' : ` scale(${num(scaleX)}, 1)`);

/** The angle equal to `target` (mod 360) that is closest to `from`. */
const nearestAngle = (from: number, target: number) =>
  from + ((((target - from) % 360) + 540) % 360) - 180;

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
        entry = {
          el,
          markup: '',
          x: item.x,
          y: item.y,
          rotate: item.rotate,
          scaleX: item.scaleX,
          exiting: null,
        };
        this.#entries.set(item.key, entry);
        this.#root.append(el);
        el.style.transform = transformOf(
          item.x,
          item.y,
          item.rotate,
          item.scaleX,
        );
        if (animate) fade(el, 0, 1, duration);
      } else if (entry.exiting !== null) {
        // Reappeared while fading out: keep the element.
        entry.exiting.cancel();
        entry.exiting = null;
      }

      for (const [name, value] of Object.entries(item.attrs))
        entry.el.setAttribute(name, value);
      if (entry.markup !== markup) {
        entry.el.replaceChildren(build(svg.ownerDocument, item.node));
        entry.markup = markup;
      }
      const rotate =
        item.rotate === undefined || entry.rotate === undefined
          ? item.rotate
          : nearestAngle(entry.rotate, item.rotate);
      if (
        entry.x !== item.x ||
        entry.y !== item.y ||
        entry.rotate !== rotate ||
        entry.scaleX !== item.scaleX
      ) {
        // Lift only cells moving sideways within a row (e.g. a swap).
        const arc =
          motion === 'arc' &&
          item.attrs['data-role'] !== undefined &&
          entry.y === item.y;
        moveTo(
          entry,
          { x: item.x, y: item.y, rotate, scaleX: item.scaleX },
          animate ? duration : 0,
          arc,
        );
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

interface Placement {
  readonly x: number;
  readonly y: number;
  readonly rotate: number | undefined;
  readonly scaleX: number | undefined;
}

function moveTo(
  entry: Entry,
  to: Placement,
  duration: number,
  arc: boolean,
): void {
  const from = transformOf(entry.x, entry.y, entry.rotate, entry.scaleX);
  const target = transformOf(to.x, to.y, to.rotate, to.scaleX);
  const dx = to.x - entry.x;
  entry.x = to.x;
  entry.y = to.y;
  entry.rotate = to.rotate;
  entry.scaleX = to.scaleX;
  entry.el.style.transform = target;
  if (duration === 0 || typeof entry.el.animate !== 'function') return;

  const keyframes: Keyframe[] = [{ transform: from }];
  if (arc && Math.abs(dx) > 0) {
    // Rightward moves arc up, leftward moves arc down.
    const lift =
      Math.min(MAX_ARC, Math.abs(dx) * ARC_RATIO) * (dx > 0 ? -1 : 1);
    keyframes.push({
      transform: transformOf(to.x - dx / 2, to.y + lift, to.rotate, to.scaleX),
      offset: 0.5,
    });
  }
  keyframes.push({ transform: target });
  entry.el.animate(keyframes, {
    duration,
    easing: 'cubic-bezier(.45,.05,.25,1)',
  });
}
