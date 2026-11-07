/**
 * The guide's Markdown files, read from `guide/`, which sits next to both
 * `src/` and `dist/`. The standalone executable (ADR 0027) has no files
 * beside it, so its build replaces this module with one that holds their
 * text.
 */
import { readFileSync } from 'node:fs';

/** The text of a file of the guide, by its path inside `guide/`. */
export const readGuideFile = (path: string): string =>
  readFileSync(new URL(`../guide/${path}`, import.meta.url), 'utf8');
