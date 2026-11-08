# 0032. Every output takes an algorithm and its input, in short notations

## Status

Accepted

## Context

The requirements' purpose (2026-11-08) asks for the shortest path to a figure: a student, a teacher or a model names an algorithm and gives its input, in notations they already know, and algoviz runs it. Roadmap 1.9 builds that in every output. On 2026-11-08 the outputs stood as follows.

| Output                | How an algorithm is given                                                        | What is in the way                                                                   |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| CLI                   | `algoviz run <id> <json>`, `algoviz export <id> --input <json\|file>`            | the input is JSON: a graph is `{"nodes": […], "edges": [["A", "B", 4], …]}`          |
| MCP                   | `algoviz_run_recipe { id, input }` returns a document                            | `algoviz_show` and `algoviz_render` take only a document, so a model copies one back |
| `<algo-player>`       | not at all: a document by `src`, inline JSON or the `visualization` property     | the teaching-website use case needs `algorithm` and its input                        |
| the standalone bundle | not at all                                                                       | it carries no registry (405 KB, 104 KB gzipped)                                      |
| Typst                 | `algoviz("dijkstra", (graph: (nodes: …, edges: (("A", "B", 4), …)), source: …))` | nested dictionaries and arrays, and Typst's `((…),)` for a one-edge array            |
| LaTeX                 | `\algoviz{dijkstra}{"graph": {"nodes": […], "edges": […]}, "source": "A"}`       | JSON inside TeX: quotes, brackets and braces for every edge                          |

The inputs themselves are the registry's Zod schemas (ADR 0019, 0022, 0023). Every output already passes the input through them unchanged, so whatever the schemas accept, every output accepts.

## Decision

The protocol does not change. A run's document is the same whichever way its input was written; only the inputs grow.

### 1. Notations are part of the input schemas

A field that has a notation accepts it as a string, besides its structured form: in the schema it is a union of the notation (a string parsed into the structured form) and the structured form. The structured forms stay exactly as they are. Because the notation is in the schema, the CLI, MCP, the player, Typst and LaTeX accept it alike, and `algoviz recipes` and `algoviz_list_recipes` show it in each input's JSON Schema, with the notation first and a description with an example.

Each notation has a parser and a printer in `@algoviz/recipes` (`src/notation/`). The printer writes the notation of a structured value when it has one, so tests can check that the two forms agree, and the guide's examples can be generated.

**Lists.** Every list of numbers in an input (values to sort or search, a heap's or a tree's starting keys, a hash table's keys, a disjoint-set forest's `parent` and `rank`), the trie's list of words and a tree's level order:

- items separated by commas, spaces or both, optionally in square brackets: `"5 2 4 6 1 3"`, `"5, 2, 4"`, `"[5, 2, 4]"`;
- numbers as JSON writes them (`-3`, `2.5`, `1e9`); `null` for a gap in a level order, which LeetCode's `[4,2,6,1,3,null,7]` already is as text; words of a word list as they are.

**Graphs.** An edge list, as textbooks and competitive programming write one:

```text
A-B 4, B-C 2, A-C 7, D
```

- items are separated by commas or line breaks; empty items are skipped, so a trailing comma or line break is fine;
- an item is an edge, `from-to` or `from->to`, with an optional weight after a space, or a node name alone, for a node with no edges;
- `-` is an undirected edge and `->` a directed one. A graph is one or the other, so mixing them is an error at the first edge that differs. A graph with `->` edges is `directed: true`; otherwise `directed` is left out;
- node names are 1 to 24 letters, digits and `_`, so `1-2 3` is the edge from 1 to 2 of weight 3. Names with other characters (the structured form allows `.`, `:` and `-`) need the structured form;
- nodes come in the order they first appear, and edges in the order given, so neighbours are taken in that order (ADR 0023). The printer writes a node alone wherever needed to keep the structured form's node order.

**Operation lists.** A data structure's sequence of operations (`bst`, `avl`, `trie`, `min-heap`, `max-heap`, `disjoint-set`, `hash-chaining`, `linear-probing`), as exercises write it:

```text
insert 4, delete 3, search 7
```

- calls are separated by commas or line breaks; a call is the operation's name, then its arguments separated by spaces, in the order the operation declares them: `decrease-key 3 0` is index 3, value 0; `union 1 2`; `delete 8 predecessor`;
- an argument is a number if it reads as one and the argument takes numbers, otherwise a word.

