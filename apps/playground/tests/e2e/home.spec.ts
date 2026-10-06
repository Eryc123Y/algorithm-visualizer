import { expect, test } from '@playwright/test';

test('plays the sample and steps through it', async ({ page }) => {
  await page.goto('/');
  const player = page.getByTestId('player');
  await expect(player.locator('.narration')).toHaveText('Initial state.');
  await player.getByRole('button', { name: 'Next step' }).click();
  await expect(player.locator('.narration')).toHaveText('Compare 5 and 3.');
  await expect(player.locator('.line.current')).toContainText(
    'if a[j] > a[j + 1]:',
  );
  await player.getByRole('button', { name: 'Next step' }).click();
  await expect(player.locator('[data-role="swap"]')).toHaveCount(2);
  await expect(player).toHaveAttribute('frame', '2');
});

test('supports keyboard navigation', async ({ page }) => {
  await page.goto('/');
  const player = page.getByTestId('player');
  await player.focus();
  await page.keyboard.press('End');
  await expect(player.locator('.narration')).toHaveText('Sorted.');
  await page.keyboard.press('ArrowLeft');
  await expect(player).toHaveAttribute('frame', '20');
});

test('shows protocol errors for an edited document', async ({ page }) => {
  await page.goto('/');
  const editor = page.getByTestId('editor');
  const text = await editor.inputValue();
  await editor.fill(text.replace('"type": "swap"', '"type": "swop"'));
  await expect(page.getByTestId('player').locator('.errors')).toContainText(
    'UNKNOWN_ACTION',
  );
  await editor.fill('{ not json');
  await expect(page.getByTestId('json-error')).toBeVisible();
});
