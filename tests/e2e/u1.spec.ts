import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { BoardSnapshot, Issue } from "../../src/lib/types";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board" }).click();
  await expect(page).toHaveURL("/");
}
async function createCard(page: Page, title: string) {
  const response = await page.request.post("/api/issues", { data: { title, status: "in_progress" } });
  expect(response.status()).toBe(201);
  return await response.json() as Issue;
}
async function openCard(page: Page, issue: Issue) {
  await page.goto(`/?issue=${issue.key}`);
  await expect(page.getByRole("dialog", { name: "Card details" })).toBeVisible();
}
async function persisted(page: Page, id: string) {
  const snapshot = await (await page.request.get("/api/issues")).json() as BoardSnapshot;
  return [...snapshot.active, ...snapshot.archived].find((issue) => issue.id === id);
}

test.beforeEach(async ({ page }) => { await signIn(page); });

test("contains keyboard focus, blocks background switching, and flushes before archive", async ({ page }) => {
  const issue = await createCard(page, "U1 immediate archive");
  await createCard(page, "U1 background card");
  await openCard(page, issue);
  const drawer = page.getByRole("dialog");
  await page.getByRole("button", { name: "Close card details" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("button", { name: "Archive", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close card details" })).toBeFocused();
  expect(await page.locator("dialog").evaluate((el) => el.matches(":modal"))).toBe(true);
  await page.getByLabel("Title", { exact: true }).fill("U1 latest title before archive");
  await drawer.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  expect(await persisted(page, issue.id)).toMatchObject({ title: "U1 latest title before archive", archivedAt: expect.any(String) });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const restoredCard = page.locator(`[data-issue-trigger="${issue.id}"]`);
  await expect(restoredCard).toBeVisible();
  await expect(restoredCard).toHaveText("U1 latest title before archive");
  expect((await persisted(page, issue.id))?.archivedAt).toBeNull();
});

test("drains edits typed during a delayed save before allowing close", async ({ page }) => {
  const issue = await createCard(page, "U1 slow save");
  await openCard(page, issue);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  let active = 0;
  let maxActive = 0;
  await page.route(`**/api/issues/${issue.id}{,?*}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    active += 1;
    maxActive = Math.max(maxActive, active);
    requests += 1;
    if (requests === 1) await gate;
    const response = await route.fetch();
    active -= 1;
    await route.fulfill({ response });
  });
  await page.getByLabel("Title", { exact: true }).fill("U1 first draft");
  await expect.poll(() => requests).toBe(1);
  await page.getByLabel("Title", { exact: true }).fill("U1 final draft");
  await page.getByRole("button", { name: "Close card details" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".save-state")).toHaveText("Saving…");
  release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(requests).toBe(2);
  expect(maxActive).toBe(1);
  expect(await persisted(page, issue.id)).toMatchObject({ title: "U1 final draft" });
});

test("keeps failed drafts distinct from copying and supports retry and discard", async ({ page }, testInfo) => {
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { } } }));
  const issue = await createCard(page, "U1 recovery original");
  await openCard(page, issue);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { } } }));
  let fail = true;
  await page.route(`**/api/issues/${issue.id}{,?*}`, (route) => fail && route.request().method() === "PATCH"
    ? route.fulfill({ status: 500, json: { error: "Test save failure" } }) : route.continue());
  await page.getByLabel("Title", { exact: true }).fill("U1 recovered title");
  await expect(page.getByRole("button", { name: "Retry save" })).toBeVisible();
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByText("Link copied", { exact: true })).toBeInViewport();
  await expect(page.locator(".save-state")).toHaveText("Not saved");
  await page.screenshot({ path: testInfo.outputPath("save-recovery.png"), caret: "initial" });
  await page.getByRole("button", { name: "Close card details" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.locator(".save-state")).toHaveText("Saved");
  expect(await persisted(page, issue.id)).toMatchObject({ title: "U1 recovered title" });
  await page.getByLabel("Title", { exact: true }).fill("");
  await page.getByRole("button", { name: "Close card details" }).click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("U1 recovered title");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("retains a draft through reload and reauthentication in the same tab", async ({ page }) => {
  const issue = await createCard(page, "U1 session recovery");
  await openCard(page, issue);
  page.on("dialog", (dialog) => dialog.accept());
  await page.context().clearCookies();
  await page.getByLabel("Description").fill("A draft that survives signing in again.");
  await expect(page.getByRole("button", { name: "Sign in again", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign in again", exact: true }).click();
  await expect(page).toHaveURL(/sign-in\?returnTo=/);
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board" }).click();
  await expect(page.getByLabel("Description")).toHaveValue("A draft that survives signing in again.");
  await expect(page.getByRole("button", { name: "Save recovered changes" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Description")).toHaveValue("A draft that survives signing in again.");
  await page.getByRole("button", { name: "Save recovered changes" }).click();
  await expect(page.locator(".save-state")).toHaveText("Saved");
  expect(await persisted(page, issue.id)).toMatchObject({ description: "A draft that survives signing in again." });
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("tack:draft:")))).toEqual([]);
});

test("returns shared active and archived destinations through sign-in and handles missing cards", async ({ page }) => {
  const issue = await createCard(page, "U1 shared destination");
  await page.context().clearCookies();
  const activeDestination = `/?issue=${issue.key}&q=shared&assignee=unassigned`;
  await page.goto(activeDestination);
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board" }).click();
  await expect(page).toHaveURL(activeDestination);
  await expect(page.getByRole("dialog", { name: "Card details" })).toBeVisible();
  await page.request.post(`/api/issues/${issue.id}/archive`);
  await page.context().clearCookies();
  const destination = `/?issue=${issue.key}&q=shared&label=label-bug`;
  await page.goto(destination);
  await expect(page).toHaveURL(/sign-in\?returnTo=/);
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board" }).click();
  await expect(page).toHaveURL(destination);
  await expect(page.getByRole("dialog", { name: issue.title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Search this board")).toHaveValue("shared");
  await page.goto("/?issue=TCK-999999&q=retained");
  await expect(page.getByRole("dialog", { name: "Card unavailable" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Return to board", exact: true }).last().click();
  await expect(page).toHaveURL(/q=retained/);
  await expect(page).not.toHaveURL(/issue=/);
});

test("returns to the archive with focus and retains failed restore context", async ({ page }, testInfo) => {
  const issue = await createCard(page, "U1 archived keyboard card");
  await page.request.post(`/api/issues/${issue.id}/archive`);
  await page.goto("/");
  await page.getByLabel("Board options", { exact: true }).click();
  await page.getByRole("button", { name: /^Archive/ }).click();
  await page.locator(`[data-archive-trigger="${issue.id}"]`).click();
  await expect(page.getByRole("button", { name: "Back to archive", exact: true }).first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Archive", exact: true })).toBeVisible();
  await expect(page.locator(`[data-archive-trigger="${issue.id}"]`)).toBeFocused();
  await page.locator(`[data-archive-trigger="${issue.id}"]`).click();
  let fail = true;
  await page.route(`**/api/issues/${issue.id}/restore{,?*}`, (route) => fail ? route.fulfill({ status: 500, json: { error: "Test restore failure" } }) : route.continue());
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Restore failed");
  await page.screenshot({ path: testInfo.outputPath("archive-recovery.png"), caret: "initial" });
  fail = false;
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Card details" })).toBeVisible();
  expect((await persisted(page, issue.id))?.archivedAt).toBeNull();
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
});

test("offers selectable URLs when the clipboard is unavailable", async ({ page }) => {
  const issue = await createCard(page, "U1 clipboard fallback");
  await openCard(page, issue);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } }));
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByLabel("Card link", { exact: true })).toHaveValue(new RegExp(`issue=${issue.key}`));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Copy view", exact: true }).click();
  await expect(page.getByLabel("Copy this view link", { exact: true })).toHaveValue(/\/$/);
});

test("a queued failed move cannot roll back another card's successful move", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Mutation ordering is viewport-independent.");
  const first = await createCard(page, "U1 successful queued move");
  const second = await createCard(page, "U1 failed queued move");
  await page.goto("/");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let active = 0;
  let maxActive = 0;
  let requests = 0;
  await page.route("**/api/issues/*/move{,?*}", async (route) => {
    requests += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (route.request().url().includes(first.id)) {
      expect(route.request().postDataJSON().status).toBe("ready");
      await gate;
      const response = await route.fetch();
      active -= 1;
      await route.fulfill({ response });
    } else {
      active -= 1;
      await route.fulfill({ status: 500, json: { error: "Test move failure" } });
    }
  });
  await page.getByLabel(`Move ${first.key}`, { exact: true }).selectOption("ready");
  await expect.poll(() => requests).toBe(1);
  await page.getByLabel(`Move ${second.key}`, { exact: true }).selectOption("done");
  release();
  await expect(page.locator(".board-recovery")).toContainText("Move failed");
  await expect(page.getByLabel(`Move ${first.key}`, { exact: true })).toHaveValue("ready");
  await expect(page.getByLabel(`Move ${second.key}`, { exact: true })).toHaveValue("in_progress");
  expect(maxActive).toBe(1);
  expect(await persisted(page, first.id)).toMatchObject({ status: "ready" });
  expect(await persisted(page, second.id)).toMatchObject({ status: "in_progress" });
});

test("waits for hydration before accepting a card status selection", async ({ page }) => {
  const issue = await createCard(page, "U1 hydration-safe status");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let blockedChunks = 0;
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith(".js")) {
      blockedChunks += 1;
      await gate;
    }
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    const status = page.getByLabel(`Move ${issue.key}`, { exact: true });
    await expect.poll(() => blockedChunks).toBeGreaterThan(0);
    await expect(status).toBeDisabled();
    release();
    await expect(status).toBeEnabled();
    await status.selectOption("ready");
    await expect.poll(async () => (await persisted(page, issue.id))?.status).toBe("ready");
  } finally {
    release();
  }
});

test("keeps move feedback and Undo operable inside the modal editor", async ({ page }) => {
  const issue = await createCard(page, "U1 editor movement");
  await openCard(page, issue);
  let fail = true;
  await page.route(`**/api/issues/${issue.id}/move{,?*}`, (route) => fail
    ? route.fulfill({ status: 500, json: { error: "Test move failure" } }) : route.continue());
  await page.getByLabel("Status", { exact: true }).selectOption("ready");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Move failed");
  await expect(page.getByRole("dialog").getByRole("alert")).toBeInViewport();
  await expect(page.locator(".save-state")).toHaveText("Action failed");
  fail = false;
  await page.getByLabel("Status", { exact: true }).selectOption("ready");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("ready");
  await page.getByRole("dialog").getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("in_progress");
});
