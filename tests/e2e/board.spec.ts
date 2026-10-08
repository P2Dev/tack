import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("admin-password-123");
  await page.getByRole("button", { name: "Open the board" }).click();
  await expect(page).toHaveURL("/");
}

function collectObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectObjectKeys);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) => [
      key,
      ...collectObjectKeys(nestedValue),
    ]);
  }
  return [];
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("captures, edits, moves, archives, and restores a card", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const title = `Make quick capture obvious ${suffix}`;
  const updatedTitle = `Keep quick capture obvious ${suffix}`;

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Engineering board" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /new card/i }).click();
  const quickAdd = page.getByLabel("Add a card to Backlog");
  await quickAdd.fill(title);
  await quickAdd.press("Enter");

  const cardTitle = page.getByRole("button", { name: title });
  await expect(cardTitle).toBeVisible();
  await cardTitle.click();

  await expect(
    page.getByRole("dialog", { name: "Card details" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/issue=TCK-\d+/);

  await page.getByLabel("Title", { exact: true }).fill(updatedTitle);
  await page
    .getByLabel("Description")
    .fill("One field to start. Add context only when it helps.");
  await page.getByLabel("Assignee · optional").selectOption({
    label: "Maya Chen",
  });
  await page.getByLabel("Feature").check();
  await page.getByLabel("Status", { exact: true }).selectOption("in_progress");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Close card details" }).click();
  await expect(page).not.toHaveURL(/issue=/);
  await expect(
    page.getByRole("button", { name: updatedTitle }),
  ).toBeVisible();

  await page.getByRole("button", { name: updatedTitle }).click();
  await page
    .getByRole("dialog", { name: "Card details" })
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("archived");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("button", { name: updatedTitle }),
  ).toBeVisible();
});

test("has no automatically detectable accessibility violations on the board", async ({
  page,
}) => {
  await page.goto("/");

  const boardResults = await new AxeBuilder({ page }).analyze();
  expect(boardResults.violations).toEqual([]);

  await page.getByLabel("Board options", { exact: true }).click();
  await page.getByRole("button", { name: "Manage labels" }).click();
  await expect(
    page.getByRole("dialog", { name: "Manage labels" }),
  ).toBeVisible();
  await page.waitForTimeout(200);
  const labelResults = await new AxeBuilder({ page }).analyze();
  expect(labelResults.violations).toEqual([]);
});

