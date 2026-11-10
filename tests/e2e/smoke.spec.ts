import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('S-001 shell renders in English with no serious accessibility issues', async ({ page }) => {
  const cspErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && /Content Security Policy/i.test(m.text()) && cspErrors.push(m.text()));
  const response = await page.goto('/');
  const headers = response!.headers();
  expect(headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-powered-by']).toBeUndefined();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-NG');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  // Let the entrance motion finish, so contrast is measured on the settled page.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  expect(cspErrors).toEqual([]);
});
