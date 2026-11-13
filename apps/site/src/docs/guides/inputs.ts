import type { Guide } from '../guide.ts';

export const inputs: Guide = {
  slug: 'inputs',
  title: 'Inputs',
  nav: 'Inputs',
  summary:
    'Write an input as a short notation or as JSON. The algorithm checks its shape and reports the field that needs fixing.',
  figures: [
    {
      key: 'graph',
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1, A-C 7',
      step: 'improve#3',
      alt: 'Dijkstra improves the distance to C through B on a weighted graph.',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="choose">Choose an algorithm first</h2>
<p>Each <a href="${root}algorithms/">algorithm page</a> describes its input. The same input works in the player, the command line, Typst, LaTeX and the AI tools. These command examples use the <a href="${root}guide/cli/">repository-built command</a>.</p>
<p>An input with one required field may be that field alone. A sort takes its values; Dijkstra takes its graph and starts at the first node. An algorithm with two required fields needs an object. Leaving the input out runs the algorithm's first example.</p>
${code(
  `algomotion run insertion-sort '5 2 4 6 1 3'
algomotion run binary-search '{"values": "1 3 5 7 9", "target": 7}'
algomotion run dijkstra`,
  'Run an algorithm',
)}

<h2 id="lists">Lists and trees</h2>
<p>Separate numbers with spaces or commas. Brackets are optional in a notation string. At the command line, a value starting with <code>[</code> is JSON, so use JSON commas there. A tree's level order uses <code>null</code> for an empty slot. Word lists work for algorithms such as tries.</p>
${code(
  `algomotion run insertion-sort '5, 2, 4, 6, 1, 3'
algomotion run insertion-sort '[5, 2, 4, 6, 1, 3]'
algomotion run inorder-tree-walk '[4, 2, 6, 1, 3, null, 7]'
algomotion run trie '{"from":"cat car", "ops":"insert dog, search cat"}'`,
  'Lists and level order',
)}

<h2 id="tree-shapes">B-tree nodes and Fibonacci heap forests</h2>
<p>A B-tree node writes its keys in square brackets, then its children in parentheses. A Fibonacci heap writes root trees separated by spaces or commas; each key may have children in parentheses. A star marks a node that has lost a child. Put these notations inside the input object's <code>from</code> field.</p>
${code(
  `algomotion run b-tree.insert '{"from":"[G M] ([A C] [H K] [N R])", "key":"B"}'
algomotion run fibonacci-heap.extract-min '{"from":"7 3(18 52) 17"}'`,
  'Explicit tree shapes',
)}

<h2 id="graphs">Graphs as edge lists</h2>
<p>Write <code>A-B</code> for an undirected edge and <code>A-&gt;B</code> for a directed one. Put the weight after a space. Separate edges with commas; a name alone declares an isolated node. Names use letters, digits and underscores. Nodes keep the order in which they first appear.</p>
${code(
  `algomotion run dijkstra 'A-B 4, B-C 1, A-C 7'
algomotion run topological-sort 'shirt->tie, tie->jacket, socks'
algomotion run dijkstra '{"graph":"A-B 4, B-C 1", "source":"C"}'
algomotion run prim '{"graph":"A-B 4, B-C 1", "root":"C"}'`,
  'Weighted and directed graphs',
)}
${figure('graph', 'The edge list <code>A-B 4, B-C 1, A-C 7</code>, at <code>improve#3</code>.')}
<p>The structured form names nodes and edges explicitly. It is useful when constructing an input in code.</p>
${code(`algomotion run dijkstra '{"graph":{"nodes":["A","B","C"],"edges":[["A","B",4],["B","C",1]]},"source":"A"}'`, 'A structured graph')}

<h2 id="operations">Operation lists</h2>
<p>A structure's sequence takes <code>from</code> and <code>ops</code>, with up to eight operations. Each operation has its arguments in order. The available names and arguments depend on the structure. A single operation has its own id, such as <code>bst.delete</code>.</p>
${code(
  `algomotion run bst '{"from":"8 3 10 1 6", "ops":"insert 4, delete 3"}'
algomotion run min-heap '{"from":"5 3 8", "ops":"push 1, pop"}'
algomotion run bst.delete '{"from":[8,3,10,1,6], "key":3}'
algomotion run bst '{"from":[8,3,10],"ops":[{"op":"insert","key":4},{"op":"delete","key":3}]}'`,
  'Sequences and single operations',
)}

<h2 id="matrices">Tables and matrices</h2>
<p>Matrix algorithms take nested arrays, or a string with semicolons between rows and spaces or commas between entries. The matrix multiplication algorithms require square matrices of small integers. A visualization table itself uses rows of values in a <a href="${root}guide/documents/#table">document</a>; it has no separate general table-input notation.</p>
${code(
  `algomotion run strassen '{"a":"1 2; 3 4", "b":"5 6; 7 8"}'
algomotion run strassen '{"a":[[1,2],[3,4]], "b":[[5,6],[7,8]]}'`,
  'Two matrices',
)}

<h2 id="points">Points and segments</h2>
<p>Write points as <code>(x, y)</code>, optionally with a name such as <code>a(0, 0)</code>. Structured points may be coordinate pairs or objects with <code>id</code>, <code>x</code> and <code>y</code>. Geometry algorithms take integer coordinates from −999 to 999 and reject repeated coordinates. A segment joins two coordinate pairs with a dash; an optional name precedes a colon.</p>
${code(
  `algomotion run graham-scan 'a(0, 0) b(4, 0) c(4, 4) d(0, 4) e(2, 2)'
algomotion run graham-scan '[[0,0],[4,0],[4,4],[0,4],[2,2]]'
algomotion run any-segments-intersect '(0, 0)-(4, 4), s2: (0, 4)-(4, 0)'`,
  'Geometry inputs',
)}

<h2 id="json">JSON and objects without braces</h2>
<p>Text is first read as JSON, then as a JSON object with its outer braces restored. Other text is a notation string. Text starting with <code>{</code>, <code>[</code> or <code>&quot;</code> that fails both JSON reads is an error. Use double quotes around JSON keys and strings. The single quotes below belong to the shell.</p>
${code(
  `algomotion run bst.delete '"from":"8 3 10 1 6", "key":3'
algomotion run balanced-brackets '"{[()]}"'`,
  'Objects and literal strings',
)}
<p>JavaScript tools accept actual values. Typst accepts arrays and dictionaries, such as <code>(from: (8, 3, 10), key: 3)</code>. They do not need JSON text around those values.</p>

<h2 id="files">Inputs in files</h2>
<p>Save <code>{"graph":"A-B 4, B-C 1", "source":"A"}</code> as <code>graph.json</code>. The export command reads it with <code>--input</code>; names ending in <code>.json</code> always name files. A dash reads standard input. The positional argument of <code>run</code> is input text, not a file name.</p>
${code(
  `algomotion export dijkstra --input graph.json --step -1 --out figures
cat graph.json | algomotion export dijkstra --input - --step -1 --out figures
algomotion run dijkstra 'A-B 4, B-C 1' --out run.json`,
  'Read input and write a document',
)}
<p>The player reads an input file with <code>algorithm="dijkstra" src="graph.json"</code>. LaTeX uses <code>\\algomotionfile[algorithm=dijkstra]{graph.json}</code>. Typst reads it with <code>json("graph.json")</code>.</p>

<h2 id="errors">What an error looks like</h2>
${code(
  `algomotion run dijkstra 'A-B 4, B-C x'
# INVALID_NOTATION at $.input: Expected a weight or "," after "B-C", not "x" (character 12)`,
  'A notation error',
)}
<p>The error has a code, a path, a message and often a hint. <code>$.input.graph</code> points into an object; <code>$.input</code> refers to the main field given alone. <code>INVALID_JSON</code> means the text could not be read, <code>INVALID_SHAPE</code> means a field has the wrong type or is missing, and <code>INVALID_ARGUMENT</code> means the algorithm cannot run that input.</p>
${note('<p>Fix the field the path names, then run again. An input accepted by one algorithm may exceed another algorithm’s limits; the catalogue and <code>algomotion recipes</code> give each input schema.</p>')}
`,
};
