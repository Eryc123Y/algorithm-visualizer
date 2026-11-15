/**
 * The files a documentation page loads, from Vite's manifest: the docs
 * script, its styles and those of every module it imports, and those
 * modules and the first screen's fonts, to preload.
 */
import type { Assets } from './html.ts';

export interface Chunk {
  readonly file: string;
  readonly css?: readonly string[];
  readonly imports?: readonly string[];
}

export type Manifest = Readonly<Record<string, Chunk>>;

/**
 * The faces the first screen of every page sets, preloaded so they arrive
 * with the styles rather than swap in later and move the text: IBM Plex
 * Sans for the body (400), the bar (500) and the headings (700), and IBM
 * Plex Mono for code and labels, in Latin.
 */
export const FIRST_FONTS: readonly string[] = [
  'ibm-plex-sans-latin-400-normal.woff2',
  'ibm-plex-sans-latin-500-normal.woff2',
  'ibm-plex-sans-latin-700-normal.woff2',
  'ibm-plex-mono-latin-400-normal.woff2',
];

/** The assets of `entry`, each once, in the order the script needs them. */
export function assetsOf(manifest: Manifest, entry: string): Assets {
  const main = manifest[entry];
  if (main === undefined)
    throw new Error(`Vite built no ${entry}; run vite build first`);
  const preloads: string[] = [];
  const styles: string[] = [];
  const addStyles = (chunk: Chunk) => {
    for (const css of chunk.css ?? [])
      if (!styles.includes(css)) styles.push(css);
  };
  const visit = (key: string) => {
    const chunk = manifest[key];
    if (chunk === undefined || preloads.includes(chunk.file)) return;
    preloads.push(chunk.file);
    addStyles(chunk);
    for (const next of chunk.imports ?? []) visit(next);
  };
  addStyles(main);
  for (const key of main.imports ?? []) visit(key);
  const fonts = FIRST_FONTS.flatMap((name) => {
    const key = Object.keys(manifest).find((k) => k.endsWith(`/${name}`));
    return key === undefined ? [] : [manifest[key]!.file];
  });
  return { scripts: [main.file], styles, preloads, fonts };
}
