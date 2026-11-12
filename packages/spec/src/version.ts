/**
 * Protocol versions (ADR 0021, 0043).
 *
 * A document's `version` is `"major.minor"`. A minor version only adds, so
 * a reader reads every document of its own major version up to its own
 * minor version. A writer records the oldest version that holds every
 * feature the document uses, so older readers can still show it.
 *
 * The protocol is 1.0 (ADR 0043): 0.9 as it stood. Documents of the 0.x
 * versions are read by relabelling them as 1.0, before validation.
 */
import type { ProtocolError } from './errors.ts';
import type { VisualizationInput } from './visualization.ts';

/**
 * Every protocol version this package reads, oldest first. A protocol
 * change appends a version here and adds its features to
 * `PROTOCOL_FEATURES`.
 */
export const PROTOCOL_VERSIONS = ['1.0'] as const;

/**
 * The versions before 1.0, which a reader reads by relabelling a document
 * as 1.0: 1.0 is 0.9 as it stood, and every 0.x document is a 0.9
 * document (ADR 0043).
 */
export const UPGRADED_VERSIONS = [
  '0.1',
  '0.2',
  '0.3',
  '0.4',
  '0.5',
  '0.6',
  '0.7',
  '0.8',
  '0.9',
] as const;

/** A protocol version this package reads. */
export type ProtocolVersion = (typeof PROTOCOL_VERSIONS)[number];

/** The newest protocol version, the last one this package reads. */
export const PROTOCOL_VERSION: ProtocolVersion = PROTOCOL_VERSIONS.at(-1)!;

/** A version's two numbers. */
export interface VersionNumbers {
  readonly major: number;
  readonly minor: number;
}

// No leading zeros, so each version has one spelling; at most nine digits,
// so the numbers stay exact.
const VERSION = /^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/;

