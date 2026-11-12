/**
 * The share page (ADR 0040): plays the link in the address bar, and the
 * next one whenever the fragment changes.
 */
// First: it configures zod before any package builds a schema.
import './no-eval.ts';

import { AlgoPlayer } from '@algoviz/elements';
// The themes' web fonts, bundled with the page (ADR 0030).
import '@algoviz/elements/fonts.css';

import './play.css';
import { showFragment, type PlayPage } from './show.ts';

AlgoPlayer.fontsUrl = null;
if (!customElements.get('algo-player'))
  customElements.define('algo-player', AlgoPlayer);

const part = (selector: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`The share page has no ${selector}`);
  return el;
};

const page: PlayPage = {
  intro: part('#intro'),
  problem: part('#problem'),
  errors: part('#errors'),
  stage: part('#stage'),
};

const play = () => void showFragment(location.hash, page);
addEventListener('hashchange', play);
play();
