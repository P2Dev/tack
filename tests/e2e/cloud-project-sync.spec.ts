import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
async function login(page: Page, email = "admin@example.com", password = "admin-password-123") {
  // Establish the fixture session through the real auth handler; the integration
  // UI test should not depend on development-server hydration timing at sign-in.
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { Origin: new URL(test.info().project.use.baseURL!).origin },
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/");
  await expect(page).toHaveURL("/");
}
test("admin provisions a dedicated Cloud key and Next routes create/replay/archive safely", async ({ page }) => {
  await login(page);
  await page.goto("/settings/api-keys?board=TCK");
  await page.getByRole("button", { name: "Create API key", exact: true }).click();
  await page.getByLabel("Agent or key name").fill("Synthetic Cloud sync");
  await page.getByLabel("Cloud project sync only").check();
  await expect(page.getByLabel("Read and update cards")).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Generate key", exact: true }).click();
  const secret = await page.getByLabel("New API key", { exact: true }).inputValue();
  await page.getByRole("button", { name: "I’ve stored my key" }).click();
  await expect(page.getByText("Cloud-linked projects only", { exact: false }).first()).toBeVisible();
  expect((await page.request.get("/api/v1/me", { headers: { Authorization: `Bearer ${secret}` } })).status()).toBe(403);
  const uuid = randomUUID(); const code = "Z" + uuid.replaceAll("-", "").slice(0,8).toUpperCase();
  const project = { schemaVersion: 1, cloudProjectId: uuid, revision: 1, slug: `synthetic-${uuid}`, code, name: "Synthetic Cloud board", description: "", appUrl: null, status: "active" };
  const path = `/api/v1/integrations/cloud/projects/${uuid}`;
  const send = (body = project) => page.request.put(path, { headers: { Authorization: `Bearer ${secret}`, "Idempotency-Key": `cloud-project-${uuid}-r${body.revision}` }, data: body });
  const created = await send(); expect(created.status()).toBe(201);
  const response = await created.json(); expect(response.url).toBe(`${new URL(page.url()).origin}/?board=${code}`);
  const replay = await send(); expect(replay.status()).toBe(200); expect(replay.headers()["idempotency-replayed"]).toBe("true");
  await page.goto(response.url); await expect(page.getByRole("heading", { name: "Synthetic Cloud board", exact: true })).toBeVisible();
  await page.getByPlaceholder("Add a card…").first().fill("Preserve this history");
  await page.getByPlaceholder("Add a card…").first().press("Enter");
  await expect(page.getByText("Preserve this history", { exact: true })).toBeVisible();
  expect((await send({ ...project,revision: 2,status: "archived" })).status()).toBe(200);
  await page.reload(); await expect(page.getByText("Preserve this history", { exact: true })).toBeVisible();
});
test("member cannot request the Cloud permission through UI or session API", async ({ page, browser }) => {
  await login(page);
  const email = `synthetic-${randomUUID()}@example.test`;
  const origin = new URL(page.url()).origin;
  const created = await page.request.post("/api/auth/admin/create-user", { headers: { Origin: origin }, data: { email,password: "synthetic-password-123",name: "Synthetic member",role: "user",data: { initials: "SM",color: "blue" } } });
  expect(created.ok()).toBeTruthy();
  const context = await browser.newContext(); const member = await context.newPage();
  try {
    await login(member,email,"synthetic-password-123");
    await member.goto("/settings/api-keys?board=TCK");
    await member.getByRole("button", { name: "Create API key", exact: true }).click();
    await expect(member.getByLabel("Cloud project sync only")).toHaveCount(0);
    const denied = await member.request.post("/api/keys", { headers: { Origin: origin },data: { name: "Denied integration",scopes: ["projects:sync"],boardIds: null,days: 7 } });
    expect(denied.status()).toBe(403);
  } finally { await context.close(); }
});
