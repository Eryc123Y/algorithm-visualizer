import type { Guide } from '../guide.ts';
import { text } from '../html.ts';

/** Complete examples and action fields, checked against the authoring guide. */
const kinds = [
  {
    kind: 'array',
    summary:
      'A row of cells; use view="heap" for a heap tree above its array. Patterns add a row for string matching.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "array",\n      "initial": [\n        5,\n        2\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "swap",\n          "i": 0,\n          "j": 1\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'set | index, value',
      'swap | i, j',
      'insert | index, element',
      'remove | index',
      'compare | i, j',
      'highlight | indices',
      'pointer | name, index',
      'settle | index',
      'align | shift, matched?',
      'check | j',
    ],
  },
  {
    kind: 'stack',
    summary: 'Last in, first out. Initial values run from bottom to top.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "stack",\n      "initial": [\n        1\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "push",\n          "element": 2\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: ['push | element', 'pop | —', 'peek | —', 'highlight | indices'],
  },
  {
    kind: 'queue',
    summary:
      'First in, first out, with deque operations at either end. Positions count from the front.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "queue",\n      "initial": [\n        1\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "enqueue",\n          "element": 2\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'enqueue | element',
      'dequeue | —',
      'pushFront | element',
      'popBack | —',
      'peek | end?',
      'highlight | indices',
    ],
  },
  {
    kind: 'linkedList',
    summary:
      'Nodes in row order, with explicit next and optional prev links. Moving a node does not rewire its links.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "linkedList",\n      "initial": [\n        1,\n        2\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "link",\n          "from": 0,\n          "to": null\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'insert | index, element',
      'remove | index',
      'set | index, value',
      'move | from, to',
      'link | from, to, field?',
      'pointer | name, index',
      'highlight | indices',
      'visit | index',
      'settle | index',
    ],
  },
  {
    kind: 'tree',
    summary:
      'Rooted trees and forests. Level-order nulls leave empty binary slots; generated node ids skip those nulls.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "tree",\n      "levelOrder": [\n        8,\n        3,\n        10\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "visit",\n          "node": "e1"\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'addNode | node, parent, slot?',
      'removeNode | node',
      'setChild | parent, child, slot?',
      'detach | node, slot?',
      'rotate | node, direction',
      'setValue | node, value',
      'swapValues | a, b',
      'setColor | node, color',
      'highlight | nodes',
      'compare | a, b',
      'visit | node',
      'settle | node',
      'group | node, group',
      'pointer | name, node',
      'annotate | node, text, field?',
      'markEdge | node, mark',
      'labelEdge | node, label',
    ],
  },
  {
    kind: 'btree',
    summary:
      'Multiway trees with keys in each node. The kind checks shape, not sorted order or a minimum degree.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "btree"\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "insertKey",\n          "node": "root",\n          "index": 0,\n          "key": 4\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'insertKey | node, index, key',
      'removeKey | key',
      'setKey | key, value',
      'lift | key, over',
      'split | node, index, newNode',
      'grow | newRoot',
      'merge | node, index',
      'shrink | —',
      'borrow | node, child, from',
      'highlight | keys?, nodes?',
      'settle | key',
      'pointer | name, node',
      'annotate | node, text',
    ],
  },
  {
    kind: 'graph',
    summary:
      'Nodes and directed or undirected edges, optionally weighted. Edge ids default to from-to in declaration order.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "graph",\n      "nodes": [\n        "A",\n        "B"\n      ],\n      "edges": [\n        [\n          "A",\n          "B",\n          4\n        ]\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "visit",\n          "node": "A"\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'addNode | node',
      'removeNode | node',
      'setValue | node, value',
      'addEdge | edge',
      'removeEdge | edge',
      'setWeight | edge, weight',
      'highlight | nodes?, edges?',
      'visit | node',
      'settle | node',
      'group | node, group',
      'pointer | name, node',
      'annotate | node, text',
      'markEdge | edge, mark',
      'resetMarks | —',
    ],
  },
  {
    kind: 'table',
    summary:
      'A grid indexed by [row, column]. Null cells draw empty; short initial rows are padded.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "table",\n      "initial": [\n        [\n          0,\n          null\n        ]\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "set",\n          "cell": [\n            0,\n            1\n          ],\n          "value": 1\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'set | cell, value',
      'highlight | cells',
      'depend | cell, on',
      'settle | cells',
      'resetMarks | —',
    ],
  },
  {
    kind: 'hashTable',
    summary:
      'Separate chaining. Choose each bucket yourself and explain the hash in narration.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "hashTable",\n      "size": 5\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "insert",\n          "bucket": 2,\n          "element": 7\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'insert | bucket, element, index?',
      'remove | bucket, index',
      'set | bucket, index, value',
      'highlight | bucket, indices?',
      'settle | bucket, index',
      'resetMarks | —',
    ],
  },
  {
    kind: 'priorityQueue',
    summary:
      'Items sorted by key, min first by default. Null keys mean infinity. Name items by id as positions change.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "priorityQueue",\n      "initial": [\n        {\n          "id": "A",\n          "value": "A",\n          "key": null\n        }\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "setKey",\n          "id": "A",\n          "key": 4\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'insert | element, key',
      'extract | —',
      'setKey | id, key',
      'peek | —',
      'highlight | ids',
    ],
  },
  {
    kind: 'plane',
    summary:
      'Points and segments at coordinates, with y pointing up and one scale across the run.',
    example:
      '{\n  "version": "1.0",\n  "structures": {\n    "s": {\n      "kind": "plane",\n      "points": [\n        {\n          "id": "a",\n          "x": 0,\n          "y": 0\n        },\n        {\n          "id": "b",\n          "x": 4,\n          "y": 3\n        }\n      ]\n    }\n  },\n  "steps": [\n    {\n      "actions": [\n        {\n          "target": "s",\n          "type": "compare",\n          "points": [\n            "a",\n            "b"\n          ]\n        }\n      ],\n      "meta": {\n        "id": "change",\n        "narration": "Apply one action to the declared structure."\n      }\n    }\n  ]\n}',
    actions: [
      'addPoint | point',
      'removePoint | id',
      'addSegment | segment',
      'removeSegment | id',
      'label | segment, text',
      'highlight | points?, segments?',
      'compare | points',
      'visit | point',
      'settle | point',
      'select | segment, on',
      'pointer | name, point',
      'line | name, x',
    ],
  },
] as const;

