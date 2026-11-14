/**
 * The words of the catalogue, the themes page and the missing page, in
 * each locale (roadmap 5.7). Module titles and summaries come from the
 * registry and stay English until 5.8.
 */
import type { ThemeName } from '@algomotion/svg';

import type { Locale } from '../locale.ts';

export interface PagesText {
  readonly algorithms: {
    readonly title: string;
    readonly heading: string;
    readonly description: (count: number) => string;
    readonly lede: (count: number) => string;
    /** Said once, in Chinese only: the module names are English. */
    readonly englishNote: string;
    readonly catalogue: string;
    readonly filter: string;
    readonly topics: string;
    readonly operations: (structure: string) => string;
  };
  readonly themes: {
    readonly title: string;
    readonly heading: string;
    readonly description: string;
    /** HTML. */
    readonly lede: string;
    readonly picking: string;
    readonly table: string;
    readonly output: string;
    readonly how: string;
    readonly outputs: readonly [string, string, string, string, string, string];
    readonly list: string;
    readonly listLede: string;
    readonly alt: (theme: string) => string;
    readonly notes: Readonly<Record<ThemeName, string>>;
  };
  readonly notFound: {
    readonly title: string;
    readonly description: string;
    readonly heading: string;
    /** HTML, with `{algorithms}` and `{guide}` for the two links' roots. */
    readonly lede: (algorithms: string, guide: string) => string;
  };
}

const en: PagesText = {
  algorithms: {
    title: 'Algorithms and data structures · algomotion',
    heading: 'Algorithms and data structures',
    description: (n) =>
      `All ${n} algorithms, data structures and operations algomotion draws, by topic.`,
    lede: (n) =>
      `${n} modules, each with its own page: a player, the names of its steps, and the same run written for a web page, Typst, LaTeX, the command line, an AI assistant and a share link. A data structure’s operations are listed under it.`,
    englishNote: '',
    catalogue: 'Catalogue',
    filter: 'Filter',
    topics: 'Topics',
    operations: (s) => `${s} operations`,
  },
  themes: {
    title: 'Themes · algomotion',
    heading: 'Themes',
    description:
      'The built-in themes of algomotion, and how to pick one in each output.',
    lede: 'Every output draws in the same built-in themes, and every theme works in every output. <code>light</code> is the default; the player’s <code>auto</code> follows the reader’s light or dark setting, and a pair such as <code>textbook textbook-dark</code> picks a day and a night theme.',
    picking: 'Picking a theme',
    table: 'How each output picks a theme',
    output: 'Output',
    how: 'How',
    outputs: [
      'Web page',
      'Typst',
      'LaTeX',
      'Command line',
      'MCP',
      'Share link',
    ],
    list: 'The themes',
    listLede: 'Dijkstra’s algorithm at its third improvement, in each theme.',
    alt: (t) => `Dijkstra’s algorithm drawn in the ${t} theme`,
    notes: {
      light: 'The default: web pages, notes and slides.',
      dark: 'Dark pages and slides.',
      print: 'Greyscale handouts; every role keeps a cue that is not colour.',
      textbook: 'A textbook figure marked up with highlighter and pens.',
      'textbook-dark': 'The same page in a reader’s night mode.',
      blocks: 'Classroom blocks in bold colours, for introductory classes.',
      'blocks-dark': 'The same blocks on a dark mat.',
      'answer-sheet': 'An exam answer sheet: red printed frames, pencil marks.',
      'turbo-c': 'The blue Turbo C screen of university computer labs.',
    },
  },
  notFound: {
    title: 'Not found · algomotion',
    description: 'This page does not exist.',
    heading: 'Not found',
    lede: (a, g) =>
      `There is no page at this address. The <a href="${a}">catalogue</a> lists every algorithm and data structure, and <a href="${g}">the guide</a> shows how to use them.`,
  },
};

const zh: PagesText = {
  algorithms: {
    title: '算法与数据结构 · algomotion',
    heading: '算法与数据结构',
    description: (n) =>
      `algomotion 能画的全部 ${n} 个算法、数据结构和操作，按领域排列。`,
    lede: (n) =>
      `共 ${n} 个模块，每个都有自己的页面：一个播放器、各步骤的名字，以及同一次运行写成网页、Typst、LaTeX、命令行、AI 助手和分享链接各自的代码。数据结构的操作列在它下面。`,
    englishNote:
      '模块的名称和简介目前还是英文，模块页面也只有英文版；产品本身的中文化在路线图 5.8。',
    catalogue: '目录',
    filter: '筛选',
    topics: '领域',
    operations: (s) => `${s} 的操作`,
  },
  themes: {
    title: '主题 · algomotion',
    heading: '主题',
    description: 'algomotion 的内置主题，以及在每种输出里怎么选主题。',
    lede: '所有输出用的是同一套内置主题，每个主题在每种输出里都能用。默认主题是 <code>light</code>；播放器的 <code>auto</code> 跟随读者的浅色或深色设置；写成一对，比如 <code>textbook textbook-dark</code>，就分别指定白天和夜间的主题。',
    picking: '选择主题',
    table: '每种输出怎么选主题',
    output: '输出',
    how: '写法',
    outputs: ['网页', 'Typst', 'LaTeX', '命令行', 'MCP', '分享链接'],
    list: '各个主题',
    listLede: 'Dijkstra 算法第三次改进距离时的样子，每个主题一幅。',
    alt: (t) => `用 ${t} 主题画的 Dijkstra 算法`,
    notes: {
      light: '默认主题：网页、笔记和幻灯片。',
      dark: '深色页面和幻灯片。',
      print: '灰度讲义；每种角色都有颜色以外的标记。',
      textbook: '像用荧光笔和彩笔标注过的教材插图。',
      'textbook-dark': '同一页教材，换成读者的夜间模式。',
      blocks: '色彩醒目的积木风格，适合入门课。',
      'blocks-dark': '同样的积木，放在深色垫子上。',
      'answer-sheet': '考试答题纸：红色印刷框线，铅笔记号。',
      'turbo-c': '大学机房里 Turbo C 的蓝色屏幕。',
    },
  },
  notFound: {
    title: '页面不存在 · algomotion',
    description: '这个页面不存在。',
    heading: '页面不存在',
    lede: (a, g) =>
      `这个地址没有页面。<a href="${a}">算法目录</a>列出了所有算法和数据结构，<a href="${g}">指南</a>介绍怎么使用它们。`,
  },
};

export const PAGES: Readonly<Record<Locale, PagesText>> = { en, zh };
