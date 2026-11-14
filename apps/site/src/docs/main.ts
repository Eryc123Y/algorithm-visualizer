/**
 * The documentation pages' script (roadmap 3.4): the player, copy buttons
 * on the snippets, the catalogue's filter and the home page's playground.
 */
// First: it configures zod before any package builds a schema.
import '../no-eval.ts';

import { AlgoPlayer } from '@algomotion/elements';
// The themes' web fonts, bundled with the pages (ADR 0030).
import '@algomotion/elements/fonts.css';

import './docs.css';
import {
  addCopyButtons,
  filterCatalog,
  loopOverlays,
  setUpTabs,
} from './enhance.ts';
import { setUpPlayground } from './playground-ui.ts';

AlgoPlayer.fontsUrl = null;
if (!customElements.get('algo-player'))
  customElements.define('algo-player', AlgoPlayer);

addCopyButtons(document, navigator.clipboard, location.href);
setUpTabs(document);
loopOverlays(document);
setUpPlayground(document, {
  location,
  history,
  load: () => import('./playground-run.ts'),
});
const filter = document.querySelector<HTMLInputElement>('#filter');
filter?.addEventListener('input', () => filterCatalog(document, filter.value));
