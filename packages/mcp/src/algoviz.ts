#!/usr/bin/env node
/** The `algoviz` command; see cli.ts. */
import { main } from './cli.ts';

process.exitCode = main(process.argv.slice(2));
