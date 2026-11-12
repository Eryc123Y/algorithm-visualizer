/**
 * Every E2E test of the site fails on a console error, a page error, a
 * dialog or a Content Security Policy violation, so the pages' own code
 * must also live within their policy.
 */
import { test as base, expect } from '@playwright/test';

export { expect };

export const test = base.extend<{ watch: void }>({
  watch: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
      page.on('dialog', (d) => {
        problems.push(`dialog: ${d.message()}`);
        void d.dismiss();
      });
      await page.addInitScript(() => {
        addEventListener('securitypolicyviolation', (e) =>
          console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`),
        );
      });
      await use();
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});
