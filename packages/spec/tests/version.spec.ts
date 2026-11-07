import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  minimumVersion,
  parseVisualization,
  PROTOCOL_FEATURES,
  PROTOCOL_VERSION,
  PROTOCOL_VERSIONS,
  type VisualizationInput,
} from '../src/index.ts';
import {
  checkVersion,
  compareVersions,
  newestNeeded,
  parseVersion,
  type ProtocolFeature,
} from '../src/version.ts';

const doc = (version: unknown) => ({
  version,
  structures: { a: { kind: 'array', initial: [1] } },
  steps: [],
});

describe('parseVersion', () => {
  it('reads "major.minor"', () => {
    expect(parseVersion('0.1')).toEqual({ major: 0, minor: 1 });
    expect(parseVersion('1.0')).toEqual({ major: 1, minor: 0 });
    expect(parseVersion('2.13')).toEqual({ major: 2, minor: 13 });
  });

  it.each([
    0.1,
    1,
    null,
    undefined,
    {},
    ['0.1'],
    '',
    '1',
    '0.1.0',
    '00.1',
    '0.01',
    'v0.1',
    ' 0.1',
    '0.1 ',
    '-1.0',
    '1.-1',
    '0x1.0',
    '1e3.0',
    '0.1234567890',
  ])('rejects %j', (version) => {
    expect(parseVersion(version)).toBeUndefined();
  });
});

describe('compareVersions', () => {
  it('orders by major, then by minor', () => {
    expect(compareVersions('0.1', '0.1')).toBe(0);
    expect(compareVersions('0.1', '0.2')).toBeLessThan(0);
    expect(compareVersions('0.10', '0.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '0.99')).toBeGreaterThan(0);
  });

  it('throws on a string that is not a version (a programmer error)', () => {
    expect(() => compareVersions('0.1', 'next')).toThrow(TypeError);
  });
});

describe('PROTOCOL_VERSIONS', () => {
  it('lists consecutive minor versions of one major, ending at PROTOCOL_VERSION', () => {
    const parsed = PROTOCOL_VERSIONS.map((v) => parseVersion(v));
    expect(parsed.every((v) => v !== undefined)).toBe(true);
    const first = parsed[0]!;
    parsed.forEach((v, i) =>
      expect(v).toEqual({ major: first.major, minor: first.minor + i }),
    );
    expect(PROTOCOL_VERSIONS.at(-1)).toBe(PROTOCOL_VERSION);
  });

  it('starts at 0.1 or at minor 0 of a major version', () => {
    expect(['0.1', `${parseVersion(PROTOCOL_VERSION)!.major}.0`]).toContain(
      PROTOCOL_VERSIONS[0],
    );
  });
});

describe('checkVersion', () => {
  it('accepts every version this package reads', () => {
    for (const version of PROTOCOL_VERSIONS)
      expect(checkVersion(version)).toBeUndefined();
  });

  it('rejects a newer minor version with a hint to update algoviz', () => {
    const error = checkVersion('0.99');
    expect(error).toMatchObject({
      code: 'UNSUPPORTED_VERSION',
      path: '$.version',
    });
    expect(error?.message).toContain('newer');
    expect(error?.hint).toContain('Update algoviz');
    // Minor versions only add, so an older reader can show the document if
    // it uses nothing new.
    expect(error?.hint).toContain(`set "version" to "${PROTOCOL_VERSION}"`);
  });

  it('rejects a newer major version with a hint to update algoviz', () => {
    const error = checkVersion('2.0');
    expect(error).toMatchObject({ code: 'UNSUPPORTED_VERSION' });
    expect(error?.hint).toContain('Update algoviz');
    // A major version may change meanings, so relabelling is no fix.
    expect(error?.hint).not.toContain('set "version"');
  });

  it('rejects a version before the first one', () => {
    const error = checkVersion('0.0');
    expect(error).toMatchObject({ code: 'UNSUPPORTED_VERSION' });
    expect(error?.message).toBe('There is no protocol version "0.0"');
  });

  it.each([0.1, null, true, '0.1.0', 'latest', ''])(
    'rejects %j with a hint naming a version to use',
    (version) => {
      const error = checkVersion(version);
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_VERSION',
        path: '$.version',
        hint: `Set "version" to "${PROTOCOL_VERSION}".`,
      });
    },
  );

  it('does not throw or echo huge values', () => {
    expect(() => checkVersion(1n)).not.toThrow();
    const error = checkVersion('9'.repeat(10_000));
    expect(error?.message.length).toBeLessThan(200);
  });

  describe('for a reader of 1.0 to 1.2', () => {
    const reads = { oldest: '1.0', newest: '1.2' };

    it('reads every minor version of major 1 up to 1.2', () => {
      for (const version of ['1.0', '1.1', '1.2'])
        expect(checkVersion(version, reads)).toBeUndefined();
    });

    it('rejects newer versions and names the range it reads', () => {
      for (const version of ['1.3', '2.0']) {
        const error = checkVersion(version, reads);
        expect(error?.code).toBe('UNSUPPORTED_VERSION');
        expect(error?.hint).toContain('"1.0" to "1.2"');
      }
    });

    it('rejects an older major version, which needs an upgrade', () => {
      const error = checkVersion('0.9', reads);
      expect(error?.code).toBe('UNSUPPORTED_VERSION');
      expect(error?.message).toContain('older');
    });
  });
});

