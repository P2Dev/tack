import { chromium } from '@playwright/test';
import fs from 'node:fs';

// Read-only visual comparison using the original local board. Auth credentials
// come from the environment and are never written to the evidence files.
const out = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ baseURL: 'http://localhost:3105', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill(process.env.TACK_ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.TACK_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Open the board' }).click();
  await page.waitForURL('http://localhost:3105/');
  const snapshot = await (await page.request.get('/api/issues')).json();
  const metrics = [];
  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    const column = page.locator('.board-column[data-active="true"]');
    metrics.push({ width, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), boardTop: (await column.boundingBox()).y, quickAddTop: (await column.locator('.quick-add').boundingBox()).y });
    await page.screenshot({ path: `${out}/board-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/board-390x844.png` });
  await page.getByLabel('Search by issue key or title').fill('TCK-1');
  await page.getByRole('navigation', { name: 'Board columns' }).getByRole('button', { name: /^Ready/ }).click();
  await page.screenshot({ path: `${out}/filtered-empty-390.png` });
  await page.getByLabel('Board options', { exact: true }).click();
  await page.screenshot({ path: `${out}/options-390.png` });
  fs.writeFileSync(`${out}/comparison.json`, JSON.stringify({ source: 'Workspace production build, localhost:3105', activeCards: snapshot.active.length, archivedCards: snapshot.archived.length, cards: snapshot.active.map(({ key, title, status }) => ({ key, title, status })), metrics, errors }, null, 2));
} finally {
  await browser.close();
}