**Strings** stay JSON strings (`lcs`, `edit-distance`, `balanced-brackets`), since a string is already its own notation. **Grids** get a notation (rows separated by `;` or line breaks, cells by spaces or commas) with the first algorithm that takes one; none does yet. The disjoint set's `unions` pairs and the knapsack's items keep their structured form: there is no notation people already share for them.

### 2. An input may be its main field alone

A module whose input has one field that a run cannot do without names it its **main field**. Its input may then be that field's value alone, in any of its forms, instead of an object: `"5 2 4 6 1 3"` for `insertion-sort`, `"A-B 4, B-C 2"` for `dijkstra`, `[4, 2, 6, null, 7]` for `inorder-tree-walk`.

To make that possible, the graph modules' `source` (BFS, Dijkstra, Bellman-Ford) and `root` (Prim) become optional, defaulting to the graph's first node, which in the notation is the first name written.

| Main field   | Modules                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `values`     | `insertion-sort`, `merge-sort`, `heapsort`, `quicksort`, `counting-sort`, `bubble-sort`, `selection-sort`, `reverse-linked-list` |
| `levelOrder` | `inorder-tree-walk`, `preorder-tree-walk`, `postorder-tree-walk`                                                                 |
| `text`       | `balanced-brackets`                                                                                                              |
| `graph`      | `bfs`, `dfs`, `topological-sort`, `dijkstra`, `bellman-ford`, `prim`, `kruskal`, `floyd-warshall`                                |

