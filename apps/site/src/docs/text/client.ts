/**
 * The words the pages' script writes into a page (roadmap 5.7): copy
 * buttons, the catalogue's filter, the slides' loop and the playground.
 * The script picks the table by the page's `lang`.
 */
import type { Locale } from '../locale.ts';

export interface ClientText {
  readonly copy: string;
  readonly copyLabel: (label: string) => string;
  readonly copied: string;
  readonly selectToCopy: string;
  readonly filterNone: string;
  readonly filterCount: (shown: number, total: number) => string;
  readonly pause: string;
  readonly play: string;
  readonly playground: {
    readonly doesNotRun: string;
    readonly kept: string;
    readonly couldNotRun: (message: string) => string;
    readonly empty: string;
    readonly emptyHint: string;
    /** The caption around the input: before and after its `<code>`. */
    readonly caption: (title: string) => readonly [string, string];
  };
}

const en: ClientText = {
  copy: 'Copy',
  copyLabel: (label) => `Copy: ${label}`,
  copied: 'Copied',
  selectToCopy: 'Select and copy',
  filterNone: 'Nothing matches; try fewer words.',
  filterCount: (shown, total) => `${shown} of ${total} shown.`,
  pause: 'Pause',
  play: 'Play',
  playground: {
    doesNotRun: 'This input does not run.',
    kept: 'The player keeps the last input that ran.',
    couldNotRun: (m) => `The page could not run it: ${m}`,
    empty: 'The input is empty.',
    emptyHint:
      'Write an input, or choose the algorithm again to get its example back.',
    caption: (title) => [`${title} on `, '.'],
  },
};

const zh: ClientText = {
  copy: '复制',
  copyLabel: (label) => `复制：${label}`,
  copied: '已复制',
  selectToCopy: '请选中后手动复制',
  filterNone: '没有匹配项，试试少输几个词。',
  filterCount: (shown, total) => `共 ${total} 项，显示 ${shown} 项。`,
  pause: '暂停',
  play: '播放',
  playground: {
    doesNotRun: '这个输入无法运行。',
    kept: '播放器保留上一次能运行的输入。',
    couldNotRun: (m) => `页面无法运行它：${m}`,
    empty: '输入为空。',
    emptyHint: '写一个输入，或重新选择算法，示例就会回来。',
    caption: (title) => [`${title}，输入为 `, '。'],
  },
};

export const CLIENT: Readonly<Record<Locale, ClientText>> = { en, zh };

/** The table for a page whose `lang` is `lang`. */
export const clientText = (lang: string): ClientText =>
  CLIENT[lang.startsWith('zh') ? 'zh' : 'en'];
