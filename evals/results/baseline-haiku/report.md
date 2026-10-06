# Eval run: claude-haiku-4-5, cli-agent

2026-10-06T16:08:52.240Z · Claude Code subagents using evals/src/agent.ts, three tasks each

| Metric | Value |
| --- | --- |
| Correct | 100% (27/27) |
| Valid when handed in | 100% (27/27) |
| Valid at first validation | 93% (25/27) |
| Validations per task | 1.1 |

## Tasks

| Task | Correct | Valid | First valid | Validations | Steps | Narrated | Problems |
| --- | --- | --- | --- | --- | --- | --- | --- |
| insertion-sort | ✓ | ✓ | ✓ | 2 | 32 | 100% |  |
| selection-sort | ✓ | ✓ | ✓ | 1 | 19 | 100% |  |
| binary-search-miss | ✓ | ✓ | ✓ | 1 | 4 | 100% |  |
| two-sum-sorted | ✓ | ✓ | ✓ | 1 | 9 | 100% |  |
| build-max-heap | ✓ | ✓ | ✓ | 1 | 12 | 100% |  |
| dutch-flag | ✓ | ✓ | ✓ | 1 | 16 | 100% |  |
| postfix-eval | ✓ | ✓ | ✓ | 1 | 17 | 100% |  |
| printer-queue | ✓ | ✓ | ✓ | 1 | 9 | 100% |  |
| sliding-window-max | ✓ | ✓ | ✓ | 1 | 14 | 100% |  |
| reverse-list | ✓ | ✓ | ✓ | 1 | 17 | 100% |  |
| delete-list-node | ✓ | ✓ | ✓ | 1 | 6 | 100% |  |
| floyd-cycle | ✓ | ✓ | ✓ | 1 | 13 | 100% |  |
| bst-delete | ✓ | ✓ | ✓ | 1 | 8 | 100% |  |
| avl-rotation | ✓ | ✓ | ✓ | 1 | 10 | 100% |  |
| level-order | ✓ | ✓ | ✓ | 1 | 21 | 100% |  |
| trie-insert | ✓ | ✓ | ✓ | 1 | 19 | 100% |  |
| union-find | ✓ | ✓ | ✓ | 2 | 9 | 100% |  |
| red-black-insert | ✓ | ✓ | ✗ | 2 | 11 | 100% |  |
| bfs | ✓ | ✓ | ✓ | 1 | 7 | 100% |  |
| topological-sort | ✓ | ✓ | ✓ | 1 | 17 | 100% |  |
| dijkstra | ✓ | ✓ | ✓ | 1 | 6 | 100% |  |
| kruskal | ✓ | ✓ | ✓ | 1 | 8 | 100% |  |
| graph-coloring | ✓ | ✓ | ✓ | 1 | 6 | 100% |  |
| lcs | ✓ | ✓ | ✓ | 1 | 20 | 100% |  |
| coin-change | ✓ | ✓ | ✓ | 1 | 14 | 100% |  |
| hash-chaining | ✓ | ✓ | ✓ | 1 | 5 | 100% |  |
| linear-probing | ✓ | ✓ | ✗ | 2 | 27 | 100% |  |

## Validation errors

- **LINE_OUT_OF_RANGE** × 8
  - `LINE_OUT_OF_RANGE at $.steps[1].meta.line: Line 7 is past the end of the source code (hint: The source code has 6 lines.)`
  - `LINE_OUT_OF_RANGE at $.steps[3].meta.line: Line 7 is past the end of the source code (hint: The source code has 6 lines.)`
  - `LINE_OUT_OF_RANGE at $.steps[5].meta.line: Line 7 is past the end of the source code (hint: The source code has 6 lines.)`
- **INVALID_ACTION** × 4
  - `INVALID_ACTION at $.steps[0].actions[0].node: Unrecognized key: "color"`
  - `INVALID_ACTION at $.steps[2].actions[0].node: Unrecognized key: "color"`
  - `INVALID_ACTION at $.steps[4].actions[0].node: Unrecognized key: "color"`
