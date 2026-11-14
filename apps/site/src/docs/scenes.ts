/**
 * The real scenes (roadmap 5.3): the outputs as they really look, made by
 * `scripts/scenes.ts` from the real tools and committed in
 * `public/scenes/`. `scenes.json` there names each file and its size.
 */
import { picture, type Art } from './home.ts';
import { attribute } from './html.ts';
import type { Locale } from './locale.ts';

export interface SceneManifest {
  /** A page of Typst notes. */
  readonly notes: Art;
  /** The pages of a Beamer frame, one per overlay. */
  readonly beamer: readonly Art[];
  /** A terminal session of the command line. */
  readonly terminal: Art;
  /** The player inside a conversation, in an MCP Apps host. */
  readonly chat: Art;
}

/** Checks the manifest's shape, so a stale file fails the build. */
export function parseScenes(json: string): SceneManifest {
  const value = JSON.parse(json) as Partial<SceneManifest>;
  const art = (a: unknown, name: string): Art => {
    const x = a as Partial<Art> | undefined;
    if (
      typeof x?.light !== 'string' ||
      typeof x.dark !== 'string' ||
      typeof x.width !== 'number' ||
      typeof x.height !== 'number' ||
      typeof x.alt !== 'string' ||
      x.alt === ''
    )
      throw new Error(`scenes.json: ${name} is not a scene`);
    return x as Art;
  };
  if (!Array.isArray(value.beamer) || value.beamer.length === 0)
    throw new Error('scenes.json: beamer has no pages');
  return {
    notes: art(value.notes, 'notes'),
    beamer: value.beamer.map((b, k) => art(b, `beamer[${k}]`)),
    terminal: art(value.terminal, 'terminal'),
    chat: art(value.chat, 'chat'),
  };
}

export type SceneName = keyof SceneManifest;

/** Where each scene's source is, for captions that say how it was made. */
export const SCENE_SOURCES: Readonly<Record<SceneName, string>> = {
  notes: 'apps/site/scenes/notes.typ',
  beamer: 'apps/site/scenes/slides.tex',
  terminal: 'apps/site/scripts/scenes.ts',
  chat: 'apps/site/scripts/scenes.ts',
};

/**
 * A scene as a figure; the Beamer pages as numbered overlays, in an
 * `.overlays` list, which the home page plays as a loop (`loopOverlays`). `caption`
 * is HTML; the alternative text comes from the manifest.
 */
export function sceneFigure(
  scenes: SceneManifest,
  name: SceneName,
  root: string,
  caption: string,
  className = 'scene',
  locale: Locale = 'en',
): string {
  const shown = locale === 'en' ? scenes : inChinese(scenes);
  // A link to the image at its own size, for reading it on a phone.
  const full = (art: Art, inner: string) =>
    `<a class="scene-full" href="${attribute(root + art.light)}">${inner}</a>`;
  const body =
    name === 'beamer'
      ? `<ol class="overlays scene-pages" aria-label="${attribute(locale === 'en' ? `${shown.beamer.length} overlays of one frame, in order` : `同一帧的 ${shown.beamer.length} 个叠层，按顺序排列`)}">${shown.beamer
          .map(
            (page, k) =>
              `<li><span class="overlay-n">${k + 1}</span>${full(page, picture(page, root))}</li>`,
          )
          .join('')}</ol>`
      : name === 'terminal'
        ? // Terminal text stays readable: on a narrow screen it scrolls.
          `<div class="scene-scroll" role="region" tabindex="0" aria-label="${attribute(shown.terminal.alt)}">${picture(shown.terminal, root)}</div>`
        : full(shown[name], picture(shown[name], root));
  return `<figure class="${className} scene-${name}">${body}<figcaption>${caption}</figcaption></figure>`;
}

/** The Beamer pages' alternative text in Chinese, by page. */
const BEAMER_ZH = [
  'B 已确定，距离为 4。',
  '从 B 回到 A 的边没有改变任何距离。',
  'C 经由 B 被改进为 5。',
];

/**
 * The scenes with Chinese alternative text. The images are the same; the
 * manifest's English text describes them for English pages.
 */
function inChinese(scenes: SceneManifest): SceneManifest {
  return {
    notes: {
      ...scenes.notes,
      alt: 'Typst 排出的一页笔记：一节讲最短路径的文字，以及 Dijkstra 算法在 improve#3 这一步的插图和图注，队列排在图的下方。',
    },
    beamer: scenes.beamer.map((page, k) => ({
      ...page,
      alt: `Beamer 幻灯片“Dijkstra's algorithm”，第 ${k + 1} 页，共 ${scenes.beamer.length} 页：${BEAMER_ZH[k] ?? ''}`,
    })),
    terminal: {
      ...scenes.terminal,
      alt: '一段终端会话：algomotion export 写出 Dijkstra 算法的四幅图，ls 列出它们，algomotion run 写出文档，algomotion inspect 显示 improve#3 这一步，最后一个写错的输入报告了出错的位置。',
    },
    chat: {
      ...scenes.chat,
      alt: '一段对话：用户请求在 A-B 4, B-C 1, A-C 7, C-D 2 上演示 Dijkstra 算法；一行说明调用了 algomotion_show；交互式播放器停在 improve#3，显示控制按钮和代码；回答解释了 C 为什么从 7 降到 5。界面文字为英文。',
    },
  };
}
