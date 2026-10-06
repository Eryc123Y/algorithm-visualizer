/**
 * Registers <algo-player>. Import this module (or load the CDN bundle) once.
 */
import { AlgoPlayer } from './algo-player.ts';

if (!customElements.get('algo-player'))
  customElements.define('algo-player', AlgoPlayer);

export { AlgoPlayer };
