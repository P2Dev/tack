import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ baseURL: 'http://localhost:3105', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill(process.env.TACK_ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.TACK_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Open the board' }).click();
  await page.waitForURL('http://localhost:3105/');
  const snapshot = await (await page.request.get('/api/issues')).json();
  const cards = snapshot.active.map(({ key, title, status }) => ({ key, title, status }));
  const previous = JSON.parse(fs.readFileSync(new URL('../u2/comparison.json', import.meta.url)));
  const checks = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.screenshot({ path: `${out}/production-board-${width}.png` });
    checks.push({ page: 'board', width, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) });
  }
  await page.goto('/team');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: `${out}/production-team-320.png`, fullPage: true });
  checks.push({ page: 'team', width: 320, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) });
  fs.writeFileSync(`${out}/production-check.json`, JSON.stringify({ source: 'Local production build at localhost:3105', activeCards: cards.length, archivedCards: snapshot.archived.length, originalCardsUnchanged: JSON.stringify(cards) === JSON.stringify(previous.cards), checks, errors }, null, 2));
} finally {
  await browser.close();
}
