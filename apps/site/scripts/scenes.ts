/**
 * Remakes the site's real scenes (roadmap 5.3) from the real tools, into
 * `public/scenes/`, with `scenes.json` naming each file and its size, in
 * English and, for the pages under `zh/`, in Chinese (`-zh` in the file
 * names, from `notes-zh.typ` and `slides-zh.tex`, runs asked for in
 * Chinese):
 *
 * - `notes.svg`: `scenes/notes.typ` compiled by the `typst` command with
 *   the repository's Typst package;
 * - `beamer-1.svg` …: `scenes/slides.tex` compiled by `latexmk` with the
 *   LaTeX package and the `algomotion` command, one SVG per PDF page;
 * - `terminal-light.svg`, `terminal-dark.svg`: commands run with the
 *   command line from source, their output as printed;
 * - `chat-light.webp`, `chat-dark.webp`: the MCP App player page, as the
 *   MCP server serves it, in the minimal MCP Apps host the playground's
 *   E2E tests use, after a real `algomotion_show` call.
 *
 * Needs typst, latexmk with XeLaTeX and ctex, pdftocairo, cwebp,
 * Playwright's Chromium, and Noto Serif CJK SC for the Chinese notes.
 *
 *     npm run scenes -w @algomotion/site
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer, PLAYER_URI } from '@algomotion/mcp';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { chromium } from '@playwright/test';
import { build } from 'vite';

import type { Art } from '../src/docs/home.ts';
import type { Locale } from '../src/docs/locale.ts';
import type { SceneManifest, SceneSet } from '../src/docs/scenes.ts';
import {
  TERMINAL_THEMES,
  terminalSvg,
  type TerminalLine,
} from '../src/docs/terminal.ts';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = join(SITE, 'public/scenes');
const RUN = 'A-B 4, B-C 1, A-C 7, C-D 2';
/** What a locale's files add to their names. */
const SUFFIX: Readonly<Record<Locale, string>> = { en: '', zh: '-zh' };

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'algomotion-scenes-'));

