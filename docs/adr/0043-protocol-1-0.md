# 0043. The protocol is 1.0

## Status

Accepted

## Context

ADR 0021 versions the protocol as `"major.minor"` and freezes it at 1.0 "after the structure additions of Phase 2. Only then is anything published (roadmap 4.3), so 1.0 does not need a breaking change soon after release." Phase 2 is done: the last additions were the B-tree (0.6), list moves (0.7), array patterns (0.8) and the plane (0.9). Nothing is published yet, so this is the last moment a change costs no upgrade for anyone.

Three things need deciding: what 1.0 contains, what it promises, and what happens to the 0.x documents in the repository, the guide, the evals and anywhere a model has copied an old example.

## Decision

### 1. What 1.0 is

**1.0 is 0.9 as it stands: no field, action, kind or limit changes.** Only the version does: `"1.0"`.

The whole protocol was reviewed for anything that would otherwise need a 2.0 soon after release: inconsistent names, fields that later additions made redundant, and limits that look wrong. The candidates, and why each one stays:

| Candidate                                                                                                                                                                                         | Decision                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setKey` means a key's value in `btree` (`key`, `value`) but an element's priority in `priorityQueue` (`id`, `key`)                                                                               | **Kept.** Each follows its kind's vocabulary from CLRS: a B-tree's elements are keys, and a priority queue keys its elements. Actions are always read with their target's kind, and the schema refuses either set of fields on the other kind. |
| `meta.id` is a step's name, which repeats, while every other `id` is unique                                                                                                                       | **Kept** (ADR 0020). The guide, the schema and every message call it the step's name, and selectors read it as one. Renaming it would touch every writer, reader and saved document for clarity alone.                                         |
| Pointers name their target `index` (array, linked list), `node` (tree, graph, B-tree) or `point` (plane); position arguments are `i`/`j`, `a`/`b`, `from`/`to`                                    | **Kept.** A pointer names what its kind addresses: positions in rows (ADR 0007), ids in trees and graphs, points in the plane. Each kind's guide shows its own form.                                                                           |
| `insert` (array, linked list, hash table, priority queue, B-tree) against `add…` (tree, graph, plane); `peek` beside `highlight`                                                                  | **Kept.** The verbs follow how textbooks talk about each structure. `peek` names an operation the learner is watching, not a style.                                                                                                            |
| Edge marks: `markEdge` with `selected`/`rejected` in trees and graphs; `select` with `on` for plane segments; edge text as a graph edge's `weight`, a tree edge's `label` and a segment's `label` | **Kept** (ADR 0034, 0038). A plane segment is not an edge of a graph, and has only one mark.                                                                                                                                                   |
| `visit` and `settle` cannot be cleared in arrays, lists, trees, B-trees and planes; only graphs, tables and hash tables have `resetMarks`                                                         | **Deferred to 1.x.** A `resetMarks` for the other kinds is an addition.                                                                                                                                                                        |
| `highlight` takes an empty list in some kinds and not in others                                                                                                                                   | **Deferred to 1.x.** Allowing an empty list everywhere only widens what is valid.                                                                                                                                                              |
| A table may hold 100 × 100 cells, more than `elementsPerStructure` (1,000)                                                                                                                        | **Kept.** A table's cells are not elements, and `tableRows` and `tableColumns` are its own limits.                                                                                                                                             |
| Per-kind limits (plane points and lines, hash-table buckets, B-tree keys per node, pattern length, note and label lengths) outside `LIMITS`                                                       | **Kept.** Where a limit is defined is not part of the protocol. A wider one is an addition; a narrower one would need 2.0, and none looks too wide.                                                                                            |
| Two ways to say some things: `source` or `sources` and `meta.line` or `meta.at`; a table's `initial` or `cells`; a tree's `levelOrder` or `nodes`; a slot as `0`/`1` or `"left"`/`"right"`        | **Kept** (ADR 0017, 0034). The short forms are the authoring forms people and models write. The parser turns them into one canonical form, so readers see only that.                                                                           |
| `meta.line` and anchors count lines from 1, where indices count from 0                                                                                                                            | **Kept.** Editors and textbooks number lines from 1.                                                                                                                                                                                           |

The guide's descriptions that differ from the schema are corrected in the same change, since descriptions are not the protocol: a graph's `auto` layout uses the nodes' positions when every node has them; the list of persistent marks; the plane's `compare`.

### 2. What 1.0 promises

The rules of ADR 0021, stated for 1.x:

- **A 1.x minor version only adds:** an optional field, a new action, a new kind, a new mark, a new value of an open set, or a wider limit. Every 1.0 document stays valid under every 1.x and means the same.
- **A change needs 2.0** when it would make a valid 1.0 document invalid or change what it shows. Examples are renaming or removing a field, action or kind; making an optional field required; changing a default; narrowing a limit; changing what a value means. Then 2.0 comes with `upgrade(document)` from 1.x, which the parser applies before validating (ADR 0021).
- **Unknown fields are errors, not ignored.** Declarations, actions and the document are strict objects. A reader that meets a field it does not know cannot tell whether the field changes what it should draw. So a document that uses a 1.1 field says `"version": "1.1"`, and a 1.0 reader refuses it with a hint to update, as today. Writers keep writing the oldest version that holds what the document uses, so a document that uses nothing new still says `1.0` and every 1.x reader shows it.
- **Diagnostics are part of the contract** as far as their codes go: a code keeps its meaning across 1.x, and new codes may be added. Messages and hints may be reworded.
- **Not part of the protocol:** layout, painting, themes, the player's attributes and the scene format. A minor or patch release may draw the same document better, as the painter fixes of roadmap 1.7 and ADR 0042 did. The JSON Schema describes the protocol; its descriptions may be reworded without a version change.

### 3. 0.x documents after 1.0

0.x promised nothing (ADR 0021), but 0.x documents exist: the conformance fixtures, tests, examples, evals results, and documents models wrote from the guide. A 1.0 reader reads them by upgrading them, as ADR 0021 planned for any older major version:

- A document whose `version` is one of the 0.x versions, `"0.1"` to `"0.9"`, is upgraded to `"1.0"` by relabelling it, since 1.0 changes nothing else. The upgrade is pure, total and tested with fixtures of 0.x versions.
- The parser applies it before it validates, so errors point at the document as written. Its canonical form, and anything a writer saves from it, says `"1.0"`.
- `algoviz_validate` and `algoviz validate` add a warning, `UPGRADED_VERSION`, that names the version found and says to write `"1.0"`.
- The 0.x minor versions' feature checks go: a `0.3` document with a plane is no longer refused with `VERSION_TOO_OLD`. Every 0.x feature is part of 1.0, and there is no 0.x reader to protect, since none was published.
- A version that never existed, such as `"0.10"` or `"0.0"`, is refused as before.

### 4. Versions after 1.0

- `PROTOCOL_VERSIONS` starts again at `["1.0"]`, and the feature table starts empty; 1.1's first feature is its first entry.
- Writers (the recorder, recipes, the CLI and MCP) write `1.0`.
- The guide's rule for `version` becomes one line: write `"1.0"`.

### 5. The name in the schema id

The JSON Schema's id is `urn:algoviz:schema:visualization:1.0`, and the packages are `@algoviz/*`. The project's name is the owner's decision (roadmap 4.1). The name appears in the protocol only in this id, which is defined once in `@algoviz/spec` (`SCHEMA_ID`). Changing the name segment of the id before anything is published is a rename, not a protocol change, and needs no new version. Documents do not carry the id, so none of them changes.

## Consequences

- Documents written for 0.x keep working everywhere, now as 1.0, and every writer writes `1.0`.
- The guide's rule for `version`, a list of nine versions and the features each added, becomes "write `1.0`". That is one thing fewer for people and models to get wrong.
- The JSON Schema's `version` is the one value `"1.0"`, and its id ends in `1.0`. The schema and the conformance fixtures are regenerated, and a few 0.x fixtures stay as upgrade cases.
- The 0.x feature table leaves the code; ADRs 0020 to 0038 record what each 0.x version added.
- Nothing about drawing changes, so every figure stays the same: the version is not drawn.
- What 1.0 deliberately keeps is listed above. A later change to any of it needs 2.0 and an upgrade, and should cite this table.
- The project's name is still open (roadmap 4.1), and only the schema id's name segment and the package scope carry it.
