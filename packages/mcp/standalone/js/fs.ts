/**
 * The part of `node:fs` the CLI uses, over the standalone host. The bundle
 * of the standalone executable imports this module in place of `node:fs`.
 */
import { host } from './host.ts';

const pathOf = (file: string | URL) =>
  typeof file === 'string' ? file : decodeURIComponent(file.pathname);

/**
 * A file's text; `0` reads standard input. Only UTF-8 is supported, so the
 * encoding the CLI passes is not needed.
 */
export function readFileSync(file: string | number | URL): string {
  return host.readFile(file === 0 ? 0 : pathOf(file as string | URL));
}

export function writeFileSync(file: string | URL, text: string): void {
  host.writeFile(pathOf(file), text);
}

/** Always recursive, as the CLI asks. */
export function mkdirSync(path: string): void {
  host.mkdir(path);
}

/** Always forced, as the CLI asks: a missing file is not an error. */
export function rmSync(path: string): void {
  host.remove(path);
}