/** Runs a program, failing loudly with its output. */
function run(
  file: string,
  args: readonly string[],
  cwd = work,
  env = process.env,
): string {
  const result = spawnSync(file, args, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(
      `${file} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`,
    );
  return result.stdout;
}

/** An SVG's size in CSS pixels, from its viewBox (`pt` units become px). */
function svgSize(svg: string): { width: number; height: number } {
  const box = /viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  if (box === null) throw new Error('an SVG without a viewBox');
  const scale = /width="[\d.]+pt"/.test(svg) ? 4 / 3 : 1;
  return {
    width: Math.round(Number(box[1]) * scale),
    height: Math.round(Number(box[2]) * scale),
  };
}

/** A PNG's size, from its header. */
function pngSize(file: string): { width: number; height: number } {
  const head = readFileSync(file);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

/** A command `algomotion` that runs the command line from source. */
function commandDir(): string {
  const bin = join(work, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = join(bin, 'algomotion');
  writeFileSync(
    script,
    `#!/bin/sh\nexec "${process.execPath}" --no-warnings --conditions=@algomotion/source "${join(REPO, 'packages/mcp/src/algomotion.ts')}" "$@"\n`,
  );
  chmodSync(script, 0o755);
  return bin;
}
const bin = commandDir();
const withCommand = {
  ...process.env,
  PATH: `${bin}:${process.env['PATH'] ?? ''}`,
};

/* ── A page of Typst notes ─────────────────────────────────────────── */

/** The local Typst packages directory, with the package built once. */
const typstPackages = (() => {
  const pkg = join(REPO, 'packages/typst/package');
  // Always rebuilt: the package reads this bytecode, and an old build
  // would draw the notes with an older engine than the other scenes.
  run('npm', ['run', 'build', '-w', '@algomotion/typst'], REPO);
  const packages = join(work, 'typst-packages');
  mkdirSync(join(packages, 'local/algomotion'), { recursive: true });
  symlinkSync(pkg, join(packages, 'local/algomotion/1.0.0'));
  return packages;
})();

const NOTES_ALT: Readonly<Record<Locale, string>> = {
  en: 'A page of notes typeset by Typst: a section on shortest paths, a paragraph, and the figure of Dijkstra’s algorithm at step improve#3, captioned, with the queue below the graph.',
  zh: 'Typst 排出的一页中文笔记：一节讲最短路径的文字，以及 Dijkstra 算法在 improve#3 这一步的插图和图注，队列排在图的下方。',
};

function typstNotes(locale: Locale): Art {
  const name = `notes${SUFFIX[locale]}`;
  const file = join(OUT, `${name}.svg`);
  run('typst', [
    'compile',
    '--package-path',
    typstPackages,
    '--format',
    'svg',
    join(SITE, `scenes/${name}.typ`),
    file,
  ]);
  return {
    light: `scenes/${name}.svg`,
    dark: `scenes/${name}.svg`,
    ...svgSize(readFileSync(file, 'utf8')),
    alt: NOTES_ALT[locale],
  };
}

/* ── Beamer overlays ───────────────────────────────────────────────── */

/** What each overlay shows, for its alternative text. */
const BEAMER_NOTES: Readonly<Record<Locale, readonly string[]>> = {
  en: [
    'B is final, at 4.',
    'The edge from B back to A changes nothing.',
    'C improves to 5, through B.',
  ],
  zh: [
    'B 已确定，距离为 4。',
    '从 B 回到 A 的边没有改变任何距离。',
    'C 经由 B 被改进为 5。',
  ],
};

function beamerSlides(locale: Locale): Art[] {
  const dir = join(work, `beamer${SUFFIX[locale]}`);
  mkdirSync(dir);
  copyFileSync(
    join(SITE, `scenes/slides${SUFFIX[locale]}.tex`),
    join(dir, 'slides.tex'),
  );
  run(
    'latexmk',
    [
      // Chinese text needs XeLaTeX, as ctex prefers.
      locale === 'en' ? '-pdf' : '-xelatex',
      '-shell-escape',
      '-interaction=nonstopmode',
      'slides.tex',
    ],
    dir,
    {
      ...withCommand,
      TEXINPUTS: `${join(REPO, 'packages/latex/package')}//:`,
    },
  );
  const pages = Number(
    /Pages:\s+(\d+)/.exec(run('pdfinfo', ['slides.pdf'], dir))![1],
  );
  const notes = BEAMER_NOTES[locale];
  return Array.from({ length: pages }, (_, k) => {
    const name = `beamer${SUFFIX[locale]}-${k + 1}.svg`;
    run(
      'pdftocairo',
      [
        '-svg',
        '-f',
        `${k + 1}`,
        '-l',
        `${k + 1}`,
        'slides.pdf',
        join(OUT, name),
      ],
      dir,
    );
    return {
      light: `scenes/${name}`,
      dark: `scenes/${name}`,
      ...svgSize(readFileSync(join(OUT, name), 'utf8')),
      alt:
        locale === 'en'
          ? `Beamer slide ${k + 1} of ${pages}, “Dijkstra’s algorithm”: ${notes[k] ?? ''}`
          : `Beamer 幻灯片“Dijkstra 算法”，第 ${k + 1} 页，共 ${pages} 页：${notes[k] ?? ''}`,
    };
  });
}

/* ── A terminal session ────────────────────────────────────────────── */

/**
 * The session: each command is run in a fresh folder, in order. In
 * Chinese the runs ask for Chinese; diagnostics stay English (ADR 0045).
 */
const session = (locale: Locale): string[] => {
  const lang = locale === 'en' ? '' : ` --lang ${locale}`;
  return [
    `algomotion export dijkstra --input '${RUN}' --step 'extract#1,extract#2,extract#3,extract#4' --theme print${lang} --out figures`,
    'ls figures',
    `algomotion run dijkstra '${RUN}'${lang} --out dijkstra.json`,
    'algomotion inspect dijkstra.json improve#3 | head -2',
    `algomotion run dijkstra 'A-B 4, B-C x'`,
  ];
};

const TERMINAL_WORDS: Readonly<
  Record<Locale, { readonly title: string; readonly alt: string }>
> = {
  en: {
    title: 'A terminal session of the algomotion command',
    alt: `A terminal: algomotion export writes four figures of Dijkstra’s algorithm, ls lists them, algomotion run writes the document, algomotion inspect shows step improve#3, and a mistyped input is reported with where it went wrong.`,
  },
  zh: {
    title: 'algomotion 命令的一段终端会话',
    alt: '一段终端会话：algomotion export 用中文写出 Dijkstra 算法的四幅图，ls 列出它们，algomotion run 写出中文的文档，algomotion inspect 显示 improve#3 这一步的中文讲解，最后一个写错的输入报告了出错的位置。',
  },
};

function terminal(locale: Locale): Art {
  const dir = join(work, `terminal${SUFFIX[locale]}`);
  mkdirSync(dir);
  const lines: TerminalLine[] = session(locale).flatMap((command) => {
    const result = spawnSync('sh', ['-c', command], {
      cwd: dir,
      env: withCommand,
      encoding: 'utf8',
    });
    const out = (result.stdout + result.stderr).replace(/\n$/, '');
    const kind: TerminalLine['kind'] = result.status === 0 ? 'output' : 'error';
    return [
      { kind: 'command' as const, text: command },
      ...(out === '' ? [] : out.split('\n').map((text) => ({ kind, text }))),
    ];
  });
  const { title, alt } = TERMINAL_WORDS[locale];
  const name = `terminal${SUFFIX[locale]}`;
  let size = { width: 0, height: 0 };
  for (const scheme of ['light', 'dark'] as const) {
    const drawn = terminalSvg(lines, TERMINAL_THEMES[scheme], title);
    writeFileSync(join(OUT, `${name}-${scheme}.svg`), drawn.svg);
    size = { width: drawn.width, height: drawn.height };
  }
  return {
    light: `scenes/${name}-light.svg`,
    dark: `scenes/${name}-dark.svg`,
    ...size,
    alt,
  };
}

/* ── The player in a conversation ──────────────────────────────────── */

/** The test host's page script, as `window.host` exposes it. */
interface HostWindow {
  readonly host: {
    open(html: string, context: { theme: string }): Promise<void>;
    sendToolResult(result: unknown): Promise<void>;
  };
}

/**
 * Builds what the MCP server serves as its player page, and the minimal
 * MCP Apps host of the playground's E2E tests, as the tests build them.
 */
async function buildHost(): Promise<string> {
  for (const [dir, config] of [
    ['packages/elements', 'vite.cdn.config.ts'],
    ['packages/mcp', 'vite.app.config.ts'],
  ] as const)
    run(
      'npx',
      ['vite', 'build', '--config', config, '--logLevel', 'warn'],
      join(REPO, dir),
    );
  const out = join(work, 'host');
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: out,
      emptyOutDir: true,
      target: 'es2022',
      lib: {
        entry: join(REPO, 'apps/playground/tests/e2e/mcp-host.ts'),
        formats: ['es'],
        fileName: () => 'mcp-host.js',
      },
    },
  });
  return join(out, 'mcp-host.js');
}

