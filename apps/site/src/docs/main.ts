/**
 * The documentation pages' script (roadmap 3.4): the player, copy buttons
 * on the snippets, the catalogue's filter and the home page's playground.
 */
// First: it configures zod before any package builds a schema.
import '../no-eval.ts';

import { AlgoPlayer } from '@algomotion/elements';
// The themes' web fonts, bundled with the pages (ADR 0030).
import '@algomotion/elements/fonts.css';
// The site's own faces, IBM Plex Sans and Mono (OFL), bundled with the pages.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './docs.css';
import {
  addCopyButtons,
  filterCatalog,
  loopOverlays,
  markLoadingThumbnails,
  setUpTabs,
} from './enhance.ts';
import { nameFigure, setUpStory } from './story.ts';
import { setUpPlayground } from './playground-ui.ts';

AlgoPlayer.fontsUrl = null;
if (!customElements.get('algo-player'))
  customElements.define('algo-player', AlgoPlayer);

addCopyButtons(document, navigator.clipboard, location.href);
setUpTabs(document);
loopOverlays(document);
markLoadingThumbnails(document);
setUpPlayground(document, {
  location,
  history,
  load: () => import('./playground-run.ts'),
});
setUpStory(document, window);
nameFigure(document);
const filter = document.querySelector<HTMLInputElement>('#filter');
filter?.addEventListener('input', () => filterCatalog(document, filter.value));
