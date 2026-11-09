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

// S-008: examples show on focus, Find stays off until there's text, money read from the text becomes a removable chip,
// and removing it puts the sentence's budget back.
test('a craving becomes chips that can be removed', async ({ page }) => {
  await page.goto('/');
  const field = page.getByRole('searchbox', { name: 'Craving something? Type am…' });
  const find = page.getByRole('button', { name: 'Find', exact: true });
  await expect(find).toBeDisabled();
  await field.focus();
  await expect(page.getByText('Try one:')).toBeVisible();
  await field.fill('something for 2k');
  await find.click();
  await expect(page.getByRole('button', { name: 'Remove ₦2,000' })).toBeVisible();
  await expect(page.getByLabel('₦2,000. Change it')).toBeVisible();
  await page.getByRole('button', { name: 'Remove ₦2,000' }).click();
  await expect(page.getByLabel('₦3,500. Change it')).toBeVisible();
});

// BR-134: food typed into "Anything else?" that the catalogue doesn't know stays on the list, marked as not in picks.
test('typed house items the catalogue does not know stay on the list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "What's in the house? Tap what you have." }).click();
  const sheet = page.getByRole('dialog', { name: "What's in the house?" });
  await sheet.getByLabel('Anything else?').fill('zobo leaves');
  await sheet.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(sheet.getByText('I don\'t know "zobo leaves" yet.')).toBeVisible();
  await expect(sheet.getByText('Not in picks yet')).toBeVisible();
  await sheet.getByRole('button', { name: 'Remove zobo leaves' }).click();
  await expect(sheet.getByText('Not in picks yet')).toBeHidden();
});