/** The conversation around the player, in each language. */
const CHAT_WORDS: Readonly<
  Record<
    Locale,
    {
      readonly question: string;
      /** HTML: what the host says about the tool call. */
      readonly called: string;
      readonly answer: string;
      readonly alt: string;
    }
  >
> = {
  en: {
    question: `Show me Dijkstra’s algorithm from A on ${RUN}.`,
    called: 'Called <code>algomotion_show</code> with <code>dijkstra</code>',
    answer:
      'Here it is, stopped at step improve#3: C drops from 7 to 5, because going through B costs 4 + 1 = 5, less than the direct edge of 7. Step through it, and ask about any step.',
    alt: 'A conversation: the question asks for Dijkstra’s algorithm on A-B 4, B-C 1, A-C 7, C-D 2; a line says algomotion_show was called; the interactive player shows step improve#3 with its controls and code; the answer explains why C drops from 7 to 5.',
  },
  zh: {
    question: `在 ${RUN} 上，从 A 开始演示 Dijkstra 算法。`,
    called: '调用了 <code>algomotion_show</code>，算法为 <code>dijkstra</code>',
    answer:
      '这是演示，停在 improve#3 这一步：C 从 7 降到 5，因为经由 B 的代价是 4 + 1 = 5，比直接边的 7 小。可以逐步播放，也可以就任何一步提问。',
    alt: '一段对话：用户请求在 A-B 4, B-C 1, A-C 7, C-D 2 上演示 Dijkstra 算法；一行说明调用了 algomotion_show；交互式播放器停在 improve#3，显示中文的控制按钮、讲解和代码；回答解释了 C 为什么从 7 降到 5。',
  },
};