export const documents: Guide = {
  slug: 'documents',
  title: 'Documents',
  nav: 'Documents',
  summary:
    'A document records structures and actions as JSON. Write one when a ready-made algorithm does not describe the lesson you want to show.',
  figures: [
    {
      key: 'stack',
      algorithm: 'balanced-brackets',
      input: '(())',
      step: 'push#2',
      alt: 'A bracket-matching run with two opening brackets on its stack.',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="when">When to write a document</h2>
<p>Start with an <a href="${root}algorithms/">algorithm</a> if one fits. It makes a complete document for your input. Write a document for a custom procedure, a partial trace, or a particular sequence of actions you want to teach. It describes what happens; it does not execute source code.</p>

<h2 id="shape">The shape</h2>
<p>Write <code>version: "1.0"</code>, a map of <code>structures</code>, and a list of <code>steps</code>. Each declaration has a <code>kind</code>. Each action names a declared structure in <code>target</code> and an operation in <code>type</code>. Actions in a step apply in order. Frame 0 is the initial state; frame n is the state after step n.</p>
${code(
  JSON.stringify(
    {
      version: '1.0',
      title: 'Push, then pop',
      structures: { s: { kind: 'stack', initial: [1] } },
      steps: [
        {
          actions: [{ target: 's', type: 'push', element: 2 }],
          meta: { id: 'push', narration: 'Push 2 above 1.' },
        },
        {
          actions: [{ target: 's', type: 'pop' }],
          meta: {
            id: 'pop',
            narration: 'Pop removes 2, the last value pushed.',
          },
        },
      ],
      sections: [
        { id: 'push-2', title: 'Push 2', start: 0 },
        { id: 'pop-2', title: 'Pop 2', start: 1 },
      ],
    },
    null,
    2,
  ),
  'A complete document: stack.json',
)}
${figure('stack', 'Bracket matching uses the same stack kind to keep unmatched opening brackets.')}
<p>Use one step for each change a learner should see. An empty <code>actions</code> list can carry narration without changing data. Structure names are identifiers such as <code>a</code> or <code>call_stack</code>. Give a structure a <code>label</code> for a useful caption and <code>place: "side"</code> for an auxiliary structure such as a call stack.</p>

<h2 id="names">Names, narration and sections</h2>
<p><code>meta.id</code> is a repeatable step name, such as <code>compare</code>. Use lower-case words joined by hyphens, starting with a letter, at most 40 characters. Name every step. <code>meta.narration</code> explains what happens and why; <code>meta.vars</code> can show current variable values.</p>
<p><code>sections</code> group consecutive steps. Each has a unique <code>id</code>, <code>title</code> and zero-based <code>start</code> step index. The section ends at the next section's start or the timeline's end. Do not reuse a step name as a section id: the bare selector would mean the section.</p>
<div class="scroll" role="region" aria-label="Document selectors" tabindex="0"><table class="params">
<thead><tr><th>Selector</th><th>Meaning in the stack example</th></tr></thead><tbody>
<tr><td><code>0</code>, <code>-1</code></td><td>Initial state; last frame.</td></tr>
<tr><td><code>push</code>, <code>push#1</code></td><td>First step named push; occurrences count from 1.</td></tr>
<tr><td><code>push-2/push</code></td><td>First push in section push-2.</td></tr>
<tr><td><code>push-2</code></td><td>The section, from the frame before its first step through its last frame.</td></tr>
<tr><td><code>push..-1</code></td><td>Range from push to the last frame, inclusive.</td></tr>
</tbody></table></div>
<p>The player opens a section at its first step. Export and inspection include its preceding frame as context. A single-frame renderer requires a selector that names one frame.</p>

<h2 id="sources">Source code in one or several languages</h2>
<p>For one listing, use <code>source: {language, code}</code> and <code>meta.line</code>, with lines counted from 1. For several, use <code>sources</code> instead. Each listing has <code>language</code>, <code>code</code> and <code>anchors</code>, a map from names to line numbers. A step's <code>meta.at</code> names an anchor present in every listing. Do not combine <code>meta.line</code> with <code>sources</code>.</p>
${code(
  JSON.stringify(
    {
      version: '1.0',
      sources: [
        { language: 'pseudocode', code: 'PUSH(s, 2)', anchors: { push: 1 } },
        { language: 'python', code: 's.append(2)', anchors: { push: 1 } },
      ],
      structures: { s: { kind: 'stack', initial: [1] } },
      steps: [
        {
          actions: [{ target: 's', type: 'push', element: 2 }],
          meta: {
            id: 'push',
            at: 'push',
            vars: { x: 2 },
            narration: 'Push 2 on top.',
          },
        },
      ],
    },
    null,
    2,
  ),
  'A document with two source listings',
)}
<p>Put pseudocode first. Keep variable names and zero-based data indices consistent across languages. The player's language menu changes the listing without changing the frame.</p>

<h2 id="kinds">Structure kinds and actions</h2>
<p>Each example below is a complete document with one action. Indices count from 0. Bare values receive stable generated ids. An element can instead be <code>{"id":"x","value":5}</code>. Do not reuse ids after removal. Actions use the state left by earlier actions, including earlier actions in the same step.</p>
<p>The tables list every action and its fields besides <code>target</code> and <code>type</code>. A question mark marks an optional field. For full constraints and worked traces, run <code>algomotion guide KIND</code> or request that kind with <code>algomotion_guide</code>.</p>
${kinds
  .map(
    (k) => `
<h2 id="${k.kind}">${k.kind}</h2>
<p>${text(k.summary)}</p>
${code(k.example, k.kind + ' document')}
<div class="scroll" role="region" aria-label="${k.kind} actions" tabindex="0"><table class="params"><thead><tr><th>Action</th><th>Fields</th></tr></thead><tbody>
${k.actions
  .map((row) => {
    const [action, fields] = row.split(' | ');
    return (
      '<tr><td><code>' +
      text(action!) +
      '</code></td><td><code>' +
      text(fields!) +
      '</code></td></tr>'
    );
  })
  .join('')}
</tbody></table></div>
`,
  )
  .join('')}

<h2 id="marks">Marks and references</h2>
<p>Comparisons, highlights, peeks, table dependencies and swap marks last one step. Visits, settled marks, pointers, groups, annotations, edge marks, plane selections, labels and lines persist until changed or their target disappears. Graphs, tables and hash tables have <code>resetMarks</code>. A null pointer target removes the pointer.</p>
<p>Array patterns need the row view and keep the text fixed: <code>set</code>, <code>swap</code>, <code>insert</code> and <code>remove</code> are refused while a pattern exists. Pattern <code>check</code> compares against the actual text, so the engine rejects false matching claims. Tree edges are addressed by child node; graph edges by edge id. The undirected edge <code>["B","A"]</code> still has id <code>B-A</code>.</p>

<h2 id="validate">Validate and inspect before sharing</h2>
<p>Save the first complete example as <code>stack.json</code>, then use the <a href="${root}guide/cli/">CLI</a>:</p>
${code('algomotion validate stack.json\nalgomotion inspect stack.json 0 push -1', 'Check a hand-written document')}
<p>Or call <code>algomotion_validate</code> with <code>{"document": ...}</code>, then <code>algomotion_inspect</code> with the document and <code>frames: [0, "push", -1]</code>. Validation checks both schema and replay. Inspection checks that valid actions produce the lesson you intended.</p>
${code('OUT_OF_RANGE at $.steps[3].actions[0].j: j=4 is out of range for an array of length 4 (hint: Valid values are 0 to 3.)', 'An action diagnostic')}
<p>The path names the first action of the fourth step. Replay stops at the first failing action; fix it and validate again. The JSON Schema id is <code>urn:algomotion:schema:visualization:1.0</code>; retrieve it through <code>algomotion://schema</code> or <code>visualizationJsonSchema()</code> from <code>@algomotion/spec</code>.</p>

<h2 id="limits">Limits and compatibility</h2>
<p>A document may declare 16 structures and 10,000 steps, with 100 actions per step. General structure limits are 1,000 elements and 4,000 edges; tables have their own 100-row and 100-column limits. A plane has at most 64 points and 128 segments. Source listings are limited to eight, each at most 20,000 characters. Individual algorithms may use smaller inputs.</p>
${note('<p>Protocol 1.x only adds optional fields, actions, kinds, marks or wider limits. Every valid 1.0 document stays valid and keeps its meaning. A breaking change needs 2.0 and an upgrade. Unknown fields are errors: a future field needs its newer version and reader. Write the oldest version that covers the features you use.</p>')}
<p>ADR 0043 defines that promise. Diagnostic codes keep their meaning across 1.x; wording may change. Layout, painting and player attributes are outside the protocol and can improve without a major version. Older 0.1–0.9 documents are upgraded to 1.0 with an <code>UPGRADED_VERSION</code> warning; new documents should say <code>1.0</code>.</p>
`,
};
