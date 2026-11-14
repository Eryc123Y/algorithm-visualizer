/**
 * The words of "Why algomotion", in each locale (roadmap 5.7): the lede,
 * the triptych, the four differences, the comparison, the limits, the
 * walk-throughs and the figures' alternative text. Code (the Typst
 * notes, the Beamer slides, the tool calls) is shared and lives in
 * why.ts. Strings that hold markup say so; every other string is
 * escaped where it is used. A function of `root` writes links to the
 * locale's own pages.
 */
import { REPOSITORY } from '../html.ts';
import type { Locale } from '../locale.ts';

/** The figures the page draws, by key. */
export type WhyFigureKey =
  | 'web'
  | 'notes'
  | 'slide'
  | 'named'
  | 'in-list'
  | 'in-ops'
  | 'print'
  | 'answer'
  | 'assistant';

/** The walk-throughs, by id. */
export type WalkId = 'notes' | 'slides' | 'assistant';

/** HTML that links within the locale; `root` leads to its root. */
type Linked = (root: string) => string;

/** The words of one step of a walk-through. */
export interface WalkStepText {
  /** What to do, as HTML. */
  readonly html: Linked;
  /** The label of its code block, unless the code is a named file. */
  readonly label?: string;
  /** The caption of its scene, as HTML. */
  readonly caption?: string;
}

export interface WhyText {
  readonly title: string;
  readonly description: string;
  readonly lede: string;
  readonly triptych: {
    readonly title: string;
    /** HTML; `input` is the run's input, already in a `<code>`. */
    readonly intro: (input: string) => string;
    /** HTML captions of the web, notes and slide figures. */
    readonly captions: {
      readonly web: string;
      readonly notes: string;
      readonly slide: string;
    };
  };
  readonly differences: {
    readonly title: string;
    readonly named: {
      readonly title: string;
      readonly before: string;
      readonly namesLabel: string;
      /** HTML. */
      readonly after: string;
      /** HTML. */
      readonly caption: string;
    };
    readonly inputs: {
      readonly title: string;
      /** HTML. */
      readonly text: Linked;
      /** HTML. */
      readonly list: string;
      /** HTML. */
      readonly ops: string;
    };
    readonly themes: {
      readonly title: string;
      /** HTML. */
      readonly text: Linked;
    };
    readonly assistant: {
      readonly title: string;
      /** HTML, given how many registry modules there are. */
      readonly text: (modules: number) => string;
      /** HTML. */
      readonly caption: string;
    };
  };
  readonly comparison: {
    readonly title: string;
    readonly intro: string;
    readonly tableLabel: string;
    readonly comparedOn: string;
    /** algomotion, by hand, Manim, websites. */
    readonly tools: readonly [string, string, string, string];
    /** One row per point; its cells are HTML. */
    readonly rows: readonly {
      readonly what: string;
      readonly cells: readonly [string, string, string, string];
    }[];
  };
  readonly limits: {
    readonly title: string;
    /** HTML items, given how many registry modules there are. */
    readonly items: (modules: number, root: string) => readonly string[];
  };
  readonly walks: {
    readonly title: string;
    readonly intro: string;
    readonly list: Readonly<
      Record<
        WalkId,
        {
          readonly title: string;
          readonly who: string;
          readonly steps: readonly WalkStepText[];
        }
      >
    >;
    /** HTML, before the quoted narration of the check. */
    readonly reply: string;
  };
  /** The alternative text of each figure. */
  readonly alt: Readonly<Record<WhyFigureKey, string>>;
}

