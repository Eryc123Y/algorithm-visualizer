/**
 * The real scenes (roadmap 5.3): the outputs as they really look, made by
 * `scripts/scenes.ts` from the real tools and committed in
 * `public/scenes/`. `scenes.json` there names each file and its size.
 */
import { picture, type Art } from './home.ts';
import { text } from './html.ts';

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
 * A scene as a figure; the Beamer pages as numbered overlays. `caption`
 * is HTML; the alternative text comes from the manifest.
 */
export function sceneFigure(
  scenes: SceneManifest,
  name: SceneName,
  root: string,
  caption: string,
  className = 'scene',
): string {
  const body =
    name === 'beamer'
      ? `<ol class="scene-pages" aria-label="${text(`${scenes.beamer.length} overlays of one frame, in order`)}">${scenes.beamer
          .map(
            (page, k) =>
              `<li><span class="overlay-n">${k + 1}</span>${picture(page, root)}</li>`,
          )
          .join('')}</ol>`
      : picture(scenes[name], root);
  return `<figure class="${className} scene-${name}">${body}<figcaption>${caption}</figcaption></figure>`;
}
