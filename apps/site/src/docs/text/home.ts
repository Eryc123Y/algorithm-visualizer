/**
 * The home page's words, in each locale (roadmap 5.7): the hero and its
 * playground, the plate, the outputs, the short case for /why/, the
 * audiences, the themes and the catalogue. Strings that hold markup say
 * so; every other string is escaped where it is used.
 */
import type { Locale } from '../locale.ts';
import type { Snippet } from '../snippets.ts';

export type OutputId = Snippet['id'] | 'slides';

export interface HomeText {
  readonly title: string;
  readonly description: string;
  readonly hero: {
    readonly title: string;
    readonly lede: string;
    readonly getStarted: string;
    readonly browse: (count: number) => string;
    readonly fine: string;
  };
  readonly playground: {
    readonly label: string;
    readonly algorithm: string;
    readonly input: string;
    readonly useExample: string;
    readonly featured: string;
    /** The caption around the input: before and after its `<code>`. */
    readonly caption: (title: string) => readonly [string, string];
    readonly pressPlay: string;
    readonly openShare: string;
  };
  readonly plate: {
    readonly title: string;
    /** HTML. */
    readonly lede: string;
    readonly figure: string;
    readonly caption: string;
  };
  readonly outputs: {
    readonly title: string;
    readonly lede: string;
    readonly tablist: string;
    readonly tabs: Readonly<
      Record<OutputId, { readonly tab: string; readonly lede: string }>
    >;
    readonly guide: (tab: string) => string;
    readonly inSlides: string;
    readonly overlays: string;
    /** HTML captions of the real scenes. */
    readonly scenes: {
      readonly notes: string;
      readonly beamer: string;
      readonly terminal: string;
      readonly chat: string;
    };
    readonly linkCaption: string;
    readonly webCaption: string;
    /** The alternative text of the outputs' figures. */
    readonly alts: Readonly<Record<Snippet['id'], string>>;
    readonly exampleCaption: (tab: string) => string;
    /** The drawn conversation, shown only when the scenes are missing. */
    readonly chat: {
      readonly label: string;
      readonly you: string;
      readonly tool: string;
      readonly assistant: string;
      readonly asked: string;
      /** HTML. */
      readonly ran: string;
      readonly answered: string;
    };
  };
  readonly why: {
    readonly title: string;
    readonly lede: string;
    readonly reasons: readonly {
      readonly title: string;
      readonly text: string;
    }[];
    readonly more: string;
  };
  readonly audiences: {
    readonly title: string;
    readonly who: readonly {
      readonly title: string;
      readonly text: string;
      readonly link: string;
      readonly href: string;
    }[];
  };
  readonly themes: {
    readonly title: string;
    readonly lede: string;
    readonly how: string;
    readonly list: string;
    readonly alt: (theme: string) => string;
  };
  readonly catalog: {
    readonly title: (count: number) => string;
    readonly lede: string;
    readonly browse: (count: number) => string;
  };
}