const en: WhyText = {
  title: 'Why algomotion',
  description:
    'What algomotion is for, how it differs from drawing figures by hand, from Manim and from algorithm visualization websites, what it does not do, and three walk-throughs.',
  lede: 'Explaining an algorithm usually means drawing it by hand, one step at a time, and drawing it again when the input changes. algomotion runs the algorithm instead. You name it and give it your input, and every step comes out drawn: as a player on a web page, figures in Typst and LaTeX, overlays on slides, and a player in an AI conversation, all from the same run.',
  triptych: {
    title: 'One run, three places',
    intro: (input) =>
      `Dijkstra’s algorithm on ${input} at the same step, <code>improve#3</code>, drawn by the same engine for three places.`,
    captions: {
      web: '<b>A web page.</b> The player shows this frame, with its controls and the code beside it.',
      notes:
        '<b>Typst or LaTeX notes.</b> A vector figure; in a column, the queue goes below.',
      slide: '<b>A slide.</b> One overlay per step; here in the dark theme.',
    },
  },
  differences: {
    title: 'What makes it different',
    named: {
      title: 'Every step has a name you can cite',
      before:
        'A run is a list of named steps, not a video. This one has these names, and each one is counted:',
      namesLabel: 'The steps of this run',
      after:
        '<code>extract#3</code> is the third vertex taken from the queue. Your notes, your slides, a share link and a model all pick the same frame by the same name.',
      caption: 'Step <code>extract#3</code>: C is final, at 5.',
    },
    inputs: {
      title: 'Inputs in the notation you already write',
      text: (root) =>
        `A list is <code>5 2 4 6 1 3</code>, a graph is <code>A-B 4, B-C 1</code>, and operations on a structure are <code>insert 4, delete 3</code>. There is no format to learn before the first figure, and an input that does not parse says where. <a href="${root}guide/inputs/">Every notation</a>.`,
      list: '<code>insertion-sort</code> on <code>5 2 4 6 1 3</code>, step <code>insert#2</code>.',
      ops: '<code>bst</code> from <code>8 3 10 1 6</code>, then <code>insert 4, delete 3</code>.',
    },
    themes: {
      title: 'Themes for paper and for screens',
      text: (root) =>
        `Nine built-in themes, the same in every output: one for print, one that looks like a marked-up textbook page, one for an answer sheet, dark ones for slides and night reading. Marks never rely on colour alone, so a figure still reads in black and white. <a href="${root}themes/">All nine</a>.`,
    },
    assistant: {
      title: 'A model can show it, and check it',
      text: (modules) =>
        `The MCP server gives a model tools to run any of the ${modules} algorithms by name, show the player in the conversation, and inspect the state at any step before it says what happened. For anything else it writes a document, and validation replays every step and says where one goes wrong. <a href="#assistant">The walk-through</a> below shows the calls.`,
      caption:
        'What <code>algomotion_show</code> opens, at <code>improve#3</code>.',
    },
  },
  comparison: {
    title: 'Compared with other ways',
    intro:
      'Each of these is the better choice for some work. algomotion is for one thing: an algorithm on your input, step by step, wherever you write or teach. TikZ, draw.io and Manim are open tools anyone can check; the websites are a kind of site, not one in particular.',
    tableLabel: 'The comparison table',
    comparedOn: 'Compared on',
    tools: [
      'algomotion',
      'Drawing by hand (TikZ, draw.io)',
      'Manim',
      'Algorithm visualization websites',
    ],
    rows: [
      {
        what: 'What you give it',
        cells: [
          'An algorithm’s name and your input, such as <code>A-B 4, B-C 1</code>.',
          'Every shape and position: as code in TikZ, with the mouse in draw.io.',
          'A scene written in Python: the objects, and how each one moves.',
          'A choice from the site’s list; some also take your own input.',
        ],
      },
      {
        what: 'Another input',
        cells: [
          'Run it again; every figure follows.',
          'Redraw the figures.',
          'Edit the scene and render it again.',
          'Type it in where the site allows it; the result stays on the site.',
        ],
      },
      {
        what: 'In notes and papers',
        cells: [
          'Vector figures from the Typst and LaTeX packages; in LaTeX, text in the document’s fonts.',
          'TikZ is part of the LaTeX document; draw.io exports SVG and PDF.',
          'Frames exported as images.',
          'Screenshots.',
        ],
      },
      {
        what: 'On a web page',
        cells: [
          'The player: step controls, the code with its current line, narration, keyboard shortcuts.',
          'Still images.',
          'A video.',
          'Interactive, on the site itself.',
        ],
      },
      {
        what: 'On slides',
        cells: [
          'One overlay per step, in Beamer, polylux and Touying.',
          'Overlays drawn one by one.',
          'Video clips, or exported frames.',
          'A link, or screenshots.',
        ],
      },
      {
        what: 'Beyond its list',
        cells: [
          'A JSON document of the steps, written by hand or by a model that checks it with the MCP tools.',
          'Anything you can draw.',
          'Anything you can program.',
          'Only what the site offers.',
        ],
      },
      {
        what: 'Better at',
        cells: [
          'One run that looks the same in notes, slides, web pages and AI conversations, with steps that come from running the algorithm.',
          'Exact control of every mark, and pictures of anything at all.',
          'Smooth, polished animation for explanatory videos.',
          'Nothing to install, and a whole topic to browse in one place.',
        ],
      },
    ],
  },
  limits: {
    title: 'What it does not do',
    items: (modules, root) => [
      `Only the ${modules} algorithms and data structure operations in <a href="${root}algorithms/">the catalogue</a> run on an input. Anything else is a JSON document that you, or a model, write step by step.`,
      'Figures are laid out automatically. You choose a theme and a wide or narrow layout; a document can place a graph’s nodes by hand, but there is no editor to drag them.',
      'The outputs are the player in a browser and still figures (SVG and TikZ). There is no video or GIF export.',
      `Code is shown in pseudocode and Python. Narration and the player’s controls are in English for now; Chinese is <a href="${root}roadmap/">on the roadmap</a>.`,
      'Small inputs read best: with dozens of vertices or hundreds of values a figure gets crowded.',
      `Nothing is published yet: the packages are not on npm, Typst Universe or CTAN, so the guides install them from <a href="${REPOSITORY}">the repository</a>. The hosted MCP server and share links work today.`,
      'algomotion is under the GNU GPL, version 3 or later: a program that includes its code must be released under the GPL too. The figures and documents it makes are yours, under any licence you like.',
    ],
  },
  walks: {
    title: 'Three walk-throughs',
    intro:
      'Each one is real code on the run above. Copy it, change the input, and the figures follow.',
    list: {
      notes: {
        title: 'A student’s notes in Typst',
        who: 'You are writing up shortest paths and want the step you explain, on the graph from your problem sheet.',
        steps: [
          {
            html: (root) =>
              `Install the package from the repository, as <a href="${root}guide/typst/#install">the Typst guide</a> shows. It brings its own engine, so Typst is all you need.`,
          },
          {
            html: () =>
              'Write the step into your notes by its name. In a column of notes the queue goes below the graph.',
          },
          {
            html: () =>
              'Compile as usual. Change the graph or the step, and the figure follows.',
            label: 'Compile the notes',
            caption:
              'A page of notes as Typst compiles them, from a fuller version of this file.',
          },
        ],
      },
      slides: {
        title: 'A teacher’s Beamer slides',
        who: 'You want to step through the moment C improves, one click per step, on the same graph as the handout.',
        steps: [
          {
            html: (root) =>
              `Install the LaTeX package and the <code>algomotion</code> command, as <a href="${root}guide/latex/">the LaTeX guide</a> shows.`,
          },
          {
            html: () =>
              'Name a range of steps. Each becomes an overlay of one picture, so nothing moves between clicks but what the algorithm changes.',
          },
          {
            html: () =>
              'The first compile runs the command through shell escape and caches the figures; later compiles need neither.',
            label: 'Compile the slides',
            caption:
              'The three overlays this file makes, as <code>latexmk</code> compiles them.',
          },
        ],
      },
      assistant: {
        title: 'An assistant explaining an algorithm',
        who: 'You ask a model about Dijkstra’s algorithm and want to see it run, not only read about it.',
        steps: [
          {
            html: (root) =>
              `Connect the hosted MCP server. <a href="${root}guide/ai/">Connecting an assistant</a> covers Claude’s apps and other clients.`,
            label: 'Add algomotion to Claude Code',
          },
          {
            html: () =>
              'Ask: “Show me Dijkstra’s algorithm from A on A-B 4, B-C 1, A-C 7, C-D 2.” The model runs the recipe by name and writes no document; in clients that show MCP Apps, the player opens in the conversation.',
            label: 'The tool call',
            caption:
              'The player after this call, in the minimal MCP Apps host that the project’s tests use.',
          },
          {
            html: () =>
              'Ask why C ends at 5. Before answering, the model can look at the state at that step instead of guessing.',
            label: 'The check',
          },
        ],
      },
    },
    reply: 'The reply includes the step’s narration: ',
  },
  alt: {
    web: 'C improves to 5 through B, in the blocks theme.',
    notes:
      'C improves to 5 through B, in the textbook theme, with the queue below the graph.',
    slide:
      'C improves to 5 through B, in the dark theme, with the queue beside the graph.',
    named: 'C is taken from the queue: its distance, 5, is final.',
    'in-list': 'Insertion sort on 5 2 4 6 1 3 after its second insertion.',
    'in-ops': 'The search tree after inserting 4 and deleting 3.',
    print: 'The same step in the print theme, for paper.',
    answer: 'The same step in the answer-sheet theme.',
    assistant: 'C improves to 5 through B, with the queue Q beside the graph.',
  },
};

