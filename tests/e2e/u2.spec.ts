import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Issue } from "../../src/lib/types";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board" }).click();
  await expect(page).toHaveURL("/");
}
test.beforeEach(async ({ page }) => { await signIn(page); });

test("retains filters during capture and lets users inspect the hidden new card", async ({ page }, testInfo) => {
  const title = `Capture without losing my view ${testInfo.project.name}`;
  await page.goto("/?q=does-not-match-new-card&assignee=unassigned&label=label-bug");
  await page.getByRole("button", { name: /new card/i }).click();
  const input = page.getByLabel("Add a card to Backlog");
  await expect(input).toBeFocused();
  await input.fill(title);
  await input.press("Enter");
  await expect(page.locator(".capture-notice")).toContainText("Hidden by your filters");
  await expect(page).toHaveURL(/q=does-not-match-new-card&assignee=unassigned&label=label-bug/);
  await page.getByRole("button", { name: "Show card", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
  await page.getByRole("button", { name: "Close card details" }).click();
  await expect(page.getByLabel("Board options", { exact: true })).toBeFocused();
  await page.locator(".capture-notice").getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("keeps an explicitly chosen empty column under filters and permits direct capture", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  const title = `Matching focused view ${Date.now()}`;
  await page.request.post("/api/issues", { data: { title, status: "in_progress" } });
  await page.goto(`/?q=${encodeURIComponent(title)}`);
  const nav = page.getByRole("navigation", { name: "Board columns" });
  await expect(nav.getByRole("button", { name: /^In progress/ })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("button", { name: /^Done/ }).click();
  await expect(nav.getByRole("button", { name: /^Done/ })).toHaveAttribute("aria-current", "page");
  const column = page.locator('.board-column[data-status="done"]');
  await expect(column).toBeVisible();
  await expect(column.locator(".column-empty")).toBeVisible();
  await page.getByLabel("Add a card to Done").fill(`${title} completed`);
  await page.getByLabel("Add a card to Done").press("Enter");
  await expect(column.getByRole("button", { name: `${title} completed`, exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: /^Done/ })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/q=/);
});

test("discloses filters and board options with keyboard access", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?assignee=unassigned&label=label-bug");
  await expect(page.getByRole("button", { name: "Remove assignee filter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove label filter" })).toBeVisible();
  const filters = page.getByRole("button", { name: "Filters (2)", exact: true });
  await filters.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Filter by assignee")).toBeFocused();
  await page.getByRole("button", { name: "Remove label filter" }).click();
  await expect(page).not.toHaveURL(/label=/);
  const options = page.getByLabel("Board options", { exact: true });
  await options.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /^Archive/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(options).toBeFocused();
  await expect(page.getByRole("button", { name: /^Archive/ })).not.toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keeps capture and cards accessible across the responsive range with long content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The matrix includes phone viewports in the desktop run.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const titles = [
    "Make shared card links return to the right place after signing in",
    "Keep a draft when the connection drops during a save",
    "Review the invitation flow with a teammate",
  ];
  let sample!: Issue;
  for (const status of ["backlog", "ready", "in_progress", "done"] as const) {
    for (const [index, title] of titles.entries()) {
      const result = await page.request.post("/api/issues", { data: { title, status } });
      const issue = await result.json() as Issue;
      await page.request.post(`/api/issues/${issue.id}/move`, { data: { status, position: index } });
      if (status === "in_progress" && index === 0) {
        sample = issue;
        await page.request.patch(`/api/issues/${issue.id}`, { data: { description: "## Context\n\nReturn people to their shared card without losing the selected view.", labelIds: ["label-bug", "label-feature"] } });
      }
    }
  }
  await page.goto("/");
  const metrics = [];
  for (const width of [320, 390, 700, 860, 900, 1180, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
    await page.evaluate(() => scrollTo(0, 0));
    const column = page.locator(".board-column:visible").first();
    const box = await column.boundingBox();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    if (width === 1440) expect(box!.y).toBeLessThanOrEqual(250);
    await expect(column.locator(".quick-add")).toBeInViewport();
    await expect(column.locator(".issue-card").first()).toBeInViewport();
    const newCard = await page.getByRole("button", { name: /new card/i }).boundingBox();
    const brand = await page.locator(".brand-block").boundingBox();
    expect(newCard!.x).toBeGreaterThanOrEqual(brand!.x + brand!.width);
    metrics.push({ width, columnTop: box!.y, quickAddTop: (await column.locator(".quick-add").boundingBox())!.y });
    await page.screenshot({ path: testInfo.outputPath(`board-${width}.png`) });
  }
  await testInfo.attach("layout-metrics", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?issue=${sample.key}`);
  await expect(page.getByRole("dialog", { name: "Card details" })).toBeVisible();
  const titleBox = await page.getByLabel("Title", { exact: true }).boundingBox();
  const descriptionBox = await page.getByLabel("Description").boundingBox();
  const statusBox = await page.getByLabel("Status", { exact: true }).boundingBox();
  expect(titleBox!.y).toBeLessThan(descriptionBox!.y);
  expect(descriptionBox!.y).toBeLessThan(statusBox!.y);
  await page.screenshot({ path: testInfo.outputPath("editor-390.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Text-only enlargement, independent of the pixel-based type scale.
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>(".app-shell *")];
    const sizes = elements.map((element) => parseFloat(getComputedStyle(element).fontSize));
    elements.forEach((element, index) => { element.style.fontSize = `${sizes[index] * 2}px`; });
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole("button", { name: /new card/i })).toBeVisible();
  for (const button of await page.locator(".mobile-status-nav button").all()) {
    expect(await button.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("text-200-percent.png") });
  await page.getByRole("button", { name: /new card/i }).click();
  await expect(page.getByLabel("Add a card to Backlog")).toBeFocused();
  await page.getByLabel("Add a card to Backlog").fill("Capture with enlarged text");
  await page.getByLabel("Add a card to Backlog").press("Enter");
  await expect(page.locator(".toast")).toContainText("added to Backlog");
});
