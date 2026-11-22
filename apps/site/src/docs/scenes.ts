/**
 * The real scenes (roadmap 5.3): the outputs as they really look, made by
 * `scripts/scenes.ts` from the real tools and committed in
 * `public/scenes/`. `scenes.json` there names each file and its size, for
 * the English pages and, under `zh`, the Chinese ones, whose scenes are
 * runs in Chinese (ADR 0045).
 */
import { picture, type Art } from './home.ts';
import { attribute } from './html.ts';
import type { Locale } from './locale.ts';

/** The scenes of one language. */
export interface SceneSet {
  /** A page of Typst notes. */
  readonly notes: Art;
  /** The pages of a Beamer frame, one per overlay. */
  readonly beamer: readonly Art[];
  /** A terminal session of the command line. */
  readonly terminal: Art;
  /** The player inside a conversation, in an MCP Apps host. */
  readonly chat: Art;
}

/** The English scenes, and the Chinese ones under `zh`. */
export interface SceneManifest extends SceneSet {
  readonly zh: SceneSet;
}

/** Checks one language's scenes, `at` saying where they are. */
function parseSet(json: unknown, at: string): SceneSet {
  const value = (json ?? {}) as Partial<SceneSet>;
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
      throw new Error(`scenes.json: ${at}${name} is not a scene`);
    return x as Art;
  };
  if (!Array.isArray(value.beamer) || value.beamer.length === 0)
    throw new Error(`scenes.json: ${at}beamer has no pages`);
  return {
    notes: art(value.notes, 'notes'),
    beamer: value.beamer.map((b, k) => art(b, `beamer[${k}]`)),
    terminal: art(value.terminal, 'terminal'),
    chat: art(value.chat, 'chat'),
  };
}

/** Checks the manifest's shape, so a stale file fails the build. */
export function parseScenes(json: string): SceneManifest {
  const value = JSON.parse(json) as { zh?: unknown };
  return { ...parseSet(value, ''), zh: parseSet(value.zh, 'zh.') };
}

export type SceneName = keyof SceneSet;

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
  const shown: SceneSet = locale === 'en' ? scenes : scenes.zh;
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
