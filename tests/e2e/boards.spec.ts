import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Issue } from "../../src/lib/types";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Engineering board", exact: true })).toBeVisible();
}
async function manage(page: Page) {
  await page.getByLabel("Board options", { exact: true }).click();
  await page.locator(".board-options").getByRole("button", { name: "Manage boards", exact: true }).click();
}
test.beforeEach(async ({ page }) => signIn(page));

test("creates boards, transfers drafts, resolves old links, and removes an empty board", async ({ page }, info) => {
  const id = `UX${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const name = `Design work ${info.project.name}`;
  await manage(page);
  await page.locator(".board-create-disclosure > summary").click();
  await page.getByLabel("Board name", { exact: true }).fill(name);
  await page.getByLabel("Board ID", { exact: true }).fill(id);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("board-management.png") });
  await page.getByRole("button", { name: "Add board", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`board=${id}`));
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: /new card/i }).click();
  await page.getByLabel("Add a card to Backlog").fill("Cross-board research");
  await page.getByLabel("Add a card to Backlog").press("Enter");
  await page.getByRole("button", { name: "Cross-board research", exact: true }).click();
  await expect(page.locator("#issue-drawer-key")).toHaveText(`${id}-1`);
  await page.getByLabel("Title", { exact: true }).fill("Keep this final draft");
  if (await page.locator(".card-secondary-actions > summary").count()) await page.locator(".card-secondary-actions > summary").click();
  await page.getByLabel("Move to board", { exact: true }).selectOption("TCK");
  await expect(page.getByText(`Links to ${id}-1 will still work.`, { exact: false })).toBeVisible();
  await page.screenshot({ path: info.outputPath("move-board.png") });
  await page.evaluate(() => { document.documentElement.dataset.transferSentinel = "same-document"; });
  let documentRequests = 0;
  page.on("request", request => { if (request.resourceType() === "document") documentRequests++; });
  await page.getByRole("button", { name: "Move card", exact: true }).click();
  await expect(page).toHaveURL(/board=TCK&issue=TCK-\d+/);
  expect(await page.evaluate(() => document.documentElement.dataset.transferSentinel)).toBe("same-document");
  expect(documentRequests).toBe(0);
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Keep this final draft");
  const newKey = await page.locator("#issue-drawer-key").innerText();
  await page.goto(`/?board=${id}&issue=${id}-1`);
  await expect(page).toHaveURL(new RegExp(`board=TCK&issue=${newKey}`));
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Keep this final draft");
  await page.getByLabel("Close card details", { exact: true }).click();
  if (!await page.getByRole("navigation", { name: "Boards", exact: true }).isVisible()) await page.getByRole("button", { name: "Show board panel", exact: true }).click();
  await page.getByRole("navigation", { name: "Boards", exact: true }).getByRole("button", { name: `${name} ${id}`, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator(".board-intro")).toContainText("0 active cards");
  await manage(page);
  await page.getByRole("button", { name: `Remove ${id}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel removal", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(page).toHaveURL(/board=TCK/);
  await page.goto(`/?issue=${id}-1`);
  await expect(page.locator("#issue-drawer-key")).toHaveText(newKey);
  await page.getByLabel("Close card details", { exact: true }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("board-switcher-320.png") });
});

test("retains transfer choice after failure and can move archived cards out of a board", async ({ page }, info) => {
  const id = `AR${Date.now().toString(36).slice(-6).toUpperCase()}`;
  expect((await page.request.post("/api/boards", { data: { id, name: "Archive transfer" } })).status()).toBe(201);
  const issue = await (await page.request.post("/api/issues", { data: { boardId: id, title: `Archived transfer ${info.project.name}`, status: "done" } })).json() as Issue;
  await page.request.post(`/api/issues/${issue.id}/archive?board=${id}`);
  expect((await page.request.delete(`/api/boards/${id}`)).status()).toBe(409);
  await page.goto(`/?board=${id}&issue=${issue.key}`);
  if (await page.locator(".card-secondary-actions > summary").count()) await page.locator(".card-secondary-actions > summary").click();
  await page.getByLabel("Move to board", { exact: true }).selectOption("TCK");
  let failed = true;
  await page.route(`**/api/issues/${issue.id}/transfer?*`, route => failed ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.continue());
  await page.getByRole("button", { name: "Move card", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("could not be confirmed");
  await expect(page.getByLabel("Move to board", { exact: true })).toHaveValue("TCK");
  failed = false;
  await page.evaluate(() => { document.documentElement.dataset.transferSentinel = "same-document"; });
  let documentRequests = 0;
  page.on("request", request => { if (request.resourceType() === "document") documentRequests++; });
  await page.getByRole("button", { name: "Move card", exact: true }).click();
  await expect(page).toHaveURL(/board=TCK&issue=TCK-\d+/);
  expect(await page.evaluate(() => document.documentElement.dataset.transferSentinel)).toBe("same-document");
  expect(documentRequests).toBe(0);
  await expect(page.getByText("Archived · Done", { exact: true })).toBeVisible();
  expect((await page.request.delete(`/api/boards/${id}`)).status()).toBe(200);
  const data = await (await page.request.get("/api/export?format=json")).json();
  expect(data.formatVersion).toBe(2);
  expect(data.issues.find((item: Issue) => item.id === issue.id)).toMatchObject({ boardId: "TCK", previousKeys: [issue.key] });
});

test("enforces board admin boundaries and handles stale board links", async ({ page, browser }) => {
  const id = `PR${Date.now().toString(36).slice(-6).toUpperCase()}`;
  expect((await page.request.post("/api/boards", { data: { id, name: "Permissions" } })).status()).toBe(201);
  const email = `${id.toLowerCase()}@example.local`;
  const created = await page.request.post("/api/auth/admin/create-user", { headers: { Origin: new URL(page.url()).origin }, data: { email, password: "member-password-123", name: "Board member", role: "user", data: { initials: "BM", color: "blue" } } });
  expect(created.ok(), await created.text()).toBe(true);
  const context = await browser.newContext(); const member = await context.newPage();
  const base = new URL(page.url()).origin;
  expect((await member.request.get(base + "/api/boards")).status()).toBe(401);
  await member.goto(base + "/sign-in"); await member.getByLabel("Email", { exact: true }).fill(email); await member.getByLabel("Password", { exact: true }).fill("member-password-123"); await member.getByRole("button", { name: "Open the board", exact: true }).click();
  await expect(member.locator(".board-navigation-toggle")).toBeVisible();
  expect((await member.request.post(base + "/api/boards", { data: { id: "DENIED", name: "Denied" } })).status()).toBe(403);
  expect((await member.request.delete(base + `/api/boards/${id}`)).status()).toBe(403);
  await member.getByLabel("Board options", { exact: true }).click(); await expect(member.getByRole("button", { name: "Manage boards", exact: true })).toHaveCount(0);
  const card = await (await page.request.post("/api/issues", { data: { title: "Member transfer", status: "ready" } })).json() as Issue;
  expect((await member.request.post(base + `/api/issues/${card.id}/transfer`, { data: { fromBoardId: "TCK", boardId: id } })).status()).toBe(200);
  expect((await member.request.post(base + `/api/issues/${card.id}/transfer`, { data: { fromBoardId: id, boardId: "TCK" } })).status()).toBe(200);
  await page.request.delete(`/api/boards/${id}`);
  await member.goto(base + `/?board=${id}`); await expect(member.getByRole("heading", { name: "Board unavailable" })).toBeVisible();
  await context.close();
});
