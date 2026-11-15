/**
 * The words the layout draws itself, in each locale (ADR 0045). Everything
 * else a figure says comes from its document.
 */
import type { Locale } from '@algomotion/spec';

export interface LayoutWords {
  /** Under the title of a structure with nothing in it. */
  readonly empty: string;
  /** The stack's top, and the same for an empty stack. */
  readonly top: string;
  readonly topEmpty: string;
  /** The queue's ends. */
  readonly front: string;
  readonly back: string;
  /** The front of a min- or max-priority queue. */
  readonly min: string;
  readonly max: string;
}

export const LAYOUT_WORDS: Readonly<Record<Locale, LayoutWords>> = {
  en: {
    empty: '(empty)',
    top: 'top',
    topEmpty: 'top (empty)',
    front: 'front',
    back: 'back',
    min: 'min',
    max: 'max',
  },
  zh: {
    empty: '（空）',
    top: '栈顶',
    topEmpty: '栈顶（空）',
    front: '队头',
    back: '队尾',
    min: '最小',
    max: '最大',
  },
};
