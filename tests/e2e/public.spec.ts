import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// S-021: every trust line can link to its section, the page reads well, and the strict policy holds.
test('where this comes from has one section per kind of content', async ({ page }) => {
  const cspErrors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && /Content Security Policy/i.test(m.text()) && cspErrors.push(m.text()));
  await page.goto('/legal/sources');
  await expect(page.getByRole('heading', { level: 1, name: 'Where this comes from' })).toBeVisible();
  for (const id of ['prices', 'recipes', 'videos', 'ai', 'allergies', 'partners']) await expect(page.locator(`section#${id}`)).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  expect(cspErrors).toEqual([]);
});

// S-011: a dish that isn't published (or doesn't exist) is not found for the public; crawlers stay out of the admin.
test('unpublished dishes are not public, and robots keep out of the admin', async ({ page, request }) => {
  expect((await page.goto('/dish/egusi-soup'))?.status()).toBe(404);
  expect((await page.goto('/dish/Not%20a%20dish'))?.status()).toBe(404);
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toContain('Disallow: /api/');
});

// S-022: a shared link that names no real plate is a plain 404, never a broken card.
test('a shared plate link for an unknown plate is not found', async ({ page }) => {
  const res = await page.goto('/p/2/not-a-plate');
  expect(res?.status()).toBe(404);
  const bad = await page.goto('/p/99/soup_swallow%3Asoup%3Degusi-soup');
  expect(bad?.status()).toBe(404);
});
