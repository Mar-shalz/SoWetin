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

// S-007: the filters sheet opens, a choice sticks after Apply, and the button says how many filters are on.
test('filters open, apply and show their count', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Rice', exact: true }).click();
  await page.getByRole('button', { name: 'Show plates' }).click();
  await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Filters, 1 on' })).toBeVisible();
});

// S-024: the house row opens its sheet, and the sheet closes again.
test("what's in the house opens and closes", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "What's in the house? Tap what you have." }).click();
  const sheet = page.getByRole('dialog', { name: "What's in the house?" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
});
