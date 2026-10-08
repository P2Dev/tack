import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDocsServer } from "./serve-docs.mjs";
import { mkdir } from "node:fs/promises";
const server = createDocsServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir(".site/verification", { recursive: true });
try {
  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/setup/", "/agents/"]) {
      await page.goto(base + route);
      await expect(page.locator("h1")).toHaveCount(1);
      const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll("body *")].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(element => ({tag:element.tagName,className:element.className,width:element.getBoundingClientRect().width})) }));
      if (layout.scroll > layout.width) throw new Error(JSON.stringify({route,layout}));
      const violations = (await new AxeBuilder({ page }).analyze()).violations;
      if (violations.length)
        throw new Error(
          JSON.stringify({
            width,
            route,
            violations: violations.map((item) => ({
              id: item.id,
              targets: item.nodes.map((node) => node.target),
            })),
          }),
        );
    }
    await page.goto(base + "/");
    await page.screenshot({
      path: `.site/verification/home-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", {name:"Skip to content",exact:true})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", {name:"Install Tack",exact:true})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/setup\/index.html$/);
  await page.goto(base + "/setup/");
  await page.screenshot({ path: ".site/verification/setup-desktop.png" });
  await page.locator(".search summary").click();
  await page.getByLabel("Search documentation").fill("API keys");
  await expect(page.locator("[data-search-results]")).toContainText(
    "API keys and MCP",
  );
  await page
    .locator("[data-search-results]")
    .getByRole("link", { name: "API keys and MCP", exact: true })
    .click();
  await expect(page).toHaveURL(/\/agents\/index.html$/);
  await page.screenshot({
    path: ".site/verification/agents-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto(base + "/setup/");
  await expect(page.locator(".doc-navigation")).not.toHaveAttribute("open");
  await page.locator(".doc-navigation summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".doc-navigation")).toHaveAttribute("open", "");
  await page
    .locator(".doc-navigation")
    .getByRole("link", { name: "Boards and keys", exact: true })
    .click();
  await expect(page).toHaveURL(/\/boards\/index.html$/);
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.screenshot({
    path: ".site/verification/forced-colors-320.png",
    fullPage: true,
  });
  await page.emulateMedia({ forcedColors: "none" });
  await page.setViewportSize({ width: 640, height: 1000 });
  await page.goto(base + "/setup/");
  await page.addStyleTag({
    content:
      "html { font-size: 200% } body { font-size: 2rem } .prose p, .prose li {font-size:1rem}",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "Project site passed 12 route/width axe checks, search/navigation, keyboard menu, enlarged-text reflow, and page-error checks.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
