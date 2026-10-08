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
async function card(page: Page, title: string) {
  return await (await page.request.post("/api/issues", { data: { title, status: "in_progress" } })).json() as Issue;
}
test.beforeEach(async ({ page }) => { await signIn(page); });

test("separates refresh failure from writes and retains actionable move recovery", async ({ page }, testInfo) => {
  const issue = await card(page, `U3 move ${testInfo.project.name}`);
  await page.goto("/");
  let failRefresh = true;
  let failMove = true;
  await page.route("**/api/issues{,?*}", route => route.request().method() === "GET" && failRefresh ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.continue());
  await page.route(`**/api/issues/${issue.id}/move{,?*}`, route => failMove ? route.fulfill({ status: 500, json: { error: "Unavailable" } }) : route.continue());
  await page.getByLabel("Search this board").fill(issue.key);
  await expect(page).toHaveURL(new RegExp(`q=${issue.key}`));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("button", { name: "Retry refresh" })).toBeVisible();
  await page.getByLabel(`Move ${issue.key}`, { exact: true }).selectOption("ready");
  await expect(page.getByRole("button", { name: "Retry action" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry refresh" })).toBeVisible();
  await expect(page.getByLabel(`Move ${issue.key}`, { exact: true })).toHaveValue("in_progress");
  await page.screenshot({ path: testInfo.outputPath("board-recovery.png") });
  failMove = false;
  await page.getByRole("button", { name: "Retry action" }).click();
  await expect(page.getByRole("button", { name: "Retry action" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry refresh" })).toBeVisible();
  failRefresh = false;
  await page.getByRole("button", { name: "Retry refresh" }).click();
  await expect(page.locator(".board-freshness")).toContainText("Checked at");
  const snapshot = await (await page.request.get("/api/issues")).json() as BoardSnapshot;
  expect(snapshot.active.find(item => item.id === issue.id)?.status).toBe("ready");
});

test("retains capture through real session expiry and sign-in in another tab", async ({ page }, testInfo) => {
  const title = `U3 retained capture ${testInfo.project.name}`;
  await page.goto("/?q=retained");
  await page.getByRole("button", { name: /new card/i }).click();
  const input = page.getByLabel("Add a card to Backlog");
  await input.fill(title);
  await page.context().clearCookies();
  await input.press("Enter");
  await expect(page.getByText("Couldn’t confirm the new card.", { exact: false })).toBeVisible();
  await expect(input).toHaveValue(title);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Sign in in another tab" }).click();
  const popup = await popupPromise;
  await popup.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await popup.getByLabel("Password", { exact: true }).fill("admin-password-123");
  await popup.getByRole("button", { name: "Open the board" }).click();
  await expect(popup).toHaveURL(/q=retained/);
  await popup.close();
  await expect(input).toHaveValue(title);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  await expect(page).toHaveURL(/q=retained/);
  await expect(page.getByRole("link", { name: "Sign in in another tab" })).toHaveCount(0);
});

test("keeps label failure feedback accurate and guards a pending removal", async ({ page }, testInfo) => {
  await page.getByLabel("Board options", { exact: true }).click();
  await page.getByRole("button", { name: "Manage labels", exact: true }).click();
  const drawer = page.getByRole("dialog");
  const name = `U3 ${testInfo.project.name === "chromium" ? "desktop" : "phone"}`;
  await page.getByLabel("Label name").fill(name);
  await page.getByLabel("Violet", { exact: true }).check();
  let fail = true;
  await page.route("**/api/labels{,?*}", route => fail ? route.fulfill({ status: 503, json: { error: "Unavailable" } }) : route.continue());
  await page.getByRole("button", { name: "Add label", exact: true }).click();
  await expect(drawer.getByRole("alert")).toContainText("Your name and color are retained");
  await expect(page.getByLabel("Label name")).toHaveValue(name);
  await expect(page.getByLabel("Violet", { exact: true })).toBeChecked();
  await expect(drawer.getByRole("alert")).not.toContainText("same name");
  fail = false;
  await page.getByRole("button", { name: "Add label", exact: true }).click();
  await expect(drawer.getByRole("status")).toHaveText(`${name} label added.`);
  await page.getByRole("button", { name: `Remove ${name} label`, exact: true }).click();
  await expect(drawer.getByText(`Remove “${name}” from the workspace and every card?`)).toBeInViewport();
  await expect(drawer.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/labels/*", async route => { await gate; await route.continue(); });
  await page.getByRole("button", { name: "Remove label", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close label manager" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeVisible();
  release();
  await expect(drawer.getByRole("status")).toHaveText(`${name} removed from the workspace and every card.`);
  await expect(page.getByLabel("Label name")).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("labels-feedback.png") });
});

test("distinguishes expired sessions from lost label permissions inside the drawer", async ({ page }) => {
  await page.getByLabel("Board options", { exact: true }).click();
  await page.getByRole("button", { name: "Manage labels", exact: true }).click();
  await page.getByLabel("Label name").fill("Retained label");
  let status = 401;
  await page.route("**/api/labels{,?*}", route => route.fulfill({ status, json: { error: status === 401 ? "Unauthorized" : "Forbidden" } }));
  await page.getByRole("button", { name: "Add label", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("link", { name: "Sign in in another tab" })).toBeInViewport();
  await expect(page.getByLabel("Label name")).toHaveValue("Retained label");
  status = 403;
  await page.getByRole("button", { name: "Add label", exact: true }).click();
  await expect(drawer.getByRole("alert")).toHaveText("Only administrators can manage labels.");
  await expect(drawer.getByRole("link", { name: "Sign in in another tab" })).toHaveCount(0);
});

test("shows Team progress and failures by the account and supports password Cancel", async ({ page }, testInfo) => {
  await page.goto("/team");
  const row = page.locator(".member-row").filter({ has: page.getByRole("heading", { name: "Maya Chen", exact: true }) });
  await expect(page.getByText("Your current account cannot be disabled or have its role changed here.")).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  await page.route("**/api/auth/admin/set-role", async route => {
    if (!fail) return route.continue();
    await gate;
    await route.fulfill({ status: 500, json: { code: "TEST_FAILURE", message: "Role change was not saved. Try again." } });
  });
  await row.getByRole("button", { name: "Make admin", exact: true }).click();
  await expect(row.getByRole("status")).toHaveText("Changing role…");
  release();
  await expect(row.getByRole("alert")).toHaveText("Role change was not saved. Try again.");
  fail = false;
  await row.getByRole("button", { name: "Make admin", exact: true }).click();
  await expect(row.getByRole("status")).toHaveText("Maya Chen is now an admin.");
  await row.getByRole("button", { name: "Make member", exact: true }).click();
  await expect(row.getByRole("status")).toHaveText("Maya Chen is now a member.");
  await row.getByRole("button", { name: "Reset password", exact: true }).click();
  await row.getByLabel("Temporary password").fill("retained-test-password");
  await page.route("**/api/auth/admin/set-user-password", route => route.fulfill({ status: 503, json: { code: "TEST_FAILURE", message: "Password change was not saved. Try again." } }));
  await row.getByRole("button", { name: "Save password", exact: true }).click();
  await expect(row.getByRole("alert")).toContainText("Password change was not saved");
  await expect(row.getByLabel("Temporary password")).toHaveValue("retained-test-password");
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("team-feedback.png") });
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row.getByLabel("Temporary password")).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Reset password", exact: true })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("retains a new account form on failure and provides session recovery at that form", async ({ page }) => {
  await page.goto("/team");
  const form = page.locator(".create-member-panel");
  await form.getByLabel("Name", { exact: true }).fill("Retained teammate");
  await form.getByLabel("Email", { exact: true }).fill("retained@example.local");
  await form.getByLabel("Temporary password").fill("temporary-test-password");
  let status = 503;
  await page.route("**/api/auth/admin/create-user", route => route.fulfill({ status, json: { code: "TEST_FAILURE", message: status === 401 ? "Session expired." : "Account was not created. Try again." } }));
  await form.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(form.getByRole("alert")).toHaveText("Account was not created. Try again.");
  await expect(form.getByLabel("Name", { exact: true })).toHaveValue("Retained teammate");
  await expect(form.getByLabel("Temporary password")).toHaveValue("temporary-test-password");
  status = 401;
  await form.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(form.getByRole("link", { name: "Sign in in another tab" })).toHaveAttribute("href", "/sign-in?returnTo=%2Fteam");
});

test("keeps restore errors reachable below a long archived note and in the archive list", async ({ page }, testInfo) => {
  const issue = await card(page, `U3 long archived note ${testInfo.project.name}`);
  await page.request.patch(`/api/issues/${issue.id}`, { data: { description: Array.from({ length: 30 }, (_, index) => `### Section ${index + 1}\n\nA useful archived decision with enough context to review later.`).join("\n\n") } });
  await page.request.post(`/api/issues/${issue.id}/archive`);
  await page.goto(`/?issue=${issue.key}&q=unmatched`);
  let fail = true;
  await page.route(`**/api/issues/${issue.id}/restore{,?*}`, route => fail ? route.fulfill({ status: 500, json: { error: "Unavailable" } }) : route.continue());
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("archive-long-recovery.png") });
  await page.keyboard.press("Escape");
  await page.getByLabel("Board options", { exact: true }).click();
  await page.getByRole("button", { name: /^Archive/ }).click();
  const item = page.locator(".archive-item").filter({ hasText: issue.title });
  await item.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Retry restore" })).toBeInViewport();
  fail = false;
  await page.getByRole("button", { name: "Retry restore", exact: true }).click();
  await page.getByRole("button", { name: "Show restored card", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(issue.title);
  await expect(page).toHaveURL(/q=unmatched/);
});