/** Splits a `"major.minor"` string, or gives undefined for anything else. */
export function parseVersion(version: unknown): VersionNumbers | undefined {
  if (typeof version !== 'string') return undefined;
  const match = VERSION.exec(version);
  if (match === null) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function numbers(version: string): VersionNumbers {
  const parsed = parseVersion(version);
  if (parsed === undefined)
    throw new TypeError(`${JSON.stringify(version)} is not a protocol version`);
  return parsed;
}

const order = (a: VersionNumbers, b: VersionNumbers): number =>
  a.major - b.major || a.minor - b.minor;

/**
 * Orders two versions: negative if `a` is older than `b`, zero if they are
 * the same, positive if `a` is newer. Throws a TypeError if either is not a
 * version, which is a programmer error.
 */
export function compareVersions(a: string, b: string): number {
  return order(numbers(a), numbers(b));
}

/**
 * The versions a reader reads: one major version, from `oldest` to
 * `newest`, and older ones it reads by upgrading them.
 */
export interface ReadRange {
  readonly oldest: string;
  readonly newest: string;
  readonly upgrades?: readonly string[];
}

const READS: ReadRange = {
  oldest: PROTOCOL_VERSIONS[0],
  newest: PROTOCOL_VERSION,
  upgrades: UPGRADED_VERSIONS,
};

/** A document, upgraded to the current version, and the version it had. */
export interface Upgraded {
  readonly document: unknown;
  /** The version the document had, when it was upgraded. */
  readonly from?: string;
}

/**
 * The document as this reader reads it: a document of a 0.x version is
 * relabelled as 1.0, which is all the upgrade from 0.9 to 1.0 does (ADR
 * 0043). Anything else is given back as it is. Pure: the input is never
 * changed.
 */
export function upgradeDocument(input: unknown): Upgraded {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    return { document: input };
  const { version } = input as { version?: unknown };
  if (
    typeof version !== 'string' ||
    !(UPGRADED_VERSIONS as readonly string[]).includes(version)
  )
    return { document: input };
  return { document: { ...input, version: '1.0' }, from: version };
}

/** Quotes a version for a message, shortened so a huge value stays readable. */
function quote(version: string): string {
  return JSON.stringify(
    version.length > 16 ? `${version.slice(0, 16)}…` : version,
  );
}

/**
 * Checks a document's `version` against the versions a reader reads (by
 * default, this package's). Gives an `UNSUPPORTED_VERSION` error, or
 * undefined when the reader can read the document.
 */
export function checkVersion(
  version: unknown,
  reads: ReadRange = READS,
): ProtocolError | undefined {
  const oldest = numbers(reads.oldest);
  const newest = numbers(reads.newest);
  const error = (message: string, hint: string): ProtocolError => ({
    code: 'UNSUPPORTED_VERSION',
    path: '$.version',
    message,
    hint,
  });
  const fix = `Set "version" to "${reads.newest}".`;
  if (typeof version !== 'string')
    return error('"version" must be a string', fix);
  const v = parseVersion(version);
  if (v === undefined)
    return error(
      `Protocol version ${quote(version)} is not of the form "major.minor"`,
      fix,
    );
  if (order(v, oldest) >= 0 && order(v, newest) <= 0) return undefined;
  const upgrades = reads.upgrades ?? [];
  if (upgrades.includes(version)) return undefined;

  const range =
    reads.oldest === reads.newest
      ? `version "${reads.newest}"`
      : `versions "${reads.oldest}" to "${reads.newest}"`;
  if (order(v, newest) > 0) {
    // A newer minor version only adds, so a document that uses nothing new
    // can be relabelled; a newer major version may change meanings.
    const relabel =
      v.major === newest.major
        ? ` If the document uses nothing added after ${reads.newest}, set "version" to "${reads.newest}".`
        : '';
    return error(
      `Protocol version ${quote(version)} is newer than this copy of algomotion can read`,
      `This copy reads ${range}. Update algomotion to show this document.${relabel}`,
    );
  }
  // A version of a major version this reader knows, which never existed.
  if (
    v.major === oldest.major ||
    upgrades.some((u) => numbers(u).major === v.major)
  )
    return error(`There is no protocol version ${quote(version)}`, fix);
  // An older major version with no upgrade this reader knows.
  return error(
    `Protocol version ${quote(version)} is older than this copy of algomotion can read`,
    `This copy reads ${range}, and cannot upgrade older documents.`,
  );
}

/** A document without its version: what features are found in. */
type Content = Omit<VisualizationInput, 'version'>;

/** Something added to the protocol after its first version. */
export interface ProtocolFeature<V extends string = ProtocolVersion> {
  /** Short name, e.g. "sections". */
  readonly name: string;
  /** The version that added it. */
  readonly since: V;
  /** Whether a document uses it. */
  readonly usedBy: (document: Content) => boolean;
}

/**
 * Features added after 1.0, with the version that added each: a minor
 * version adds its entries here. Empty at 1.0, which holds everything the
 * 0.x versions added (ADR 0043).
 */
export const PROTOCOL_FEATURES: readonly ProtocolFeature[] = [];

/**
 * The newest `since` among the features a document uses, or `base` if it
 * uses none of them.
 */
export function newestNeeded<V extends string>(
  document: Content,
  features: readonly ProtocolFeature<V>[],
  base: V,
): V {
  let version = base;
  for (const feature of features)
    if (compareVersions(feature.since, version) > 0 && feature.usedBy(document))
      version = feature.since;
  return version;
}

/**
 * The oldest protocol version that holds every feature a document uses.
 * Writers put this in `version`, so that older readers, such as copies of
 * the player already embedded in pages, can still show the document.
 */
export function minimumVersion(document: Content): ProtocolVersion {
  return newestNeeded(document, PROTOCOL_FEATURES, PROTOCOL_VERSIONS[0]);
}

/** "a", "a and b", "a, b and c". */
export function listOf(names: readonly string[]): string {
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`;
}

/**
 * Checks that a document's `version` is not older than a feature it uses,
 * which a reader of that version could not show. Gives a
 * `VERSION_TOO_OLD` error, or undefined.
 */
export function checkFeatures<V extends string>(
  document: Content,
  version: V,
  features: readonly ProtocolFeature<V>[],
): ProtocolError | undefined {
  const newer = features.filter(
    (f) => compareVersions(f.since, version) > 0 && f.usedBy(document),
  );
  if (newer.length === 0) return undefined;
  const needed = newestNeeded(document, newer, version);
  return {
    code: 'VERSION_TOO_OLD',
    path: '$.version',
    message: `The document uses ${listOf(newer.map((f) => f.name))}, which need protocol version "${needed}", but its version is "${version}"`,
    hint: `Set "version" to "${needed}".`,
  };
}
