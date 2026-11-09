import { expect, test } from '@playwright/test';

// S-001: the answer pills change, and Pick for me always answers (a plate, "nothing ready yet", or an error).
test('the answer pills change and Pick for me answers', async ({ page }) => {
  const cspErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && /Content Security Policy/i.test(m.text()) && cspErrors.push(m.text()));
  await page.goto('/');
  await page.getByLabel('1 person. Change it').selectOption('2');
  await expect(page.getByLabel('2 people. Change it')).toBeVisible();
  await page.getByRole('button', { name: 'Pick for me' }).click();
  await expect(page.locator('section[aria-live]')).not.toBeEmpty();
  expect(cspErrors).toEqual([]);
});