describe('parseVisualization and versions', () => {
  it('reports an unsupported version before anything else', () => {
    const result = parseVisualization({ version: '0.99', structures: {} });
    expect(result).toMatchObject({
      ok: false,
      error: [{ code: 'UNSUPPORTED_VERSION', path: '$.version' }],
    });
  });

  it('keeps the version a document declares', () => {
    for (const version of PROTOCOL_VERSIONS) {
      const result = parseVisualization(doc(version));
      expect(result.ok && result.value.version).toBe(version);
    }
  });
});

const specFixtures = new URL(
  '../../../conformance/spec/valid/',
  import.meta.url,
);

describe('minimumVersion', () => {
  it('gives the version each valid fixture declares, as a writer would', () => {
    for (const file of readdirSync(specFixtures)) {
      const fixture = JSON.parse(
        readFileSync(new URL(file, specFixtures), 'utf8'),
      ) as { input: VisualizationInput };
      expect(minimumVersion(fixture.input), file).toBe(fixture.input.version);
    }
  });

  it('works on canonical documents too', () => {
    const parsed = parseVisualization(doc(PROTOCOL_VERSION));
    if (!parsed.ok) throw new Error('fixture must parse');
    expect(minimumVersion(parsed.value)).toBe(PROTOCOL_VERSIONS[0]);
  });
});

describe('newestNeeded', () => {
  const features: ProtocolFeature<string>[] = [
    { name: 'titles', since: '0.3', usedBy: (d) => d.title !== undefined },
    { name: 'sources', since: '0.2', usedBy: (d) => d.source !== undefined },
    { name: 'never', since: '0.9', usedBy: () => false },
  ];
  const base = doc('0.1') as VisualizationInput;

  it('is the base version when no feature is used', () => {
    expect(newestNeeded(base, features, '0.1')).toBe('0.1');
  });

  it('is the newest version among the features used', () => {
    const source = { code: 'x' };
    expect(newestNeeded({ ...base, source }, features, '0.1')).toBe('0.2');
    expect(newestNeeded({ ...base, title: 't' }, features, '0.1')).toBe('0.3');
    expect(newestNeeded({ ...base, title: 't', source }, features, '0.1')).toBe(
      '0.3',
    );
    expect(
      newestNeeded(
        { ...base, title: 't', source },
        [...features].reverse(),
        '0.1',
      ),
    ).toBe('0.3');
  });
});

describe('PROTOCOL_FEATURES', () => {
  const later = PROTOCOL_VERSIONS.slice(1);

  it('dates every feature to a version after the first one', () => {
    for (const feature of PROTOCOL_FEATURES)
      expect(later as readonly string[]).toContain(feature.since);
  });

  it('gives every later version at least one feature', () => {
    // A minor version exists to add something; without an entry here,
    // writers would never record it.
    for (const version of later)
      expect(PROTOCOL_FEATURES.map((f) => f.since)).toContain(version);
  });

  it('names each feature once', () => {
    const names = PROTOCOL_FEATURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