test("dismisses each board drawer with Escape and restores focus", async ({
  page,
}) => {
  await page.goto("/");

  const archiveTrigger = page.getByRole("button", { name: /^Archive/ });
  await page.getByLabel("Board options", { exact: true }).click();
  await archiveTrigger.click();
  await expect(
    page.getByRole("button", { name: "Close archive" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Archive" }),
  ).not.toBeVisible();
  await expect(archiveTrigger).toBeFocused();

  const labelTrigger = page.getByRole("button", { name: "Manage labels" });
  await labelTrigger.click();
  await expect(
    page.getByRole("button", { name: "Close label manager" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Manage labels" }),
  ).not.toBeVisible();
  await expect(labelTrigger).toBeFocused();

  const title = `Keyboard drawer ${Date.now()}`;
  const response = await page.request.post("/api/issues", {
    data: { title, status: "in_progress" },
  });
  expect(response.status()).toBe(201);
  await page.reload();

  const issueTrigger = page.getByRole("button", { name: title });
  await issueTrigger.click();
  await expect(
    page.getByRole("button", { name: "Close card details" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Card details" }),
  ).not.toBeVisible();
  await expect(issueTrigger).toBeFocused();
});

test("reflows the board and Team page at 320 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");

  const boardWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(boardWidth.document).toBe(boardWidth.viewport);

  await page.getByLabel("Board options", { exact: true }).click();
  await page.getByRole("button", { name: /^Archive/ }).click();
  const archiveDrawer = page.getByRole("dialog", { name: "Archive" });
  await expect(archiveDrawer).toBeVisible();
  await page.waitForTimeout(220);
  const drawerBox = await archiveDrawer.boundingBox();
  expect(drawerBox).not.toBeNull();
  expect(drawerBox?.x).toBeGreaterThanOrEqual(0);
  expect((drawerBox?.x ?? 0) + (drawerBox?.width ?? 0)).toBeLessThanOrEqual(
    boardWidth.viewport,
  );

  await page.goto("/team");
  const teamWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(teamWidth.document).toBe(teamWidth.viewport);

  const peopleBox = await page.locator(".team-list-panel").boundingBox();
  const sidebarBox = await page.locator(".team-sidebar").boundingBox();
  expect(peopleBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(peopleBox?.y).toBeLessThan(sidebarBox?.y ?? 0);
});

test("searches and restores shareable assignee and label filters", async ({
  page,
}) => {
  const title = `Find this quiet card ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: /new card/i }).click();
  await page.getByLabel("Add a card to Backlog").fill(title);
  await page.getByLabel("Add a card to Backlog").press("Enter");
  await page.getByRole("button", { name: title }).click();
  await page.getByLabel("Assignee · optional").selectOption({
    label: "Alex Kim",
  });
  await page.getByLabel("Bug").check();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close card details" }).click();

  await page.getByLabel("Search this board").fill(title);
  if (await page.getByRole("button", { name: /^Filters/ }).isVisible()) await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Filter by assignee").selectOption({
    label: "Alex Kim",
  });
  const alexAssigneeId = await page
    .getByLabel("Filter by assignee")
    .inputValue();
  await page.getByLabel("Filter by label").selectOption({ label: "Bug" });
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await expect(page).toHaveURL(/q=Find(\+|%20)this/);
  await expect(page).toHaveURL(
    new RegExp(`assignee=${encodeURIComponent(alexAssigneeId)}`),
  );
  await expect(page).toHaveURL(/label=label-bug/);

  await page.reload();
  await expect(page.getByRole("button", { name: title })).toBeVisible();
  await expect(page.getByLabel("Filter by assignee")).toHaveValue(
    alexAssigneeId,
  );
  await expect(page.getByLabel("Filter by label")).toHaveValue("label-bug");

  if (await page.getByRole("button", { name: /^Filters/ }).isVisible()) await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Filter by label").selectOption({
    label: "Feature",
  });
  await expect(page.getByRole("button", { name: title })).not.toBeVisible();
  await expect(
    page.locator(
      '.board-column[data-active="true"] .column-empty',
    ),
  ).toBeVisible();
});

test("two sessions converge without clobbering independent edits", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Multi-session convergence is viewport-independent.",
  );

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const title = `Shared session card ${Date.now()}`;
  const updatedTitle = `${title} updated`;
  const description = "A note saved from the second browser session.";

  await Promise.all([signIn(pageA), signIn(pageB)]);
  await pageA.getByLabel("Add a card to Backlog").fill(title);
  await pageA.getByLabel("Add a card to Backlog").press("Enter");
  await expect(pageA.getByRole("button", { name: title })).toBeVisible();

  await pageB.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(pageB.getByRole("button", { name: title })).toBeVisible();

  await pageA.getByRole("button", { name: title }).click();
  await pageB.getByRole("button", { name: title }).click();

  await pageA.getByLabel("Title", { exact: true }).fill(updatedTitle);
  await expect(pageA.getByText("Saved", { exact: true })).toBeVisible();

  await pageB.getByLabel("Description").fill(description);
  await pageB.getByLabel("Status", { exact: true }).selectOption("ready");
  await expect(pageB.getByText("Saved", { exact: true })).toBeVisible();

  await expect(pageB.getByLabel("Title", { exact: true })).toHaveValue(updatedTitle);

  const persisted = await pageA.evaluate(async (originalTitle) => {
    const snapshot = (await fetch("/api/issues").then((response) =>
      response.json(),
    )) as {
      active: Array<{
        title: string;
        description: string;
        status: string;
      }>;
    };
    return snapshot.active.find(
      (issue) =>
        issue.title === originalTitle ||
        issue.title === `${originalTitle} updated`,
    );
  }, title);

  expect(persisted).toMatchObject({
    title: updatedTitle,
    description,
    status: "ready",
  });

  await Promise.all([contextA.close(), contextB.close()]);
});

test("keeps anonymous requests out and lets admins manage team access", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Authorization behavior is viewport-independent.",
  );

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  const response = await anonymousPage.request.get("/api/issues");
  expect(response.status()).toBe(401);
  expect(
    (await anonymousPage.request.get("/api/export?format=json")).status(),
  ).toBe(401);
  await anonymousPage.goto("/");
  await expect(anonymousPage).toHaveURL(/\/sign-in$/);
  await anonymousContext.close();

  const email = `casey-${Date.now()}@example.local`;
  const exportedIssueTitle = `Export contract ${Date.now()}`;
  expect(
    (
      await page.request.post("/api/issues", {
        data: { title: exportedIssueTitle, status: "backlog" },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/team");
  await expect(
    page.getByRole("heading", { name: "Team access" }),
  ).toBeVisible();
  const jsonExport = await page.request.get("/api/export?format=json");
  expect(jsonExport.status()).toBe(200);
  expect(jsonExport.headers()["content-disposition"]).toMatch(
    /^attachment; filename="tack-export-\d{4}-\d{2}-\d{2}\.json"$/,
  );
  const exportData = (await jsonExport.json()) as {
    formatVersion: number;
    users: unknown[];
    labels: unknown[];
    issues: Array<{ title: string }>;
  };
  expect(exportData).toMatchObject({ formatVersion: 2 });
  expect(exportData.users.length).toBeGreaterThan(0);
  expect(exportData.labels.length).toBeGreaterThan(0);
  expect(exportData.issues.length).toBeGreaterThan(0);
  expect(exportData.issues).toContainEqual(
    expect.objectContaining({ title: exportedIssueTitle }),
  );
  expect(collectObjectKeys(exportData).join(" ")).not.toMatch(
    /password|session|token/i,
  );

  const csvExport = await page.request.get("/api/export?format=csv");
  expect(csvExport.status()).toBe(200);
  expect(csvExport.headers()["content-type"]).toContain("text/csv");
  expect(await csvExport.text()).toMatch(
    /^"id","key","board_id","previous_keys","number","title","description","status"/,
  );
  expect(
    (await page.request.get("/api/export?format=xml")).status(),
  ).toBe(400);

  await page.getByLabel("Name").fill("Casey Lee");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Temporary password").fill("casey-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Casey Lee can now sign in.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Casey Lee" })).toBeVisible();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/sign-in");
  await memberPage.getByLabel("Email").fill(email);
  await memberPage.getByLabel("Password").fill("casey-password-123");
  await memberPage.getByRole("button", { name: "Open the board" }).click();
  await expect(memberPage).toHaveURL("/");
  await memberPage.getByLabel("Board options", { exact: true }).click();
  await expect(memberPage.getByRole("link", { name: "Team", exact: true })).toHaveCount(0);
  await expect(memberPage.getByRole("button", { name: "Manage labels", exact: true })).toHaveCount(0);
  expect(
    (
      await memberPage.request.post("/api/labels", {
        data: { name: "Forbidden", color: "rust" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await memberPage.request.get("/api/export?format=json")).status(),
  ).toBe(403);
  await memberPage.goto("/team");
  await expect(memberPage).toHaveURL("/");
  await memberContext.close();

  const caseyRow = page.locator(".member-row").filter({ hasText: email });
  await caseyRow.getByRole("button", { name: "Disable" }).click();
  await expect(page.getByText("Casey Lee was disabled.")).toBeVisible();
  await expect(caseyRow.getByText("Disabled", { exact: true })).toBeVisible();
});

test("moves a card between columns with pointer drag", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "Touch-sized status movement is covered by the mobile core-flow test.",
  );

  const title = `Pointer move ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: /new card/i }).click();
  const quickAdd = page.getByLabel("Add a card to Backlog");
  await quickAdd.fill(title);
  await quickAdd.press("Enter");

  const card = page.locator(".issue-card").filter({ hasText: title });
  // Capture now stays above the list. Put this fixture first so both drag
  // endpoints are in the viewport, without relying on capture scrolling.
  const issueId = await card.locator("[data-issue-trigger]").getAttribute("data-issue-trigger");
  await page.request.post(`/api/issues/${issueId}/move`, { data: { status: "backlog", position: 0 } });
  await page.reload();
  const dragHandle = card.locator(".drag-handle");
  const target = page.locator('section[data-status="ready"] .quick-add');
  const dragBox = await dragHandle.boundingBox();
  const targetBox = await target.boundingBox();

  expect(dragBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!dragBox || !targetBox) {
    return;
  }

  await page.mouse.move(
    dragBox.x + dragBox.width / 2,
    dragBox.y + dragBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + 8,
    { steps: 12 },
  );
  const moveResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/move") && response.request().method() === "POST",
  );
  await page.mouse.up();
  await moveResponse;

  await expect(card.getByRole("combobox")).toHaveValue("ready");
});
