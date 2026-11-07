/**
 * The functions the standalone executable's Rust host gives the CLI, on
 * the global `__host` (see `../src/main.rs`).
 */
export interface Host {
  /** The arguments after the program's name. */
  readonly argv: readonly string[];
  /** Writes text to standard output (1) or standard error (2). */
  write(fd: 1 | 2, text: string): void;
  /** A file's text, or standard input's for 0. Throws if it cannot. */
  readFile(file: string | 0): string;
  writeFile(path: string, text: string): void;
  /** Makes a directory and its parents; nothing if they exist. */
  mkdir(path: string): void;
  /** Removes a file; nothing if it is missing. */
  remove(path: string): void;
  /** Renames a file, replacing any file of the new name. */
  rename(from: string, to: string): void;
  /** The exit code, once the CLI returns. */
  exit(code: number): void;
}

/** The host, which the executable defines before running the bundle. */
export const host = (globalThis as unknown as { __host: Host }).__host;