const zh: WhyText = {
  title: '为什么用 algomotion',
  description:
    'algomotion 是做什么的，它和手画插图、Manim、算法可视化网站有什么不同，它不做什么，以及三个实例演练。',
  lede: '讲解一个算法，通常要一步一步手画出来，输入一变，又得重画一遍。algomotion 的做法是直接运行算法：你说出算法名，给出输入，每一步就都画好了。网页上的播放器、Typst 和 LaTeX 里的图、幻灯片上的叠层、AI 对话里的播放器，全都来自同一次运行。',
  triptych: {
    title: '一次运行，三处使用',
    intro: (input) =>
      `Dijkstra 算法在 ${input} 上运行到同一步 <code>improve#3</code>，由同一个引擎画出，用在三个地方。`,
    captions: {
      web: '<b>网页。</b>播放器显示这一帧，旁边是控制按钮和代码。',
      notes:
        '<b>Typst 或 LaTeX 笔记。</b>一幅矢量图；放进窄栏时，队列移到图的下方。',
      slide: '<b>幻灯片。</b>每步一个叠层；这里用的是深色主题。',
    },
  },
  differences: {
    title: '它有什么不同',
    named: {
      title: '每一步都有名字，可以直接引用',
      before:
        '一次运行是一串有名字的步骤，而不是一段视频。这次运行有下面这些步骤名，每个都标出了出现次数：',
      namesLabel: '这次运行的步骤',
      after:
        '<code>extract#3</code> 就是第三个从队列中取出的顶点。笔记、幻灯片、分享链接和模型，都用同一个名字选中同一帧。',
      caption: '步骤 <code>extract#3</code>：C 的距离确定为 5。',
    },
    inputs: {
      title: '输入就用你平时的写法',
      text: (root) =>
        `列表写成 <code>5 2 4 6 1 3</code>，图写成 <code>A-B 4, B-C 1</code>，对数据结构的操作写成 <code>insert 4, delete 3</code>。画第一幅图之前不用先学什么格式；输入解析不了，会指出错在哪里。<a href="${root}guide/inputs/">全部记法</a>。`,
      list: '<code>5 2 4 6 1 3</code> 上的 <code>insertion-sort</code>，步骤 <code>insert#2</code>。',
      ops: '<code>bst</code> 由 <code>8 3 10 1 6</code> 建成，再执行 <code>insert 4, delete 3</code>。',
    },
    themes: {
      title: '纸面和屏幕都有合适的主题',
      text: (root) =>
        `内置九种主题，在所有输出里都一样：一种用于打印，一种像画了重点的教材页，一种用于答题纸，还有几种深色主题，适合幻灯片和夜间阅读。标记从不只靠颜色区分，所以图变成黑白也照样看得懂。<a href="${root}themes/">九种主题一览</a>。`,
    },
    assistant: {
      title: '模型能演示它，也能核对它',
      text: (modules) =>
        `MCP 服务器给模型提供了一组工具：按名字运行 ${modules} 个算法中的任意一个，在对话里显示播放器，并在说明发生了什么之前，先查看任意一步的状态。要画其他内容，模型就写一份文档，校验会重放每一步，并指出哪一步出了错。下面的<a href="#assistant">实例演练</a>列出了这些调用。`,
      caption:
        '<code>algomotion_show</code> 打开的画面，停在 <code>improve#3</code>。',
    },
  },
  comparison: {
    title: '和其他做法比较',
    intro:
      '每种做法都有它更适合的场合。algomotion 只做一件事：在你的输入上运行一个算法，一步一步画出来，用在你写作或教学的任何地方。TikZ、draw.io 和 Manim 都是公开的工具，任何人都能查证；“算法可视化网站”指的是一类网站，不是某一个。',
    tableLabel: '对比表',
    comparedOn: '比较项',
    tools: ['algomotion', '手画（TikZ、draw.io）', 'Manim', '算法可视化网站'],
    rows: [
      {
        what: '你要提供什么',
        cells: [
          '算法名和你的输入，例如 <code>A-B 4, B-C 1</code>。',
          '每个形状和位置：TikZ 里用代码写，draw.io 里用鼠标画。',
          '一个用 Python 写的场景：有哪些对象，每个对象怎么动。',
          '从网站的列表里选一项；有些网站也接受你自己的输入。',
        ],
      },
      {
        what: '换一个输入',
        cells: [
          '再运行一次，所有图随之更新。',
          '重画这些图。',
          '修改场景，重新渲染。',
          '在网站允许的地方输入；结果留在网站上。',
        ],
      },
      {
        what: '笔记和论文里',
        cells: [
          'Typst 和 LaTeX 包生成的矢量图；在 LaTeX 里，文字用文档自己的字体。',
          'TikZ 本身就是 LaTeX 文档的一部分；draw.io 能导出 SVG 和 PDF。',
          '导出成图片的帧。',
          '截图。',
        ],
      },
      {
        what: '网页上',
        cells: [
          '播放器：逐步控制、标出当前行的代码、解说、键盘快捷键。',
          '静态图片。',
          '一段视频。',
          '可交互，就在网站上。',
        ],
      },
      {
        what: '幻灯片上',
        cells: [
          '每步一个叠层，支持 Beamer、polylux 和 Touying。',
          '叠层要一个一个画。',
          '视频片段，或导出的帧。',
          '一个链接，或几张截图。',
        ],
      },
      {
        what: '列表之外',
        cells: [
          '一份记录各个步骤的 JSON 文档，可以手写，也可以由模型来写，模型会用 MCP 工具检查它。',
          '能画出来的都行。',
          '能编程实现的都行。',
          '只有网站提供的内容。',
        ],
      },
      {
        what: '更擅长',
        cells: [
          '同一次运行在笔记、幻灯片、网页和 AI 对话里看起来都一样，每一步都来自算法的实际运行。',
          '精确控制每一处标记，什么图都能画。',
          '流畅、精致的动画，适合做讲解视频。',
          '不用安装任何东西，一整个专题集中在一处浏览。',
        ],
      },
    ],
  },
  limits: {
    title: '它不做什么',
    items: (modules, root) => [
      `只有<a href="${root}algorithms/">算法目录</a>里的 ${modules} 个算法和数据结构操作能直接在输入上运行。其他内容都要写成 JSON 文档，由你或模型一步一步写出来。`,
      '图的布局是自动的。你能选主题，选宽或窄的版式；文档里可以手动指定图中节点的位置，但没有拖动节点的编辑器。',
      '输出只有浏览器里的播放器和静态图（SVG 和 TikZ），不能导出视频或 GIF。',
      `代码以伪代码和 Python 显示。解说和播放器的控件目前只有英文；中文已<a href="${root}roadmap/">列入路线图</a>。`,
      '输入小的时候图最清楚：顶点到了几十个、数值到了几百个，图就会变得拥挤。',
      `目前还没有发布任何东西：这些包不在 npm、Typst Universe 或 CTAN 上，所以指南都从<a href="${REPOSITORY}">代码仓库</a>安装。托管的 MCP 服务器和分享链接现在就能用。`,
      'algomotion 采用 GNU GPL 第 3 版或更高版本：包含它代码的程序也必须以 GPL 发布。它画出的图和生成的文档归你所有，用什么许可证都可以。',
    ],
  },
  walks: {
    title: '三个实例演练',
    intro:
      '每个演练的代码都真实可用，演示的正是上面那次运行。复制下来，改一下输入，插图就跟着变。',
    list: {
      notes: {
        title: '学生用 Typst 写笔记',
        who: '你在整理最短路径的笔记，想把正在讲的那一步画出来，用的是习题里的那张图。',
        steps: [
          {
            html: (root) =>
              `按 <a href="${root}guide/typst/#install">Typst 指南</a>的说明，从仓库安装这个包。它自带引擎，所以只需要 Typst。`,
          },
          {
            html: () =>
              '在笔记里按名字写出这一步。笔记只有一栏宽，队列就排到图的下方。',
          },
          {
            html: () => '照常编译。换一张图或换一个步骤，插图都会跟着更新。',
            label: '编译笔记',
            caption: 'Typst 编译出的一页笔记，源文件是这个文件的完整版。',
          },
        ],
      },
      slides: {
        title: '老师用 Beamer 做幻灯片',
        who: '你想用讲义上的同一张图，点一下走一步，演示 C 的距离变小的那一刻。',
        steps: [
          {
            html: (root) =>
              `按 <a href="${root}guide/latex/">LaTeX 指南</a>的说明，安装 LaTeX 包和 <code>algomotion</code> 命令。`,
          },
          {
            html: () =>
              '指定一段步骤。每一步成为同一幅图的一个叠层，所以两次点击之间，只有算法改动的地方会变。',
          },
          {
            html: () =>
              '第一次编译会通过 shell escape 运行这个命令，并缓存生成的图；之后再编译，就既不用 shell escape，也不用再运行这个命令。',
            label: '编译幻灯片',
            caption: '这个文件生成的三个叠层，由 <code>latexmk</code> 编译。',
          },
        ],
      },
      assistant: {
        title: 'AI 助手讲解算法',
        who: '你向模型请教 Dijkstra 算法，不只想读解释，还想看它运行起来。',
        steps: [
          {
            html: (root) =>
              `连接托管的 MCP 服务器。<a href="${root}guide/ai/">接入 AI 助手</a>一页介绍了 Claude 的各个应用和其他客户端。`,
            label: '把 algomotion 添加到 Claude Code',
          },
          {
            html: () =>
              '提问：“在 A-B 4, B-C 1, A-C 7, C-D 2 上从 A 出发，演示一下 Dijkstra 算法。”模型按名字运行内置的算法，不写任何文档；在能显示 MCP Apps 的客户端里，播放器会直接在对话中打开。',
            label: '工具调用',
            caption:
              '这次调用之后的播放器，显示在项目测试所用的最小 MCP Apps 宿主里。',
          },
          {
            html: () =>
              '再问 C 为什么最后是 5。模型回答之前，可以先查看那一步的状态，而不是靠猜。',
            label: '核对',
          },
        ],
      },
    },
    reply: '返回结果里包含这一步的解说：',
  },
  alt: {
    web: '经过 B，C 的距离降到 5；使用 blocks 主题。',
    notes: '经过 B，C 的距离降到 5；使用 textbook 主题，队列在图的下方。',
    slide: '经过 B，C 的距离降到 5；使用深色主题，队列在图的旁边。',
    named: 'C 从队列中取出，它的距离 5 已经确定。',
    'in-list': '对 5 2 4 6 1 3 做插入排序，第二次插入之后。',
    'in-ops': '插入 4、删除 3 之后的二叉搜索树。',
    print: '同一步，使用适合纸面的 print 主题。',
    answer: '同一步，使用 answer-sheet 主题。',
    assistant: '经过 B，C 的距离降到 5；队列 Q 在图的旁边。',
  },
};

export const WHY: Readonly<Record<Locale, WhyText>> = { en, zh };
