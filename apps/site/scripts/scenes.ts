/**
 * Remakes the site's real scenes (roadmap 5.3) from the real tools, into
 * `public/scenes/`, with `scenes.json` naming each file and its size:
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
 * Needs typst, latexmk, pdftocairo, cwebp and Playwright's Chromium.
 *
 *     npm run scenes -w @algomotion/site
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
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
import type { SceneManifest } from '../src/docs/scenes.ts';
import {
  TERMINAL_THEMES,
  terminalSvg,
  type TerminalLine,
} from '../src/docs/terminal.ts';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = join(SITE, 'public/scenes');
const RUN = 'A-B 4, B-C 1, A-C 7, C-D 2';

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

function typstNotes(): Art {
  const pkg = join(REPO, 'packages/typst/package');
  if (!existsSync(join(pkg, 'engine.bc')))
    run('npm', ['run', 'build', '-w', '@algomotion/typst'], REPO);
  const packages = join(work, 'typst-packages');
  mkdirSync(join(packages, 'local/algomotion'), { recursive: true });
  symlinkSync(pkg, join(packages, 'local/algomotion/0.1.0'));
  const file = join(OUT, 'notes.svg');
  run('typst', [
    'compile',
    '--package-path',
    packages,
    '--format',
    'svg',
    join(SITE, 'scenes/notes.typ'),
    file,
  ]);
  return {
    light: 'scenes/notes.svg',
    dark: 'scenes/notes.svg',
    ...svgSize(readFileSync(file, 'utf8')),
    alt: 'A page of notes typeset by Typst: a section on shortest paths, a paragraph, and the figure of Dijkstra’s algorithm at step improve#3, captioned, with the queue below the graph.',
  };
}

/* ── Beamer overlays ───────────────────────────────────────────────── */

function beamerSlides(): Art[] {
  const dir = join(work, 'beamer');
  mkdirSync(dir);
  copyFileSync(join(SITE, 'scenes/slides.tex'), join(dir, 'slides.tex'));
  run(
    'latexmk',
    ['-pdf', '-shell-escape', '-interaction=nonstopmode', 'slides.tex'],
    dir,
    {
      ...withCommand,
      TEXINPUTS: `${join(REPO, 'packages/latex/package')}//:`,
    },
  );
  const pages = Number(
    /Pages:\s+(\d+)/.exec(run('pdfinfo', ['slides.pdf'], dir))![1],
  );
  const notes = [
    'B is final, at 4.',
    'The edge from B back to A changes nothing.',
    'C improves to 5, through B.',
  ];
  return Array.from({ length: pages }, (_, k) => {
    const name = `beamer-${k + 1}.svg`;
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
      alt: `Beamer slide ${k + 1} of ${pages}, “Dijkstra’s algorithm”: ${notes[k] ?? ''}`,
    };
  });
}

/* ── A terminal session ────────────────────────────────────────────── */

/** The session: each command is run in a fresh folder, in order. */
const SESSION = [
  `algomotion export dijkstra --input '${RUN}' --step 'extract#1,extract#2,extract#3,extract#4' --theme print --out figures`,
  'ls figures',
  `algomotion run dijkstra '${RUN}' --out dijkstra.json`,
  'algomotion inspect dijkstra.json improve#3 | head -2',
  `algomotion run dijkstra 'A-B 4, B-C x'`,
];

function terminal(): Art {
  const dir = join(work, 'terminal');
  mkdirSync(dir);
  const lines: TerminalLine[] = SESSION.flatMap((command) => {
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
  const title = 'A terminal session of the algomotion command';
  let size = { width: 0, height: 0 };
  for (const scheme of ['light', 'dark'] as const) {
    const drawn = terminalSvg(lines, TERMINAL_THEMES[scheme], title);
    writeFileSync(join(OUT, `terminal-${scheme}.svg`), drawn.svg);
    size = { width: drawn.width, height: drawn.height };
  }
  return {
    light: 'scenes/terminal-light.svg',
    dark: 'scenes/terminal-dark.svg',
    ...size,
    alt: `A terminal: algomotion export writes four figures of Dijkstra’s algorithm, ls lists them, algomotion run writes the document, algomotion inspect shows step improve#3, and a mistyped input is reported with where it went wrong.`,
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

/** The model's answer, after the player. */
const ANSWER =
  'Here it is, stopped at step improve#3: C drops from 7 to 5, because going through B costs 4 + 1 = 5, less than the direct edge of 7. Step through it, and ask about any step.';

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

async function chat(): Promise<Art> {
  const hostScript = await buildHost();
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'scene host', version: '0.0.0' });
  await createServer().connect(a);
  await client.connect(b);
  const resource = await client.readResource({ uri: PLAYER_URI });
  const view = (resource.contents[0] as { text: string }).text;
  const result = await client.callTool({
    name: 'algomotion_show',
    arguments: { recipe: 'dijkstra', input: RUN, frame: 'improve#3' },
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
            body: `<!doctype html><meta charset="utf-8"><title>A conversation</title><style>${CHAT_STYLE}</style><body class="${scheme}"><p class="you">Show me Dijkstra’s algorithm from A on ${RUN}.</p><p class="tool">Called <code>algomotion_show</code> with <code>dijkstra</code></p><script type="module" src="/mcp-host.js"></script></body>`,
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
      p.textContent = ${JSON.stringify(ANSWER)};
      document.body.append(p);
    })()`);
    await page.waitForTimeout(700);
    const png = join(work, `chat-${scheme}.png`);
    await page.screenshot({ path: png, fullPage: true });
    run('cwebp', [
      '-quiet',
      '-q',
      '82',
      png,
      '-o',
      join(OUT, `chat-${scheme}.webp`),
    ]);
    const { width, height } = pngSize(png);
    sizes.push({ width: width / 2, height: height / 2 });
    await page.close();
  }
  await browser.close();
  return {
    light: 'scenes/chat-light.webp',
    dark: 'scenes/chat-dark.webp',
    ...sizes[0]!,
    alt: 'A conversation: the question asks for Dijkstra’s algorithm on A-B 4, B-C 1, A-C 7, C-D 2; a line says algomotion_show was called; the interactive player shows step improve#3 with its controls and code; the answer explains why C drops from 7 to 5.',
  };
}

const manifest: SceneManifest = {
  notes: typstNotes(),
  beamer: beamerSlides(),
  terminal: terminal(),
  chat: await chat(),
};
writeFileSync(
  join(OUT, 'scenes.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
process.stdout.write(
  `Wrote the scenes to ${OUT}:\n${execFileSync('ls', ['-l', OUT], { encoding: 'utf8' })}`,
);
