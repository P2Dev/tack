/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS artifact verifier. */
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const out = path.join(__dirname, 'verification');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], remoteRequests = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  await page.goto('file://' + path.join(__dirname, 'tack-overview.html'));
  await page.locator('.image-button img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  assert.equal(await page.locator('.page').count(), 9);
  assert.equal(await page.locator('.image-button img').count(), 9);
  await page.locator('#mode').click();
  for (let i = 1; i <= 9; i++) {
    await page.locator(`#page-${i}.active`).waitFor({ state: 'visible' });
    const box = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight }));
    assert.equal(box.scrollWidth, box.width, `Desktop overflow on section ${i}`);
    checks.push({ section: i, ...box });
    await page.screenshot({ path: path.join(out, `section-${i}.png`), fullPage: true });
    if (i < 9) await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Home');
  await page.locator('#page-1 .image-button').click();
  assert(await page.locator('#zoom').evaluate(element => element.open));
  await page.locator('#zoom-size').click();
  assert.equal(await page.locator('#zoom-size').innerText(), 'Fit image');
  await page.keyboard.press('Escape');
  assert(await page.locator('#page-1 .image-button').evaluate(element => element === document.activeElement));
  await page.keyboard.press('End');
  assert.equal(await page.locator('#counter').innerText(), '9 / 9');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#counter').innerText(), '8 / 9');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.page:visible').count(), 9);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.equal(size.width, size.scrollWidth, `Reading overflow at ${width}`);
    await page.locator('#mode').click();
    await page.keyboard.press('Home');
    for (let i = 1; i <= 9; i++) {
      const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.equal(size.width, size.scrollWidth, `Presentation overflow at ${width}, section ${i}`);
      if (width === 390 && [1, 3, 8].includes(i)) await page.screenshot({ path: path.join(out, `phone-section-${i}.png`), fullPage: true });
      if (i < 9) await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('Escape');
    checks.push({ viewport: width, readingOverflow: false, presentationOverflow: false });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteRequests, []);
  const result = { artifact: 'tack-overview.html', sections: 9, images: 9, checks, keyboardNavigation: 'passed', imageZoomAndFocusReturn: 'passed', pageErrors: errors, remoteRequests, applicationTestsRerun: false };
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
