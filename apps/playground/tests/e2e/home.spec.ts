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

test('display mode shows only the animation and plays by itself', async ({
  page,
}) => {
  await page.goto('/');
  const display = page.getByTestId('display').first();
  await display.scrollIntoViewIfNeeded();
  await expect(display.locator('.controls')).toBeHidden();
  await expect(display.locator('.caption')).toBeHidden();
  await expect(display.locator('[data-key="arr/title"]')).toHaveCount(0);
  await expect(display).not.toHaveAttribute('frame', '0', { timeout: 5000 });
});

test('switches the main player into display mode', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mode').selectOption('display');
  const player = page.getByTestId('player');
  await expect(player).toHaveAttribute('mode', 'display');
  await expect(player.locator('.code')).toHaveCount(0);
  await expect(player).not.toHaveAttribute('frame', '0', { timeout: 5000 });
});

test('loads an example into the editor and the player', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('example').selectOption('Dijkstra’s algorithm');
  await expect(page.getByTestId('editor')).toHaveValue(/"kind": "graph"/);
  const player = page.getByTestId('player');
  await expect(player.locator('[data-key="g/element/A"]')).toHaveCount(1);
  await player.focus();
  await page.keyboard.press('End');
  await expect(player.locator('.narration')).toContainText(
    'shortest-path tree',
  );
});
