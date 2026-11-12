/**
 * Accessibility: no serious or critical axe violations in the playground
 * or in an embedded player, in every built-in theme (ADR 0030), with or
 * without errors.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { themeNames } from '@algoviz/svg';

import type { AlgoPlayer } from '@algoviz/elements';

import { expect, test } from './fixtures';

const scan = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
    );
};

for (const colorScheme of ['light', 'dark'] as const)
  test(`the playground (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await page
      .getByTestId('player')
      .getByRole('button', { name: 'Next step' })
      .click();
    expect(await scan(page)).toEqual([]);
  });

for (const colorScheme of ['light', 'dark'] as const)
  test(`a player with sections (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByTestId('example').selectOption('Binary search tree');
    const player = page.getByTestId('player');
    await player.getByRole('button', { name: 'Next step' }).click();
    await expect(player.locator('.sections .current')).toHaveCount(1);
    expect(await scan(page)).toEqual([]);
    // A selector that matches nothing shows an alert beside the player.
    await player.evaluate((el) => el.setAttribute('frame', 'nope'));
    await expect(player.getByRole('alert')).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

for (const theme of themeNames)
  test(`a player in the ${theme} theme, with its code`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByTestId('theme').selectOption(theme);
    await page.getByTestId('example').selectOption('Dijkstra’s algorithm');
    const player = page.getByTestId('player');
    await expect(player).toHaveAttribute('data-resolved-theme', theme);
    await player.evaluate((el: AlgoPlayer) => el.seek(12));
    await expect(player.locator('.line.current')).toHaveCount(1);
    expect(await scan(page)).toEqual([]);
  });

test('a player showing errors', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page
    .getByTestId('editor')
    .fill('{"version": "1.0", "structures": {}, "steps": []}');
  await expect(page.getByTestId('player').getByRole('alert')).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('every control has a name and is reachable by keyboard', async ({
  page,
}) => {
  await page.goto('/');
  const player = page.getByTestId('player');
  for (const name of ['Previous step', 'Play', 'Next step'])
    await expect(player.getByRole('button', { name })).toBeVisible();
  await expect(player.getByRole('slider', { name: 'Timeline' })).toBeVisible();
  await expect(player.locator('svg.scene')).toHaveAttribute('role', 'img');
  // Tab reaches the player itself, then its controls.
  await page.getByTestId('theme').focus();
  await page.keyboard.press('Tab');
  await expect(player).toBeFocused();
});
