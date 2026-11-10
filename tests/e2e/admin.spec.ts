import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Signed out, every admin page sends you to sign-in and shows no catalogue data.
test('admin pages need sign-in, keep the strict policy and stay out of search', async ({ page }) => {
  const cspErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && /Content Security Policy/i.test(m.text()) && cspErrors.push(m.text()));

  for (const path of ['/admin', '/admin/dishes/egusi-soup', '/admin/no-access']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
  }
  await expect(page.getByRole('heading', { name: 'Sign in to the admin' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  // Let the entrance motion finish, so contrast is measured on the settled page.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  expect(cspErrors).toEqual([]);
});
