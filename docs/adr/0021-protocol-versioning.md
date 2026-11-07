# 0021. The protocol version says what a reader must understand

## Status

Proposed

## Context

A document must say `"version": "0.1"`, and the parser accepts that exact string and nothing else (`packages/spec/src/parse.ts`, `visualization.ts`). Phase 0 to 2 of the roadmap add to the protocol: step names, sections, sources in several languages, tree additions, the `btree` and `plane` kinds. After 1.0, documents live in students' notes and on teaching sites for years (requirements R8). Two things are therefore needed:

- an exact-match version cannot express "this document needs at least these features";
- there is no way to keep old documents working after a breaking change.

## Decision

- **Form.** `version` is `"major.minor"`.
  - A minor version only adds: optional fields, new actions, new kinds, wider limits. Every document of an older minor version is still valid and means the same.
  - A major version may change or remove anything.
- **Readers.** A reader for `M.n` reads every document of major version `M` with minor version up to `n`. A document of a newer minor version is rejected with a hint to update algoviz, because guessing at unknown fields could show something wrong.
- **Writers.** Recipes and the recorder write the oldest version that holds every feature the document uses. A document without sections still says `1.0` after `1.1` adds sections, so older readers and the many copies of the library already on the web can show it.
- **Upgrades.** Each major version comes with `upgrade(document)`, which turns a document of the previous major version into the current one. The parser applies upgrades in order before validating and reports that it did so as a warning. Upgrades are pure, tested with fixtures of the old version, and never removed.
- **Before 1.0.** Nothing is published yet, so `0.x` versions make no promise.
  - Each protocol change in Phases 0 to 2 bumps the minor version (`0.2`, `0.3`, …), and the parser still reads older `0.x` documents, which is cheap while changes only add.
  - The fixtures, the MCP guide and the evals move to the newest `0.x` with each change.
- **Freezing 1.0.** The protocol becomes `1.0` after the structure additions of Phase 2. Only then is anything published (roadmap 4.2), so 1.0 does not need a breaking change soon after release.
- **Package versions.** Package versions follow semver on their own. Each package's README says which protocol versions it reads and writes, and a major protocol version means a major release of every package.

## Consequences

- A document carries the minimum version that can show it, which is what an embedded copy of the player needs to know.
- Additions after 1.0 are cheap: optional fields and new actions, a minor bump, and nothing to migrate.
- A breaking change after 1.0 costs an upgrade function and fixtures, which makes breaking changes visible and rare.
- The parser and the JSON Schema change from one literal version to a range, and conformance fixtures gain old-version cases.
