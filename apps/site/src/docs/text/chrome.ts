/**
 * The words of the frame every page shares, in each locale: the bar, the
 * footer, breadcrumbs, the guide's sidebar and pager, snippet labels and
 * topic names. One interface, so neither language can miss a string.
 */
import type { Topic } from '@algomotion/recipes';

import type { Locale } from '../locale.ts';
import type { Snippet } from '../snippets.ts';

export interface ChromeText {
  readonly skip: string;
  readonly siteNav: string;
  readonly nav: {
    readonly why: string;
    readonly guide: string;
    readonly algorithms: string;
    readonly themes: string;
  };
  /** The language switch: the other language's name, in that language. */
  readonly switchTo: string;
  readonly footer: {
    readonly useIt: string;
    readonly moreWays: string;
    readonly reference: string;
    readonly project: string;
    readonly web: string;
    readonly typst: string;
    readonly latex: string;
    readonly slides: string;
    readonly cli: string;
    readonly ai: string;
    readonly shareLinks: string;
    readonly sharePage: string;
    readonly inputs: string;
    readonly documents: string;
    readonly algorithms: string;
    readonly themes: string;
    readonly why: string;
    readonly source: string;
    readonly changelog: string;
    readonly roadmap: string;
    readonly contributing: string;
    readonly report: string;
    readonly designRecords: string;
    readonly colophon: string;
    /**
     * The build line, as HTML, from pieces that are HTML already: the
     * version (escaped), the commit's link and its date, if known, and
     * the link to the changelog.
     */
    readonly build: (parts: {
      readonly version: string;
      readonly commit?: string;
      readonly date?: string;
      readonly changelog: string;
    }) => string;
    readonly whatChanged: string;
  };
  readonly breadcrumb: string;
  readonly guide: {
    readonly title: string;
    readonly sidebar: string;
    readonly pager: string;
    readonly previous: string;
    readonly next: string;
    /** The sidebar's groups, in `GUIDE_GROUPS` order. */
    readonly groups: readonly string[];
  };
  readonly snippets: Readonly<Record<Snippet['id'], string>>;
  readonly topics: Readonly<Record<Topic, string>>;
}

const en: ChromeText = {
  skip: 'Skip to the content',
  siteNav: 'Site',
  nav: {
    why: 'Why',
    guide: 'Guide',
    algorithms: 'Algorithms',
    themes: 'Themes',
  },
  switchTo: '中文',
  footer: {
    useIt: 'Use it',
    moreWays: 'More ways',
    reference: 'Reference',
    project: 'Project',
    web: 'On a web page',
    typst: 'In Typst',
    latex: 'In LaTeX',
    slides: 'In slides',
    cli: 'Command line',
    ai: 'AI assistants',
    shareLinks: 'Share links',
    sharePage: 'Share page',
    inputs: 'Inputs',
    documents: 'Documents',
    algorithms: 'Algorithms',
    themes: 'Themes',
    why: 'Why algomotion',
    source: 'Source on GitHub',
    changelog: 'Changelog',
    roadmap: 'Roadmap',
    contributing: 'Contributing',
    report: 'Report a problem',
    designRecords: 'Design records',
    colophon:
      'Every figure on this site is drawn by algomotion’s own engine, from the same registry the packages ship.',
    build: ({ version, commit, date, changelog }) =>
      `Version ${version}${commit === undefined ? '' : `, built from commit ${commit}${date === undefined ? '' : ` of ${date}`}`}. ${changelog}.`,
    whatChanged: 'What changed',
  },
  breadcrumb: 'Breadcrumb',
  guide: {
    title: 'Guide',
    sidebar: 'Guide',
    pager: 'Guide pages',
    previous: 'Previous',
    next: 'Next',
    groups: ['Start', 'Outputs', 'Sharing and AI', 'Reference'],
  },
  snippets: {
    web: 'On a web page',
    typst: 'In Typst',
    latex: 'In LaTeX',
    cli: 'On the command line',
    mcp: 'To a model, through MCP',
    link: 'As a share link',
  },
  topics: {
    sorting: 'Sorting',
    searching: 'Searching',
    lists: 'Lists, stacks and queues',
    trees: 'Trees',
    heaps: 'Heaps',
    hashing: 'Hashing',
    graphs: 'Graphs',
    'dynamic-programming': 'Dynamic programming',
    greedy: 'Greedy algorithms',
    strings: 'String matching',
    geometry: 'Computational geometry',
    math: 'Algebra and number theory',
    foundations: 'Divide and conquer, randomization',
    amortized: 'Amortized analysis',
  },
};

const zh: ChromeText = {
  skip: '跳到正文',
  siteNav: '站点',
  nav: {
    why: '为什么',
    guide: '指南',
    algorithms: '算法',
    themes: '主题',
  },
  switchTo: 'English',
  footer: {
    useIt: '用在哪里',
    moreWays: '更多用法',
    reference: '参考',
    project: '项目',
    web: '网页',
    typst: 'Typst',
    latex: 'LaTeX',
    slides: '幻灯片',
    cli: '命令行',
    ai: 'AI 助手',
    shareLinks: '分享链接',
    sharePage: '分享页',
    inputs: '输入写法',
    documents: '文档格式',
    algorithms: '算法目录',
    themes: '主题',
    why: '为什么用 algomotion',
    source: 'GitHub 上的源码',
    changelog: '更新日志',
    roadmap: '路线图',
    contributing: '参与贡献',
    report: '报告问题',
    designRecords: '设计决策记录',
    colophon:
      '本站的每一幅图都由 algomotion 自己的引擎绘制，所用的算法注册表和发布的包是同一份。',
    build: ({ version, commit, date, changelog }) =>
      `版本 ${version}${commit === undefined ? '' : `，构建自${date === undefined ? '' : ` ${date} 的`}提交 ${commit}`}。${changelog}`,
    whatChanged: '更新日志',
  },
  breadcrumb: '页面路径',
  guide: {
    title: '指南',
    sidebar: '指南目录',
    pager: '翻页',
    previous: '上一页',
    next: '下一页',
    groups: ['入门', '输出', '分享与 AI', '参考'],
  },
  snippets: {
    web: '在网页中',
    typst: '在 Typst 中',
    latex: '在 LaTeX 中',
    cli: '在命令行中',
    mcp: '通过 MCP 交给模型',
    link: '作为分享链接',
  },
  topics: {
    sorting: '排序',
    searching: '查找',
    lists: '链表、栈与队列',
    trees: '树',
    heaps: '堆',
    hashing: '散列',
    graphs: '图',
    'dynamic-programming': '动态规划',
    greedy: '贪心算法',
    strings: '字符串匹配',
    geometry: '计算几何',
    math: '代数与数论',
    foundations: '分治与随机化',
    amortized: '摊还分析',
  },
};

export const CHROME: Readonly<Record<Locale, ChromeText>> = { en, zh };
