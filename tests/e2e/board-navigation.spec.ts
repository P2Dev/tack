import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Engineering board", exact: true })).toBeVisible();
});

test("collapses board navigation, preserves drafts across boards, and supports keyboard dismissal", async ({ page, isMobile }, info) => {
  const id = `NV${Date.now().toString(36).slice(-6).toUpperCase()}`;
  expect((await page.request.post("/api/boards", { data: { id, name: "Product planning" } })).status()).toBe(201);
  await page.reload();
  const toggle = page.locator(".board-navigation-toggle");
  const nav = page.getByRole("navigation", { name: "Boards", exact: true });
  if (isMobile) {
    await expect(nav).toHaveCount(0);
    await toggle.click();
    await expect(page.getByRole("dialog", { name: "Boards", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Boards", exact: true }).getByRole("button", { name: "Hide board panel", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("dialog", { name: "Boards", exact: true }).getByRole("button", { name: "Manage boards", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("dialog", { name: "Boards", exact: true }).getByRole("button", { name: "Hide board panel", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(nav).toHaveCount(0);
  } else {
    await expect(nav).toBeVisible();
    await expect(page.getByRole("button", { name: "Hide board panel", exact: true })).toHaveCount(1);
    const expanded = await page.locator(".board-main").boundingBox();
    await toggle.click();
    await expect(nav).toHaveCount(0);
    const collapsed = await page.locator(".board-main").boundingBox();
    expect(collapsed!.width).toBeGreaterThan(expanded!.width);
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
  await page.getByRole("button", { name: /new card/i }).click();
  await page.getByLabel("Add a card to Backlog").fill("Keep my capture draft");
  await toggle.click();
  await expect(nav.getByRole("button", { name: "Engineering board TCK", exact: true })).toHaveAttribute("aria-current", "page");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("board-panel.png"), fullPage: true });
  // A client-side transition must retain this document, including on Back.
  await page.evaluate(() => { document.documentElement.dataset.navigationSentinel = "same-document"; });
  let documentRequests = 0;
  page.on("request", request => { if (request.resourceType() === "document") documentRequests++; });
  let releaseNavigation!: () => void;
  const navigationGate = new Promise<void>(resolve => { releaseNavigation = resolve; });
  await page.route(url => url.searchParams.get("board") === id && url.searchParams.has("_rsc"), async route => { await navigationGate; await route.continue(); });
  await nav.getByRole("button", { name: `Product planning ${id}`, exact: true }).click();
  await expect(nav).toHaveAttribute("aria-busy", "true");
  await expect(nav.getByRole("button", { name: `Product planning ${id}`, exact: true })).toBeDisabled();
  await expect(page.locator(".board-main")).toHaveAttribute("inert", "");
  releaseNavigation();
  await expect(page.getByRole("heading", { name: "Product planning", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.navigationSentinel)).toBe("same-document");
  await expect(page).toHaveURL(new RegExp(`board=${id}`));
  if (isMobile) await toggle.click();
  await expect(nav.getByRole("button", { name: `Product planning ${id}`, exact: true })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("button", { name: "Engineering board TCK", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Engineering board", exact: true })).toBeVisible();
  await expect(page.getByLabel("Add a card to Backlog")).toHaveValue("Keep my capture draft");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Product planning", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Engineering board", exact: true })).toBeVisible();
  expect(documentRequests).toBe(0);
  expect((await page.request.delete(`/api/boards/${id}`)).status()).toBe(200);
});