const en: HomeText = {
  title: 'algomotion: step-by-step algorithms',
  description:
    'Step-by-step pictures and animations of algorithms and data structures, from one algorithm name and your input, for web pages, Typst, LaTeX, slides and AI conversations.',
  hero: {
    title: 'Every step of an algorithm, drawn.',
    lede: 'Name an algorithm and give it your input, in the notation you already write. algomotion runs it and draws each step: an animation for a web page, figures for Typst and LaTeX notes, overlays for slides, and a player inside AI conversations.',
    getStarted: 'Get started',
    browse: (n) => `Browse ${n} algorithms`,
    fine: 'The source is public. The player runs in the reader’s browser, and share links carry their run in the link itself.',
  },
  playground: {
    label: 'Try an algorithm',
    algorithm: 'Algorithm',
    input: 'Input',
    useExample: 'Use example',
    featured: 'Featured',
    caption: (title) => [`${title} on `, '.'],
    pressPlay: 'Press play, or step with the arrow keys.',
    openShare: 'Open in the share page',
  },
  plate: {
    title: 'The same run, as figures for your notes',
    lede: 'Every step has a name, so a figure can be asked for by what happens in it: <code>extract#2</code> is the second vertex taken from the queue. Each one is a vector figure, in the theme you pick.',
    figure: 'Figure 1.',
    caption: 'Dijkstra’s algorithm from A on the graph above.',
  },
  outputs: {
    title: 'One input, wherever you write',
    lede: 'The run above, written for each place it can go: change the algorithm or its input, and every snippet follows. Every output draws with the same engine, so a figure in your notes matches the player on your course page.',
    tablist: 'Outputs',
    tabs: {
      web: {
        tab: 'Web page',
        lede: 'One script and one element. The player has step controls, the code with its current line, narration, keyboard shortcuts, and light and dark themes.',
      },
      typst: {
        tab: 'Typst',
        lede: 'A function call in your notes draws the step you name as a vector figure. The engine runs inside the package, so there is nothing else to install.',
      },
      latex: {
        tab: 'LaTeX',
        lede: 'A command draws the figure in TikZ, so its text is set in your document’s own fonts. Figures are cached, so later runs need no shell escape.',
      },
      slides: {
        tab: 'Slides',
        lede: 'In Beamer, the steps key turns a figure into overlays of one picture, one slide per step. In Typst, algomotion-slides does the same with polylux’s or Touying’s only.',
      },
      cli: {
        tab: 'Command line',
        lede: 'Export any frames as SVG or TikZ files, run an algorithm to a JSON document, or check a document you wrote. A standalone build needs no Node.js.',
      },
      mcp: {
        tab: 'AI assistants',
        lede: 'Connect Claude or any MCP client, and ask. The model runs the algorithm with the tools and shows the player right in the conversation.',
      },
      link: {
        tab: 'Share link',
        lede: 'A link carries the whole run after the #, so it opens in any browser and no server stores it. Paste it in a course page or a chat.',
      },
    },
    guide: (tab) => `The ${tab} guide`,
    inSlides: 'In slides',
    overlays: 'Three overlays of one slide',
    scenes: {
      notes: 'A page of notes, as Typst compiles it.',
      beamer:
        'Three overlays of one Beamer frame, from <code>steps=extract\\#2..improve\\#3</code>, as <code>latexmk</code> compiles them.',
      terminal: 'The command, run: what it printed.',
      chat: 'The player after a real <code>algomotion_show</code> call, in a minimal MCP Apps host.',
    },
    linkCaption: 'The link opens this player, in any browser.',
    webCaption: 'The element, as the reader sees it.',
    alts: {
      web: 'The player at C’s improvement to 5, in the blocks theme.',
      typst: 'C improves to 5, through B, in the textbook theme.',
      latex: 'C improves to 5, through B, in the print theme.',
      cli: 'C is final, at 5.',
      mcp: 'C improves to 5.',
      link: 'Every distance is final.',
    },
    exampleCaption: (tab) => `The example run, as the ${tab} snippet draws it.`,
    chat: {
      label: 'A conversation with an AI assistant',
      you: 'You',
      tool: 'Tool',
      assistant: 'Assistant',
      asked:
        'Show me Dijkstra’s algorithm from A on A-B 4, B-C 1, A-C 7, C-D 2.',
      ran: '<code>algomotion_show</code> ran <code>dijkstra</code>: 14 steps.',
      answered:
        'Here it is. At step 7, C drops from 7 to 5: going through B is shorter than the direct edge. Step through it, and ask about any step.',
    },
  },
  why: {
    title: 'Why not draw it by hand?',
    lede: 'Hand-drawn figures give exact control, and Manim makes polished videos. algomotion is for something narrower.',
    reasons: [
      {
        title: 'The steps come from running it',
        text: 'Name the algorithm and give it your input. Nothing is drawn by hand, so a new input is a new run, not an evening of redrawing.',
      },
      {
        title: 'One run, every place',
        text: 'The figure in your notes, the overlays on your slides and the player on your course page are the same run, in the same theme.',
      },
      {
        title: 'Honest about its limits',
        text: 'It draws the algorithms in its catalogue and documents you write, laid out automatically, as still figures or a player. No video.',
      },
    ],
    more: 'Why algomotion, compared',
  },
  audiences: {
    title: 'Made for the places algorithms are taught',
    who: [
      {
        title: 'Students',
        text: 'Put the exact step you are writing about into your Typst or LaTeX notes, on your own input, and have it look like the textbook.',
        link: 'Figures in notes',
        href: 'guide/typst/',
      },
      {
        title: 'Teachers',
        text: 'Step through a run on a slide, one click per step, or hand out a link that plays it. Themes for print, exams and dark rooms.',
        link: 'Figures on slides',
        href: 'guide/slides/',
      },
      {
        title: 'Developers and models',
        text: 'Embed the player in any page, or let a model write and check a visualization through MCP, then show it in the chat.',
        link: 'Connect an assistant',
        href: 'guide/ai/',
      },
    ],
  },
  themes: {
    title: 'Nine themes, every output',
    lede: 'The same figure for a screen, a handout, a highlighter-marked textbook page or the blue screen of a computer lab.',
    how: 'See how to pick one',
    list: 'The nine themes',
    alt: (t) => `Dijkstra’s algorithm in the ${t} theme.`,
  },
  catalog: {
    title: (n) => `${n} algorithms and data structures`,
    lede: 'The undergraduate canon, from insertion sort to maximum flow, each with its own page, player and snippets. Data structures come with every operation on its own.',
    browse: (n) => `Browse all ${n}`,
  },
};

