import { expect, test } from '@playwright/test';

test('home page renders the heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Algorithm Visualizer',
  );
});

test('navigates to the about page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'This is an about page',
  );
});
