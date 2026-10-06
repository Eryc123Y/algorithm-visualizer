import { expect, test } from '@playwright/test';

test('steps through the bubble sort sample', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'algoviz playground',
  );
  await expect(page.getByTestId('narration')).toHaveText('Initial state.');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('narration')).toHaveText(
    '5 > 3, so swap them.',
  );
  await expect(page.locator('[data-role="compare"]')).toHaveCount(0);
});