Modules with two needed fields have none: `binary-search` (values and target), `lcs` and `edit-distance` (two strings), `knapsack` (items and capacity), and every data-structure module (`from` and an operation). In the schema the input is a union of the object and the main field, wrapped into the object; an object is first read as the input, then as the main field (a graph's `{ nodes, edges }`).

### 3. No input means the first example

An algorithm given without input runs on its first example, the default of menus and tests (ADR 0019): `<algo-player algorithm="dijkstra">`, `algoviz run dijkstra`, `algoviz_run_recipe { id }`, Typst `algoviz("dijkstra")`, LaTeX `\algoviz{dijkstra}{}`. `runAlgorithm` and `runModule` take the input as optional, so every output gets this from one place.

### 4. One rule for input written as text

The CLI, the LaTeX package (which calls the CLI) and the player's `input` attribute receive the input as text. One function, `readInput` in `@algoviz/recipes`, turns text into the input:

1. Text that is JSON is that value: `{"values": [5, 2]}`, `[5, 2]`, `"A-B 4"`, `7`.
2. Text that becomes a JSON object in braces is that object: `"graph": "A-B 4", "source": "B"`. This rule moves from the LaTeX package, which added the braces itself, into `readInput`.
3. Text that starts with `{`, `[` or `"` but is neither is a JSON error (`INVALID_JSON`), so a typo in JSON is reported as one.
4. Any other text is a string, which the schema then reads as a notation: `5 2 4 6 1 3`, `A-B 4, B-C 2`, `insert 4, delete 3`.
5. Empty text is no input (section 3).

The CLI's `--input` reads a file when its value names one and does not start with `{` or `[`; the file's text then goes through the same rule. Typst passes its values as they are (a Typst string is a JSON string), and MCP passes JSON values, so neither needs the rule.

### 5. Errors point at the token

A notation error is a diagnostic with code `INVALID_NOTATION`, at the path of the field (`$.input.graph`, or `$.input` for a main field given alone). Its message names what was expected, quotes the offending token and gives its position in the text, counted in characters from 1: `Expected a weight or "," after "B-C", not "x" (character 12)`. Its hint states the notation briefly, with an example. Limits that the structured form checks (a weight beyond 1e9, a name over 24 characters, too many items) are checked on the tokens too, so they also point at one.

A union reports every branch it tried. Before converting Zod's issues, `runModule` narrows each union to the branch that matches the value's type: a string to the notation, an array or object to the structured form. Of several branches that match, it keeps the one whose issues go deepest, then the first. A union that no branch matches says which types it takes. This also sharpens the existing unions, such as a heap's `from`.

### 6. The player takes an algorithm and its input

New attributes, reflected as properties:

- **`algorithm`**: a registry id. With it, the player's content is that algorithm's input rather than a document.
- **`input`**: the input. As an attribute it is text, read by `readInput`; as a property it may also be any value, such as an object.

```html
<algo-player algorithm="insertion-sort" input="5 2 4 6 1 3"></algo-player>
<algo-player
  algorithm="dijkstra"
  input="A-B 4, B-C 1, A-C 7, C-D 2"
  frame="improve#3"
></algo-player>
```

Content, in order of precedence: the `visualization` property (a document) as before; then, with `algorithm`, the input from `input`, else the JSON at `src`, else an inline `<script type="application/json">`, else none (the first example); without `algorithm`, a document from `src` or the inline script as before. Changing `algorithm` or `input` runs the algorithm again; `frame`, `theme`, `layout` and the rest apply as to any document.

An unknown id or a bad input shows in the player's error panel, as a document that does not load does today: the diagnostics with their paths and messages, so a notation error quotes its token. `algo-error` carries them. The registry is loaded on first use (section 7); a failure to load it is a `LOAD_FAILED` diagnostic like a failed `src`.

### 7. The bundle loads the registry on demand

Measured on 2026-11-08 with the CDN build (Vite, minified, `gzip -9`):

| Build                                                    | Raw      | Gzipped  |
| -------------------------------------------------------- | -------- | -------- |
| `algoviz-player.js` today, no registry                   | 405.2 KB | 104.2 KB |
| one file with the registry                               | 535.9 KB | 137.6 KB |
| on demand: `algoviz-player.js`                           | 405.5 KB | 103.6 KB |
| on demand: `algoviz-recipes.js`, loaded with `algorithm` | 130.5 KB | 34.6 KB  |

Carrying the registry would make every page pay a third more, though most pages that embed a document never run an algorithm. So the player imports `@algoviz/recipes` dynamically, the first time a player has `algorithm` set:

- The CDN build emits `algoviz-recipes.js` next to `algoviz-player.js` (Rollup's `preserveEntrySignatures: "allow-extension"`, so the chunk imports the engine from the player file instead of a third, shared file). The player stays one file for documents; pages that run algorithms load the second file once, from the same place, as they already load `fonts/`. The two files go together under these names.
- `@algoviz/elements` depends on `@algoviz/recipes`; an application that bundles the element gets the same split from its own bundler.

### 8. MCP

- `algoviz_show`, `algoviz_render` and `algoviz_inspect` take either `document` or `recipe` with an optional `input`, so a model shows a recipe without copying its document: `algoviz_show { "recipe": "dijkstra", "input": "A-B 4, B-C 1" }`. Giving both, or neither, is an error. `algoviz_validate` stays document-only: a recipe's run is valid by construction.
- `algoviz_run_recipe`'s `input` is optional (section 3).
- The server's instructions and the guide tell models to prefer recipes with short inputs, and to show recipes by name. The evals' prompt is the server's instructions (ADR 0014), so the change is measured there too.

### 9. Typst and LaTeX

- **Typst** needs no new parameter: `algoviz(id, input)` already passes the input through. The second argument becomes optional (section 3), and the README and examples use the notations: `algoviz("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "improve#3")`.
- **LaTeX** stops adding braces to the input and hands the text to the CLI, whose `readInput` reads it (section 4): `\algoviz[step=improve#3]{dijkstra}{A-B 4, B-C 1, A-C 7, C-D 2}`. The cache key is the input as written, so an input written without its outer braces gets a new key and its figure is made again once, unchanged; inputs in braces keep their cached figures. TeX turns a line break into a space, so in LaTeX the items of a notation are separated by commas.

### 10. Tests

- **Unit tests** for each parser: every form above, each error with its token and position, and the limits.
- **Property tests** (fast-check, run with `FUZZ_RUNS=2000` before merging):
  - for random structured values that have a notation, parsing the printed notation gives the value back (for graphs: the node order, the edge order, weights present or absent, and directedness);
  - for random inputs of every module with a notation, the notation, the main field alone and the structured form give the same document;
  - random text never makes a parser throw: it either parses or returns an `INVALID_NOTATION` with a position inside the text.
- `readInput` on each case of section 4; the CLI and MCP on notations, main fields, no input, and `recipe` in `algoviz_show`.
- **E2E**: a player that loads by `algorithm` and `input`, one that shows a notation error, and the CDN bundle loading `algoviz-recipes.js` from next to itself.
- The Typst and LaTeX suites draw a figure from a notation, a main field alone and no input.

### 11. Measuring the cost of use

For each task, the concepts a user must know besides the algorithm's id and step names, and the characters they type. Before is the shortest input on 2026-11-08; after is with this ADR.

| Task                                                              | Before: concepts                                                                                    | Before: chars | After: concepts      | After: chars |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------: | -------------------- | -----------: |
| Dijkstra's third improvement in Typst, on a 4-node graph          | input dictionary, fields `graph` and `source`, `nodes` and `edges`, edge arrays, one-element arrays |           161 | edge list            |           69 |
| BFS on a 5-node graph in LaTeX                                    | JSON, outer braces left out, fields `graph` and `source`, `nodes` and `edges`, edge arrays          |           146 | edge list            |           38 |
| Insertion sort on a web page                                      | the CLI, documents, JSON input, hosting the document, `src`                                         |       80 + 48 | `algorithm`, `input` |           74 |
| A model showing Dijkstra on a 4-node graph (characters it writes) | `run_recipe`, the input schema, `nodes` and `edges`, copying the document into `algoviz_show`       |   134 + 5,140 | `recipe`, edge list  |           58 |
| BST insert 4 then delete 3 in LaTeX                               | JSON, operation objects with `op` and `key`                                                         |           104 | operation list       |           68 |
| An inorder walk of a LeetCode tree with the CLI                   | JSON, the field `levelOrder`                                                                        |            72 | none                 |           56 |

The inputs, before and after:

```typ
// Typst, before and after
#algoviz("dijkstra", (graph: (nodes: ("A", "B", "C", "D"), edges: (("A", "B", 4), ("B", "C", 1), ("A", "C", 7), ("C", "D", 2))), source: "A"), step: "improve#3")
#algoviz("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "improve#3")
```

```latex
% LaTeX, before and after
\algoviz{bfs}{"graph": {"nodes": ["A", "B", "C", "D", "E"], "edges": [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"], ["D", "E"]]}, "source": "A"}
\algoviz{bfs}{A-B, A-C, B-D, C-D, D-E}
\algoviz{bst}{"from": [8, 3, 10, 1, 6], "ops": [{"op": "insert", "key": 4}, {"op": "delete", "key": 3}]}
\algoviz{bst}{"from": [8, 3, 10, 1, 6], "ops": "insert 4, delete 3"}
```

```html
<!-- Before: algoviz run insertion-sort '{"values": [5, 2, 4, 6, 1, 3]}' --out insertion.json, then -->
<algo-player src="insertion.json"></algo-player>
<!-- After -->
<algo-player algorithm="insertion-sort" input="5 2 4 6 1 3"></algo-player>
```

For the model, before: `algoviz_run_recipe` with the structured input (134 characters), then the 5,127-character document it returned, copied into `algoviz_show` (about 5,140). After: `algoviz_show { "recipe": "dijkstra", "input": "A-B 4, B-C 1, A-C 7, C-D 2" }`, 58 characters, and no document to read. The last pull request of 1.9 measures the after column on the built outputs and records it in its description.

### 12. Pull requests

1. This ADR.
2. The notations, main fields, the first-example default, `readInput`, the error narrowing, and the CLI and MCP; the MCP guide.
3. The player's `algorithm` and `input`, the on-demand bundle, and the E2E tests; the README's embedding section.
4. Typst and LaTeX: the package changes, READMEs and examples, the measurement; the roadmap entry.

## Consequences

- Every output takes an algorithm and its input, and the common inputs shrink by half to three quarters. Documents, the protocol and figures do not change, so nothing written so far needs updating.
- Notations are a second way to write the same input, so each has a parser, a printer and property tests that tie it to the structured form. A field gains a notation only where people already have one.
- Node names in the graph notation are narrower than in the structured form. A name with `.`, `:` or `-` needs the structured form; the error says so.
- `source` and `root` default to the first node, so a graph algorithm's input can be its graph alone. Inputs written before still mean what they meant.
- `readInput` reads text that is not JSON as a string. A broken JSON object that starts with `{` is still reported as JSON; one that does not start with `{`, `[` or `"` is reported by the notation it was taken for, quoting the token where it went wrong.
- A page that runs an algorithm loads a second file, `algoviz-recipes.js`, of 35 KB gzipped; a page that shows documents loads nothing more.
- Models can show and draw recipes by name, without reading or writing documents, which cuts what they write for a recipe from thousands of characters to tens.

### Rejected options

- **A notation for the whole input, such as `"A-B 4, B-C 2 from A"`.** It would need a grammar per module. A notation per field, plus the main field alone, covers the common tasks with three notations.
- **One player attribute per input field, such as `graph="…" source="A"`.** HTML lower-cases attribute names, the fields would collide with the player's own attributes (`source` near `src`, `frame`, `layout`), and every new field would be a new attribute. One `input` attribute holds any input.
- **A registry in the bundle.** It adds a third to every page (section 7).
- **A notation outside the schemas, in each output.** Five outputs would each parse it, and differ. In the schemas, they cannot.
- **Parsing notations with `z.preprocess`.** The JSON Schema of a preprocessed field is empty, so models would not see the forms; a union keeps both forms visible.
