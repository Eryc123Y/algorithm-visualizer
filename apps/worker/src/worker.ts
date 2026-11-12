/**
 * The Worker's entry: only the handler, as workerd requires of a module's
 * exports. See `app.ts`.
 */
import { createHttpHandler, shareBaseFromEnv } from '@algomotion/mcp';

import { createWorker } from './app.ts';

// Share links need the share page's address, which no code assumes.
export default createWorker((env) =>
  createHttpHandler({
    shareUrl: shareBaseFromEnv({
      ALGOMOTION_SHARE_URL: env.ALGOMOTION_SHARE_URL,
    }),
  }),
);
