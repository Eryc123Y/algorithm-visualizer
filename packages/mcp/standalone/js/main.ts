/**
 * Entry of the standalone executable's bundle (ADR 0027): the CLI of
 * `@algomotion/mcp`, with the host's arguments, output and exit code.
 */
import { main } from '../../src/cli.ts';

import { host } from './host.ts';

host.exit(
  main(
    host.argv,
    (text) => host.write(1, `${text}\n`),
    (text) => host.write(2, `${text}\n`),
  ),
);
