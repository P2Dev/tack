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
async function manager(page: Page) {
  await page.getByLabel("Board options", { exact: true }).click();
  await page.locator(".board-options").getByRole("button", { name: "Manage boards", exact: true }).click();
}
test.beforeEach(async ({ page }) => signIn(page));

test("capture survives Team, reload, and sign-out and clears after explicit discard", async ({ page }) => {
  await page.getByRole("button", { name: /new card/i }).click();
  await page.getByLabel("Add a card to Backlog").fill("Unsent audit capture");
  await page.getByLabel("Board options", { exact: true }).click();
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Export workspace", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to board", exact: true }).click();
  await expect(page.getByLabel("Add a card to Backlog")).toHaveValue("Unsent audit capture");
  await page.reload();
  await expect(page.getByLabel("Add a card to Backlog")).toHaveValue("Unsent audit capture");
  await page.getByLabel("Board options", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open the board", exact: true })).toBeVisible();
  await signIn(page);
  await expect(page.getByLabel("Add a card to Backlog")).toHaveValue("Unsent audit capture");
  await page.getByRole("button", { name: "Discard draft", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Add a card to Backlog")).toHaveValue("");
});

test("Back saves before closing, retains failed drafts, and Forward reopens with filters", async ({ page }) => {
  const issue = await (await page.request.post("/api/issues", { data: { title: "History audit", status: "backlog" } })).json() as Issue;
  await page.goto("/?board=TCK&q=History");
  await page.getByRole("button", { name: "History audit", exact: true }).click();
  await expect(page.getByText("Changes save automatically", { exact: true })).toBeVisible();
  let fail = true;
  await page.route(`**/api/issues/${issue.id}?*`, route => route.request().method() === "PATCH" && fail ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.continue());
  await page.getByLabel("Title", { exact: true }).fill("History retained draft");
  await page.evaluate(() => history.back());
  await expect(page.getByRole("dialog", { name: "Card details", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("alert").first()).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("History retained draft");
  await expect(page).toHaveURL(new RegExp(`issue=${issue.key}`));
  fail = false;
  await page.evaluate(() => history.back());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/board=TCK&q=History$/);
  const saved = await (await page.request.get("/api/issues?board=TCK")).json();
  expect(saved.active.find((item: Issue) => item.id === issue.id).title).toBe("History retained draft");
  await page.evaluate(() => history.forward());
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("History retained draft");
  await page.getByLabel("Close card details", { exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Search this board")).toHaveValue("History");
  // A direct card URL has no owned history entry: Close returns to that board.
  await page.goto(`/?board=TCK&issue=${issue.key}`);
  await page.getByLabel("Close card details", { exact: true }).click();
  await expect(page).toHaveURL(/board=TCK$/);
});

test("search opens moved and archived keys, management explains removal and restores focus", async ({ page }, info) => {
  const id = `AU${Date.now().toString(36).slice(-6).toUpperCase()}`;
  await page.request.post("/api/boards", { data: { id, name: "Audit board" } });
  const issue = await (await page.request.post("/api/issues", { data: { boardId: id, title: "Audit archived card", status: "ready" } })).json() as Issue;
  await page.request.post(`/api/issues/${issue.id}/transfer?board=${id}`, { data: { boardId: "TCK", fromBoardId: id } });
  await page.request.post(`/api/issues/${issue.id}/archive?board=TCK`);
  await page.reload();
  await page.getByLabel("Search this board").fill(issue.key);
  await page.getByRole("button", { name: `Open ${issue.key} across all boards and archives`, exact: true }).click();
  await expect(page.getByText("Archived · Ready", { exact: true })).toBeVisible();
  await page.getByLabel("Close archived card", { exact: true }).click();
  await manager(page);
  await expect(page.getByRole("button", { name: "Remove TCK", exact: true })).toBeDisabled();
  await expect(page.locator(".board-list-row").filter({ has: page.getByRole("button", { name: "Remove TCK", exact: true }) })).toContainText(/\d+ active · \d+ archived/);
  await expect(page.getByLabel("Board ID", { exact: true })).not.toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("audit-manager.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Board options", { exact: true })).toBeFocused();
  await manager(page);
  await page.getByRole("button", { name: "View TCK archive", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Archive", exact: true })).toBeVisible();
  await page.request.delete(`/api/boards/${id}`);
});

test("narrow boards start on populated columns and remember an explicit empty column", async ({ page }) => {
  const id = `MO${Date.now().toString(36).slice(-6).toUpperCase()}`;
  await page.request.post("/api/boards", { data: { id, name: "Column choice" } });
  await page.request.post("/api/issues", { data: { boardId: id, title: "Only ready card", status: "ready" } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?board=${id}`);
  await expect(page.locator('.board-column[data-status="ready"]')).toBeVisible();
  await page.getByRole("navigation", { name: "Board columns", exact: true }).getByRole("button", { name: /Done/ }).click();
  await page.getByLabel("Search this board").fill("Only ready");
  await expect(page.locator('.board-column[data-status="done"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('.board-column[data-status="done"]')).toBeVisible();
});

test("board to board to card Back steps return in order", async ({ page, isMobile }) => {
  const id = `HI${Date.now().toString(36).slice(-6).toUpperCase()}`;
  await page.request.post("/api/boards", { data: { id, name: "History origin" } });
  const issue = await (await page.request.post("/api/issues", { data: { title: "Ordered history", status: "backlog" } })).json() as Issue;
  await page.goto(`/?board=${id}`);
  if (isMobile) await page.locator(".board-navigation-toggle").click();
  await expect(page.getByRole("navigation", { name: "Boards", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Boards", exact: true }).getByRole("button", { name: "Engineering board TCK", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Engineering board", exact: true })).toBeVisible();
  await page.getByLabel("Search this board").fill(issue.key);
  await page.getByRole("button", { name: "Ordered history", exact: true }).click();
  await page.evaluate(() => history.back());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Engineering board", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "History origin", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Engineering board", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => history.forward());
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Ordered history");
});
