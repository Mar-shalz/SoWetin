import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The other tabs and screens render, read well and keep the strict security policy.
for (const [path, heading] of [
  ['/explore', 'Explore'],
  ['/saved', 'Saved'],
  ['/me', 'Me'],
  ['/play', "What's your chop personality?"],
] as const) {
  test(`${path} renders`, async ({ page }) => {
    const cspErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && /Content Security Policy/i.test(m.text()) && cspErrors.push(m.text()));
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    // Let the entrance motion finish, so contrast is measured on the settled page.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    expect(cspErrors).toEqual([]);
  });
}

// F29: answer a few cards, finish early, get a personality and a card to save.
test('the taste game ends on a chop personality', async ({ page }) => {
  await page.goto('/play');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: i % 2 ? 'Nah' : 'Yum' }).click();
  await page.getByRole('button', { name: 'Finish now' }).click();
  await expect(page.getByText('Your chop personality').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save my card' })).toBeVisible();
});
