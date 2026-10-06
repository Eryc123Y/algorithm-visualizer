/**
 * Scene: a medium-independent description of one frame (ADR 0003).
 *
 * Painters (DOM, SVG, TikZ, …) turn a scene into output. Items carry
 * semantic roles instead of colours, and stable keys so painters can animate
 * an item from one frame to the next. Coordinates are in abstract units
 * (CSS pixels at 1×) with the origin at the top left.
 */

/** How a cell is emphasised. When several marks apply, the first wins. */
export type BoxRole = 'compare' | 'swap' | 'highlight' | 'settled' | 'default';

export type TextRole = 'title' | 'index';

export type BadgeRole = 'pointer';

export type ArrowRole = 'pointer';

export interface SceneBox {
  readonly type: 'box';
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly role: BoxRole;
  /** Centred inside the box. */
  readonly text: string;
  readonly fontSize: number;
}

export interface SceneText {
  readonly type: 'text';
  readonly key: string;
  /** Anchor point; `y` is the vertical centre of the text. */
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly role: TextRole;
  readonly text: string;
  readonly fontSize: number;
}

export interface SceneArrow {
  readonly type: 'arrow';
  readonly key: string;
  /** From the tail `(x1, y1)` to the head `(x2, y2)`. */
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly role: ArrowRole;
}

/** A short label on a rounded background, e.g. a pointer name. */
export interface SceneBadge {
  readonly type: 'badge';
  readonly key: string;
  /** Centre of the badge. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly role: BadgeRole;
  readonly text: string;
  readonly fontSize: number;
}

export type SceneItem = SceneBox | SceneText | SceneBadge | SceneArrow;

export interface Scene {
  readonly width: number;
  readonly height: number;
  /** Accessible description of the whole scene. */
  readonly title: string;
  /** In paint order: later items are drawn on top. */
  readonly items: readonly SceneItem[];
}
