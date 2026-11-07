/**
 * Entry of the engine bundle the Typst plugin evaluates (ADR 0026). The
 * plugin's `render` calls the global `renderRequest` with the request's
 * JSON text and returns the JSON text it gives back.
 */
import { createEngine, respond } from './engine.ts';

const engine = createEngine();

(globalThis as Record<string, unknown>)['renderRequest'] = (text: string) =>
  respond(engine, text);
