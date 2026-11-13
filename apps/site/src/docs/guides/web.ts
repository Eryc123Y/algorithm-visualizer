import type { Guide } from '../guide.ts';

export const web: Guide = {
  slug: 'web',
  title: 'Web pages',
  nav: 'Web pages',
  summary:
    'Load the player once, then add an algo-player element for each run or document on the page.',
  figures: [
    {
      key: 'distance',
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1, A-C 7',
      step: 'improve#3',
      alt: 'A weighted graph and the priority queue kept by Dijkstra’s algorithm.',
    },
  ],
  body: ({ root, code, figure, note }) => `
<h2 id="bundle">Build and load the bundle</h2>
<p>The packages are not on npm yet. From a checkout of the repository, install the workspace and build the element:</p>
${code(
  `npm ci
npm run build -w @algomotion/elements`,
  'Build the browser bundle',
)}
<p>Copy <code>packages/elements/dist/cdn/</code> to your site. Keep <code>algomotion-player.js</code> and <code>algomotion-recipes.js</code> together under those names, with the <code>fonts/</code> folder beside them. The second script loads only when a player runs an algorithm. Serve the files over HTTP rather than opening the HTML from disk.</p>
${code(
  `<script type="module" src="/assets/algomotion-player.js"></script>
<algo-player algorithm="dijkstra" input="A-B 4, B-C 1, A-C 7"
  frame="improve#3" theme="auto"></algo-player>`,
  'Embed an algorithm',
)}
${figure('distance', 'The run above at <code>improve#3</code>. The interactive player adds controls, narration and code.')}
<p>The <code>input</code> attribute takes <a href="${root}guide/inputs/">notation or JSON</a>. Leave it out for the first example. With <code>algorithm</code>, <code>src</code> or inline JSON can supply the input instead.</p>

<h2 id="documents">Load a document</h2>
<p>Without <code>algorithm</code>, <code>src</code> points at a <a href="${root}guide/documents/">document</a>. Make this file with <code>algomotion run insertion-sort '5 2 4' --out sort.json</code>, or put a complete document inside the element:</p>
${code(
  `<algo-player src="sort.json"></algo-player>
<algo-player>
  <script type="application/json">
    {"version":"1.0","structures":{"a":{"kind":"array","initial":[5,2,4]}},
     "steps":[{"actions":[{"target":"a","type":"swap","i":0,"j":1}],
               "meta":{"id":"swap","narration":"2 belongs before 5."}}]}
  </script>
</algo-player>`,
  'File and inline documents',
)}
<p>The <code>visualization</code> property takes a document object and wins over all other sources. Otherwise, with <code>algorithm</code>, <code>input</code> wins over <code>src</code>, then inline JSON, then the first example. Without <code>algorithm</code>, <code>src</code> wins over inline JSON.</p>

<h2 id="attributes">Attributes</h2>
<div class="scroll" role="region" aria-label="Player attributes" tabindex="0"><table class="params">
<thead><tr><th>Attribute</th><th>Default</th><th>Use</th></tr></thead><tbody>
<tr><td><code>algorithm</code></td><td>none</td><td>Registry id, such as <code>insertion-sort</code> or <code>bst.delete</code>.</td></tr>
<tr><td><code>input</code></td><td>first example</td><td>Algorithm input as text; the property also accepts objects and arrays.</td></tr>
<tr><td><code>src</code></td><td>none</td><td>URL of JSON: a document, or input when an algorithm is set.</td></tr>
<tr><td><code>frame</code></td><td><code>0</code></td><td>Opening frame number or selector.</td></tr>
<tr><td><code>theme</code></td><td><code>auto</code></td><td>A fixed theme, <code>auto</code>, or two theme names.</td></tr>
<tr><td><code>layout</code></td><td><code>wide</code></td><td><code>narrow</code> puts side structures below the main ones.</td></tr>
<tr><td><code>speed</code></td><td><code>900</code></td><td>Milliseconds per step.</td></tr>
<tr><td><code>autoplay</code></td><td>absent</td><td>Start interactive playback on load.</td></tr>
<tr><td><code>loop</code></td><td>absent</td><td>Repeat interactive playback.</td></tr>
<tr><td><code>hide-controls</code></td><td>absent</td><td>Hide the playback controls.</td></tr>
<tr><td><code>hide-code</code></td><td>absent</td><td>Hide the source listing.</td></tr>
<tr><td><code>language</code></td><td>pseudocode, if present</td><td>Preferred source language, such as <code>python</code>.</td></tr>
<tr><td><code>mode</code></td><td><code>interactive</code></td><td><code>display</code> shows an animation alone.</td></tr>
<tr><td><code>once</code></td><td>absent</td><td>In display mode, play once instead of looping.</td></tr>
<tr><td><code>motion</code></td><td>mode's choice</td><td><code>arc</code> or <code>linear</code>; interactive defaults to arc, display to linear.</td></tr>
</tbody></table></div>
<p>Boolean attributes work by presence: <code>autoplay="false"</code> still enables autoplay. Remove the attribute to turn it off.</p>
${code(
  `<algo-player algorithm="insertion-sort" input="5 2 4"
  autoplay loop speed="1200" hide-code hide-controls motion="linear">
</algo-player>`,
  'Playback attributes',
)}

<h2 id="selectors">Frame selectors</h2>
<p><code>0</code> is the initial state; <code>-1</code> is the last. A name such as <code>improve</code> means its first occurrence; <code>improve#3</code> means its third. Inside a section, counting starts again: <code>delete-3/replacement</code>. A section alone opens at its first step. A range, such as <code>2..5</code>, opens at its first frame; exports and series draw the whole range. The timeline shows sections; Page Up and Page Down move between them.</p>
${code(
  `<algo-player algorithm="bst.delete"
  input='{"from":[8,3,10,1,6],"key":3}' frame="delete-3"
  layout="narrow" language="python"></algo-player>`,
  'Open a section in a narrow column',
)}
<p>Once loaded, <code>player.frame</code> reads back as a number. A selector that does not exist shows a diagnostic with the available names.</p>

<h2 id="themes">Themes and display mode</h2>
<p>The fixed themes are <code>light</code>, <code>dark</code>, <code>print</code>, <code>textbook</code>, <code>textbook-dark</code>, <code>blocks</code>, <code>blocks-dark</code>, <code>answer-sheet</code> and <code>turbo-c</code>. <code>auto</code> follows the reader's light or dark setting. A pair chooses its first theme by day and second by night; printing uses the day theme. See the <a href="${root}themes/">theme samples</a>.</p>
${code(
  `<algo-player algorithm="insertion-sort" input="5 2 4"
  theme="textbook textbook-dark"></algo-player>
<algo-player algorithm="insertion-sort" input="5 2 4" mode="display"
  speed="700" once motion="arc"></algo-player>`,
  'Theme pairs and display mode',
)}
<p>Display mode shows only structures, starts and loops by itself, pauses off screen and takes no keyboard input. Use <code>once</code> for a single run. Reduced-motion preferences suppress transitions between frames.</p>

<h2 id="javascript">Events and properties</h2>
<p><code>algo-load</code> reports <code>{ length }</code>, the number of steps. <code>algo-frame</code> reports <code>{ index, length, playing, stepName?, sectionId? }</code>. <code>algo-error</code> reports <code>{ errors }</code>, an array of diagnostics. Listen before assigning input if you need the load event.</p>
${code(
  `await customElements.whenDefined('algo-player');
const player = document.querySelector('algo-player');
player.addEventListener('algo-frame', (event) => {
  console.log(event.detail.index, event.detail.stepName, event.detail.sectionId);
  console.log(player.stepName, player.section, player.currentLanguage);
});
player.addEventListener('algo-error', (event) => console.error(event.detail.errors));
player.addEventListener('algo-load', () => { player.frame = 'improve#3'; });
player.algorithm = 'dijkstra';
player.input = {graph: 'A-B 4, B-C 1, A-C 7', source: 'A'};`,
  'Observe and control a player',
)}
<p><code>section</code> is the section object with <code>id</code>, <code>title</code> and <code>start</code>; it and <code>stepName</code> can be undefined. Methods are <code>play()</code>, <code>pause()</code>, <code>next()</code>, <code>prev()</code> and <code>seek(index)</code>. <code>length</code> is read-only. Set <code>visualization</code> for a document object or <code>customTheme</code> for a full theme from <code>createTheme</code> in <code>@algomotion/svg</code>.</p>

<h2 id="languages">Source languages</h2>
<p>A document with <code>sources</code> gets a language menu above the code. Switching language keeps the frame. The reader's choice wins over <code>language="python"</code> and the pseudocode default. It follows other players on the site and other tabs through local storage; when storage is refused, it lasts for the page. <code>currentLanguage</code> reports the language on show. The <a href="${root}guide/documents/#sources">document guide</a> explains matching lines across languages.</p>

<h2 id="css">Style the player</h2>
${code(
  `algo-player {
  --algo-accent: #345fbe;
  --algo-accent-fg: white;
  --algo-radius: 12px;
  --algo-control-radius: 6px;
  --algo-panel-radius: 8px;
}`,
  'Player CSS',
)}
<p>Other properties are <code>--algo-bg</code>, <code>--algo-fg</code>, <code>--algo-muted</code>, <code>--algo-border</code>, <code>--algo-surface</code>, <code>--algo-error</code>, <code>--algo-line-bg</code>, <code>--algo-line-edge</code>, <code>--algo-font</code> and <code>--algo-mono</code>. Syntax colours use <code>--algo-code-keyword</code>, <code>--algo-code-string</code>, <code>--algo-code-number</code>, <code>--algo-code-comment</code>, <code>--algo-code-function</code> and <code>--algo-code-builtin</code>. These style the controls and code; the scene uses its theme.</p>

<h2 id="bundlers">Workspace imports and bundlers</h2>
<p>Until npm publication, use the repository's workspace packages and build them locally. A bundler can import the class without registering the element, set the font URL, then define it:</p>
${code(
  `import { AlgoPlayer } from '@algomotion/elements';
AlgoPlayer.fontsUrl = '/assets/fonts/fonts.css';
customElements.define('algo-player', AlgoPlayer);`,
  'Register with a bundler',
)}
<p>Copy <code>packages/elements/dist/fonts/</code> to that assets folder, keeping the stylesheet's relative font URLs. Set <code>fontsUrl</code> before the first player connects. <code>AlgoPlayer.fontsUrl = null</code> disables font loading and uses system fallbacks. For registration alone, import <code>@algomotion/elements/define</code>.</p>
${note('<p>The two standalone JavaScript files belong to the same build. A bundler handles its own chunks; do not copy only its entry file and omit the chunks it imports.</p>')}
`,
};
