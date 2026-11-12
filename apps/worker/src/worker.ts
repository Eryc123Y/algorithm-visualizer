/**
 * The Worker's entry: only the handler, as workerd requires of a module's
 * exports. See `app.ts`.
 */
import { createHttpHandler, shareBaseFromEnv } from '@algoviz/mcp';

import { createWorker } from './app.ts';

// Share links need the share page's address, which no code assumes.
export default createWorker((env) =>
  createHttpHandler({
    shareUrl: shareBaseFromEnv({ ALGOVIZ_SHARE_URL: env.ALGOVIZ_SHARE_URL }),
  }),
);
