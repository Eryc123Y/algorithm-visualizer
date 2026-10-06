/**
 * Scene: a medium-independent description of one frame (ADR 0003).
 *
 * Painters (DOM, SVG, TikZ, …) turn a scene into output. Items carry
 * semantic roles instead of colours, and stable keys so painters can animate
 * an item from one frame to the next. Coordinates are in abstract units
 * (CSS pixels at 1×) with the origin at the top left.
 */

/**
 * How a cell or node is emphasised. When several marks apply, the first in
 * this order wins: compare, swap, highlight, settled, visited, default.
 */
export type ElementRole =
  'compare' | 'swap' | 'highlight' | 'settled' | 'visited' | 'default';

/** @deprecated Use `ElementRole`. */
export type BoxRole = ElementRole;

/** Categorical group 0–5 (e.g. a component); painters use distinct tones. */
export type GroupIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** `title`: a structure's name; `index`: position labels; `label`: small annotations such as "top" or "null". */
export type TextRole = 'title' | 'index' | 'label';

/** `link`: structural pointers (list `next`, tree child); the rest mark graph edges. */
export type EdgeRole =
  'default' | 'link' | 'highlight' | 'selected' | 'rejected';

export type BadgeRole = 'pointer';

export type ArrowRole = 'pointer';

export interface SceneBox {
  readonly type: 'box';
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly role: ElementRole;
  readonly group?: GroupIndex;
  /** Centred inside the box. */
  readonly text: string;
  readonly fontSize: number;
}

/** A circular node, e.g. of a tree or graph. */
export interface SceneNode {
  readonly type: 'node';
  readonly key: string;
  /** Centre. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /**
   * Total width when the text needs more room than the circle: the node is
   * then a stadium (a rectangle with semicircular ends) of height
   * `2 * radius`.
   */
  readonly width?: number;
  readonly role: ElementRole;
  readonly group?: GroupIndex;
  /** Red–black tree colour; part of the data, not decoration. */
  readonly variant?: 'red' | 'black';
  /** Centred inside the node. */
  readonly text: string;
  readonly fontSize: number;
  /** Small annotation outside the node, e.g. a distance. */
  readonly label?: string;
  /**
   * Where the label sits, in degrees clockwise from straight up (the
   * default); layouts turn it away from edges.
   */
  readonly labelAngle?: number;
}

/**
 * A connection between two points, straight or through `via`. Endpoints
 * are already trimmed to the shapes they connect. When both endpoints
 * coincide and there is no `via`, the edge is a self-loop drawn outward
 * from that point (up, or rotated by `loopAngle`).
 */
export interface SceneEdge {
  readonly type: 'edge';
  readonly key: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly role: EdgeRole;
  readonly directed: boolean;
  /** Bend points between the ends, for edges routed around nodes. */
  readonly via?: readonly { readonly x: number; readonly y: number }[];
  /** Self-loops: direction in degrees clockwise from up (default 0). */
  readonly loopAngle?: number;
  /** Drawn beside the middle of the edge, e.g. a weight. */
  readonly label?: string;
  /**
   * Which side of the edge, facing from (x1, y1) to (x2, y2), the label
   * goes on; painters choose (preferring above) when absent.
   */
  readonly labelSide?: 'left' | 'right';
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

export type SceneItem =
  SceneBox | SceneNode | SceneEdge | SceneText | SceneBadge | SceneArrow;

export interface Scene {
  readonly width: number;
  readonly height: number;
  /** Accessible description of the whole scene. */
  readonly title: string;
  /** In paint order: later items are drawn on top. */
  readonly items: readonly SceneItem[];
}
