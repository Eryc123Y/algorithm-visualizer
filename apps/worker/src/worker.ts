/**
 * The Worker's entry: only the handler, as workerd requires of a module's
 * exports. See `app.ts`.
 */
import { createHttpHandler } from '@algoviz/mcp';

import { createWorker } from './app.ts';

export default createWorker(createHttpHandler());
