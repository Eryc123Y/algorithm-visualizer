/**
 * The files a documentation page loads, from Vite's manifest: the docs
 * script, its styles and those of every module it imports, and those
 * modules, to preload.
 */
import type { Assets } from './html.ts';

export interface Chunk {
  readonly file: string;
  readonly css?: readonly string[];
  readonly imports?: readonly string[];
}

export type Manifest = Readonly<Record<string, Chunk>>;

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
  return { scripts: [main.file], styles, preloads };
}
