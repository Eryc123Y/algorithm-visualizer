/**
 * The player's own words, in each locale (ADR 0045): its controls' names,
 * the frame status, the first frame's caption and its error sentences.
 * A document's text is shown as written.
 */
import type { Locale } from '@algomotion/spec';

export interface ChromeText {
  readonly initialState: string;
  readonly runFailed: string;
  readonly loadFailed: string;
  frameFailed(selector: string): string;
  readonly codeLanguage: string;
  sourceCode(language: string | undefined): string;
  readonly variables: string;
  readonly previous: string;
  readonly next: string;
  readonly play: string;
  readonly pause: string;
  readonly replay: string;
  readonly timeline: string;
  frameStatus(index: number, length: number, section?: string): string;
  /** The name of the code when it names no language. */
  readonly code: string;
  readonly pseudocode: string;
}

export const CHROME_TEXT: Readonly<Record<Locale, ChromeText>> = {
  en: {
    initialState: 'Initial state.',
    runFailed: 'This algorithm could not be run on its input.',
    loadFailed: 'This visualization could not be loaded.',
    frameFailed: (selector) => `Cannot open frame ${selector}.`,
    codeLanguage: 'Code language',
    sourceCode: (language) =>
      language === undefined ? 'Source code' : `Source code, ${language}`,
    variables: 'Variables',
    previous: 'Previous step',
    next: 'Next step',
    play: 'Play',
    pause: 'Pause',
    replay: 'Replay',
    timeline: 'Timeline',
    frameStatus: (index, length, section) =>
      `Frame ${index} of ${length}${section === undefined ? '' : `, ${section}`}`,
    code: 'Code',
    pseudocode: 'Pseudocode',
  },
  zh: {
    initialState: '初始状态。',
    runFailed: '无法在这组输入上运行这个算法。',
    loadFailed: '无法载入这个可视化。',
    frameFailed: (selector) => `无法打开帧 ${selector}。`,
    codeLanguage: '代码语言',
    sourceCode: (language) =>
      language === undefined ? '源代码' : `源代码：${language}`,
    variables: '变量',
    previous: '上一步',
    next: '下一步',
    play: '播放',
    pause: '暂停',
    replay: '重播',
    timeline: '时间轴',
    frameStatus: (index, length, section) =>
      `第 ${index} 帧，共 ${length} 帧${section === undefined ? '' : `：${section}`}`,
    code: '代码',
    pseudocode: '伪代码',
  },
};