const CHAT_STYLE = `
:root { color-scheme: light dark; }
body { margin: 0; padding: 24px; width: 672px; font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: var(--paper); color: var(--ink); }
body.light { --paper: #f6f6f5; --surface: #ffffff; --ink: #161616; --muted: #5b5b5f; --rule: #dcdcda; }
body.dark { --paper: #0c0c0d; --surface: #1b1b1e; --ink: #ececee; --muted: #9d9da6; --rule: #26262a; }
.you { margin: 0 0 16px auto; max-width: 540px; padding: 10px 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--rule); }
.tool { margin: 0 0 10px; color: var(--muted); font-size: 13px; }
.tool code { font: 12px ui-monospace, Menlo, monospace; }
iframe { display: block; width: 100% !important; border: 1px solid var(--rule) !important; border-radius: 10px; background: var(--surface); }
.model { margin: 16px 0 0; }
`;

/** The host page's script, built once for both languages. */
const hostScript = await buildHost();

async function chat(locale: Locale): Promise<Art> {
  const words = CHAT_WORDS[locale];
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'scene host', version: '0.0.0' });
  await createServer().connect(a);
  await client.connect(b);
  const resource = await client.readResource({ uri: PLAYER_URI });
  const view = (resource.contents[0] as { text: string }).text;
  const result = await client.callTool({
    name: 'algomotion_show',
    arguments: {
      recipe: 'dijkstra',
      input: RUN,
      frame: 'improve#3',
      ...(locale === 'en' ? {} : { locale }),
    },
  });
  await client.close();

  const browser = await chromium.launch();
  const sizes: { width: number; height: number }[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    const page = await browser.newPage({
      viewport: { width: 720, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    const origin = 'http://host.test';
    await page.route(`${origin}/**`, (route) =>
      new URL(route.request().url()).pathname === '/mcp-host.js'
        ? route.fulfill({
            contentType: 'text/javascript',
            body: readFileSync(hostScript),
          })
        : route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><html lang="${locale === 'en' ? 'en' : 'zh-Hans'}"><meta charset="utf-8"><title>A conversation</title><style>${CHAT_STYLE}</style><body class="${scheme}"><p class="you">${words.question}</p><p class="tool">${words.called}</p><script type="module" src="/mcp-host.js"></script></body></html>`,
          }),
    );
    await page.goto(`${origin}/`);
    await page.waitForFunction("'host' in window");
    await page.evaluate(
      ({ html, theme }) =>
        (globalThis as unknown as HostWindow).host.open(html, { theme }),
      { html: view, theme: scheme },
    );
    await page.evaluate(
      (r) => (globalThis as unknown as HostWindow).host.sendToolResult(r),
      JSON.parse(JSON.stringify(result)) as unknown,
    );
    const player = page.frameLocator('iframe').locator('algo-player');
    await player.waitFor();
    await player.locator('[data-key="g/element/C"]').waitFor();
    // The model's answer follows the player, as in a conversation.
    await page.evaluate(`(() => {
      const p = document.createElement('p');
      p.className = 'model';
      p.textContent = ${JSON.stringify(words.answer)};
      document.body.append(p);
    })()`);
    await page.waitForTimeout(700);
    const name = `chat${SUFFIX[locale]}-${scheme}`;
    const png = join(work, `${name}.png`);
    await page.screenshot({ path: png, fullPage: true });
    run('cwebp', ['-quiet', '-q', '82', png, '-o', join(OUT, `${name}.webp`)]);
    const { width, height } = pngSize(png);
    sizes.push({ width: width / 2, height: height / 2 });
    await page.close();
  }
  await browser.close();
  return {
    light: `scenes/chat${SUFFIX[locale]}-light.webp`,
    dark: `scenes/chat${SUFFIX[locale]}-dark.webp`,
    ...sizes[0]!,
    alt: words.alt,
  };
}

/** Every scene in `locale`. */
const scenesIn = async (locale: Locale): Promise<SceneSet> => ({
  notes: typstNotes(locale),
  beamer: beamerSlides(locale),
  terminal: terminal(locale),
  chat: await chat(locale),
});

const manifest: SceneManifest = {
  ...(await scenesIn('en')),
  zh: await scenesIn('zh'),
};
writeFileSync(
  join(OUT, 'scenes.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
process.stdout.write(
  `Wrote the scenes to ${OUT}:\n${execFileSync('ls', ['-l', OUT], { encoding: 'utf8' })}`,
);
