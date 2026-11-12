/**
 * The share page's policy forbids eval (ADR 0040). zod probes for it with
 * `new Function` when it builds its first object schema, which the
 * browser reports as a violation; jitless mode skips the probe. This
 * module comes first among the page's imports, before any package builds
 * a schema.
 */
import { z } from 'zod';

z.config({ jitless: true });