/** A word followed by Chinese: a space after Latin letters or digits. */
const spaced = (word: string): string =>
  /[A-Za-z0-9]$/.test(word) ? `${word} ` : word;

const zh: HomeText = {
  title: 'algomotion：一步一步画出算法',
  description:
    '给出算法名和你的输入，algomotion 就把算法和数据结构的每一步画出来：用在网页、Typst、LaTeX、幻灯片和 AI 对话里。',
  hero: {
    title: '算法的每一步，都画出来。',
    lede: '说出算法名，用你平时就在写的记法给出输入。algomotion 运行它，画出每一步：网页上是动画，Typst 和 LaTeX 笔记里是插图，幻灯片上是逐步显示的叠层，AI 对话里是播放器。',
    getStarted: '开始使用',
    browse: (n) => `浏览 ${n} 个算法`,
    fine: '源码公开。播放器在读者自己的浏览器里运行，分享链接把整个运行过程写在链接本身里。',
  },
  playground: {
    label: '试一个算法',
    algorithm: '算法',
    input: '输入',
    useExample: '用示例',
    featured: '推荐',
    caption: (title) => [`${title}，输入为 `, '。'],
    pressPlay: '点播放，或用方向键逐步查看。',
    openShare: '在分享页中打开',
  },
  plate: {
    title: '同一次运行，变成笔记里的插图',
    lede: '每一步都有名字，所以可以按发生了什么来要一幅图：<code>extract#2</code> 是第二个从队列中取出的顶点。每一幅都是矢量图，主题由你选。',
    figure: '图 1',
    caption: '在上面的图上从 A 出发运行 Dijkstra 算法。',
  },
  outputs: {
    title: '一份输入，写到哪里都行',
    lede: '上面这次运行，写成它能去的每个地方的代码。换算法或改输入，每段代码都会跟着变。所有输出用的是同一个引擎，所以笔记里的图和课程网页上的播放器一模一样。',
    tablist: '输出',
    tabs: {
      web: {
        tab: '网页',
        lede: '一个脚本，一个元素。播放器有逐步控制、标出当前行的代码、解说、键盘快捷键，以及浅色和深色主题。',
      },
      typst: {
        tab: 'Typst',
        lede: '在笔记里调用一个函数，就能把你点名的那一步画成矢量图。引擎就在包里运行，不用再装别的。',
      },
      latex: {
        tab: 'LaTeX',
        lede: '一条命令用 TikZ 画图，图里的文字用的是文档自己的字体。图会被缓存，之后编译不再需要 shell escape。',
      },
      slides: {
        tab: '幻灯片',
        lede: '在 Beamer 里，steps 选项把一幅图变成同一张图的多个叠层，每步一页。在 Typst 里，algomotion-slides 借助 polylux 或 Touying 的 only 做到同样的事。',
      },
      cli: {
        tab: '命令行',
        lede: '把任意帧导出成 SVG 或 TikZ 文件，把一次运行写成 JSON 文档，或检查你自己写的文档。独立版不需要 Node.js。',
      },
      mcp: {
        tab: 'AI 助手',
        lede: '接上 Claude 或任何 MCP 客户端，然后提问。模型用这些工具运行算法，直接在对话里显示播放器。',
      },
      link: {
        tab: '分享链接',
        lede: '整个运行过程都写在链接的 # 后面，所以任何浏览器都能打开，也没有服务器保存它。贴到课程网页或聊天里就行。',
      },
    },
    guide: (tab) => `${spaced(tab)}指南`,
    inSlides: '在幻灯片中',
    overlays: '同一张幻灯片的三个叠层',
    scenes: {
      notes: 'Typst 编译出的一页笔记。',
      beamer:
        '一个 Beamer 帧的三个叠层，由 <code>steps=extract\\#2..improve\\#3</code> 生成，经 <code>latexmk</code> 编译。',
      terminal: '命令真实运行后的输出。',
      chat: '一次真实的 <code>algomotion_show</code> 调用之后，播放器在一个最小的 MCP Apps 宿主里显示的样子。',
    },
    linkCaption: '这个链接在任何浏览器里都能打开这个播放器。',
    webCaption: '读者看到的元素。',
    alts: {
      web: '播放器停在 C 被改进为 5 的那一步，blocks 主题。',
      typst: 'C 经由 B 被改进为 5，textbook 主题。',
      latex: 'C 经由 B 被改进为 5，print 主题。',
      cli: 'C 已确定，距离为 5。',
      mcp: 'C 被改进为 5。',
      link: '所有距离都已确定。',
    },
    exampleCaption: (tab) => `示例运行，按${spaced(tab)}代码片段画出的样子。`,
    chat: {
      label: '与 AI 助手的一段对话',
      you: '你',
      tool: '工具',
      assistant: '助手',
      asked:
        '在 A-B 4, B-C 1, A-C 7, C-D 2 上从 A 出发，演示一下 Dijkstra 算法。',
      ran: '<code>algomotion_show</code> 运行了 <code>dijkstra</code>：共 14 步。',
      answered:
        '在这里。第 7 步，C 从 7 降到 5：经过 B 比直接走那条边更短。你可以逐步查看，任何一步都可以问我。',
    },
  },
  why: {
    title: '为什么不手画？',
    lede: '手画的图能精确控制每一处，Manim 能做出精致的视频。algomotion 做的事情更窄。',
    reasons: [
      {
        title: '每一步都来自真实运行',
        text: '说出算法名，给出输入，不用手画任何东西。换一个输入就是重新运行一次，而不是花一晚上重画。',
      },
      {
        title: '一次运行，处处可用',
        text: '笔记里的图、幻灯片上的叠层、课程网页上的播放器，都是同一次运行，同一个主题。',
      },
      {
        title: '坦白它的局限',
        text: '它只画目录里的算法和你自己写的文档，自动排版，输出静态图或播放器。不做视频。',
      },
    ],
    more: '为什么用 algomotion：对比与局限',
  },
  audiences: {
    title: '为教算法、学算法的地方而做',
    who: [
      {
        title: '学生',
        text: '把正在写的那一步，用你自己的输入，放进 Typst 或 LaTeX 笔记，看起来就像教材里的插图。',
        link: '笔记里的插图',
        href: 'guide/typst/',
      },
      {
        title: '老师',
        text: '在幻灯片上逐步演示，点一下走一步；或者发一个能播放的链接。主题适合打印、考试和暗室投影。',
        link: '幻灯片里的插图',
        href: 'guide/slides/',
      },
      {
        title: '开发者与模型',
        text: '把播放器嵌进任何网页，或者让模型通过 MCP 写出并检查一个可视化，再在对话里显示出来。',
        link: '接入 AI 助手',
        href: 'guide/ai/',
      },
    ],
  },
  themes: {
    title: '九种主题，所有输出通用',
    lede: '同一幅图，可以适合屏幕、讲义、用荧光笔标过的教材页，或者机房里的蓝色屏幕。',
    how: '看看怎么选主题',
    list: '九种主题',
    alt: (t) => `用 ${t} 主题画的 Dijkstra 算法。`,
  },
  catalog: {
    title: (n) => `${n} 个算法与数据结构`,
    lede: '本科阶段的经典内容，从插入排序到最大流，每个都有自己的页面、播放器和代码片段。数据结构的每个操作都单独列出。',
    browse: (n) => `浏览全部 ${n} 个`,
  },
};

export const HOME: Readonly<Record<Locale, HomeText>> = { en, zh };
