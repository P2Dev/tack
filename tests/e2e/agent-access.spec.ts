import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, test, type Page } from "@playwright/test";
async function login(
  page: Page,
  email = "admin@example.com",
  password = "admin-password-123",
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Open the board", exact: true })
    .click();
  await expect(page).toHaveURL("/");
}
async function createKey(
  page: Page,
  scopes = ["read"],
  boardIds: string[] | null = ["TCK"],
) {
  const response = await page.request.post("/api/keys", {
    headers: { Origin: new URL(page.url()).origin },
    data: { name: "Integration agent", scopes, boardIds, days: 7 },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string; secret: string };
}
test("members manage their own keys with one-time secrets and accessible recovery", async ({
  page,
  browser,
}, testInfo) => {
  await login(page);
  const origin = new URL(page.url()).origin;
  const email = `key-owner-${randomUUID()}@example.test`;
  const created = await page.request.post("/api/auth/admin/create-user", {
    headers: { Origin: origin },
    data: {
      email,
      password: "member-password-123",
      name: "Agent owner",
      role: "user",
      data: { initials: "AO", color: "blue" },
    },
  });
  expect(created.ok()).toBeTruthy();
  const context = await browser.newContext();
  const member = await context.newPage();
  await login(member, email, "member-password-123");
  if (testInfo.project.name.includes("mobile"))
    await member.setViewportSize({ width: 320, height: 780 });
  await member.goto("/settings/api-keys?board=TCK");
  await expect(
    member.getByRole("heading", { name: "API keys", exact: true }),
  ).toBeVisible();
  await expect(member.getByLabel("Show all users’ keys")).toHaveCount(0);
  await member
    .getByRole("button", { name: "Create API key", exact: true })
    .click();
  await member.getByLabel("Agent or key name").fill("My local agent");
  expect((await new AxeBuilder({ page: member }).analyze()).violations).toEqual(
    [],
  );
  await member
    .getByRole("button", { name: "Generate key", exact: true })
    .click();
  await expect(member.getByLabel("New API key", { exact: true })).toBeVisible();
  const secret = await member
    .getByLabel("New API key", { exact: true })
    .inputValue();
  expect(secret.startsWith("tack_")).toBeTruthy();
  const listing = await (await member.request.get("/api/keys")).json();
  expect(JSON.stringify(listing).includes(secret)).toBeFalsy();
  expect(listing.keys[0].scopes).toEqual(["read"]);
  await member.getByRole("button", { name: "I’ve stored my key" }).click();
  await expect(member.getByLabel("New API key", { exact: true })).toHaveCount(
    0,
  );
  await member
    .getByRole("button", { name: "Rename My local agent", exact: true })
    .click();
  await member.getByLabel("Key name", { exact: true }).fill("Renamed agent");
  await member.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    member.getByRole("heading", { name: "Renamed agent", exact: true }),
  ).toBeVisible();
  expect(
    (
      await member.request.get("/api/v1/me", {
        headers: { Authorization: `Bearer ${secret}` },
      })
    ).status(),
  ).toBe(200);
  expect((await member.request.get("/api/keys?all=1")).status()).toBe(403);
  const adminKey = await createKey(page);
  expect(
    (
      await member.request.delete(`/api/keys/${adminKey.id}`, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(404);
  await member
    .getByRole("button", { name: "Refresh keys", exact: true })
    .click();
  await expect(member.locator(".key-dates")).not.toContainText("Never");
  expect((await new AxeBuilder({ page: member }).analyze()).violations).toEqual(
    [],
  );
  expect(
    await member.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await member.screenshot({
    path: `docs/agent-access/evidence/keys-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await member
    .getByRole("button", { name: "Revoke Renamed agent", exact: true })
    .click();
  await expect(
    member.getByRole("button", { name: "Cancel revocation", exact: true }),
  ).toBeFocused();
  await member
    .getByRole("button", { name: "Confirm revocation", exact: true })
    .click();
  await expect(member.getByText("Revoked", { exact: true })).toBeVisible();
  expect(
    (
      await member.request.get("/api/v1/me", {
        headers: { Authorization: `Bearer ${secret}` },
      })
    ).status(),
  ).toBe(401);
  await page.request.delete(`/api/keys/${adminKey.id}`, {
    headers: { Origin: origin },
  });
  const otherKey = await createKey(member);
  await page.goto("/settings/api-keys");
  await page.getByLabel("Show all users’ keys").check();
  const otherRow = page.locator(".api-key-row").filter({has:page.locator(`[id="key-${otherKey.id}"]`)});
  await expect(otherRow).toContainText("Owned by Agent owner");
  await expect(otherRow.getByRole("button",{name:/^Rename /})).toHaveCount(0);
  await otherRow.getByRole("button",{name:"Revoke Integration agent",exact:true}).click();
  await otherRow.getByRole("button",{name:"Confirm revocation",exact:true}).click();
  await expect(otherRow).toContainText("Revoked");
  expect((await member.request.get("/api/v1/me",{headers:{Authorization:`Bearer ${otherKey.secret}`}})).status()).toBe(401);
  await context.close();
});
test("API credentials stay scoped and cannot become browser sessions or issue more keys", async ({
  page,
}) => {
  await login(page);
  const origin = new URL(page.url()).origin;
  const key = await createKey(page);
  const headers = { Authorization: `Bearer ${key.secret}` };
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
  expect(
    (
      await page.request.get("/api/v1/me", {
        headers: { Authorization: "Bearer invalid" },
      })
    ).status(),
  ).toBe(401);
  expect((await page.request.get("/api/v1/boards", { headers })).status()).toBe(
    200,
  );
  expect(
    (
      await page.request.post("/api/v1/cards", {
        headers: { ...headers, "Idempotency-Key": randomUUID() },
        data: { boardId: "TCK", title: "Not permitted", status: "ready" },
      })
    ).status(),
  ).toBe(403);
  for (const path of [
    "/api/keys",
    "/api/issues",
    "/api/export",
    "/api/auth/admin/list-users",
  ]) {
    expect((await page.request.get(path, { headers })).status()).toBe(401);
  }
  expect(
    (
      await page.request.post("/api/keys", {
        headers: { Origin: "https://evil.example" },
        data: { name: "Bad", scopes: ["read"], boardIds: null },
      })
    ).status(),
  ).toBe(403);
  for (const path of ["create", "update", "delete", "list", "get"]) {
    const response = await page.request.fetch(`/api/auth/api-key/${path}`, {
      method: path === "get" || path === "list" ? "GET" : "POST",
      headers: { Origin: origin },
      data:
        path === "get" || path === "list"
          ? undefined
          : { name: "Bypass", keyId: key.id },
    });
    expect(response.status()).toBe(404);
  }
  await page.request.delete(`/api/keys/${key.id}`, {
    headers: { Origin: origin },
  });
});
test("HTTP mutations and the real stdio MCP adapter share revision and retry guarantees", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Protocol integration is independent of viewport",
  );
  test.setTimeout(90000);
  await login(page);
  const origin = new URL(page.url()).origin;
  const key = await createKey(
    page,
    ["read", "write", "archive", "transfer"],
    null,
  );
  const client = new Client({ name: "tack-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", resolve("tools/tack-mcp.ts")],
    cwd: process.cwd(),
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      TACK_BASE_URL: origin,
      TACK_API_KEY: key.secret,
    },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(11);
    const first = await client.callTool({
      name: "tack_create_card",
      arguments: {
        boardId: "TCK",
        title: "MCP round trip",
        status: "ready",
        requestId: "mcp-create-retry",
      },
    });
    expect(first.isError).not.toBe(true);
    const parse = (result: typeof first) =>
      JSON.parse((result.content as { text: string }[])[0].text);
    expect(
      (await client.callTool({ name: "tack_boards", arguments: {} })).isError,
    ).not.toBe(true);
    const card = parse(first);
    const retried = parse(
      await client.callTool({
        name: "tack_create_card",
        arguments: {
          boardId: "TCK",
          title: "MCP round trip",
          status: "ready",
          requestId: "mcp-create-retry",
        },
      }),
    );
    expect(retried.id).toBe(card.id);
    const updated = parse(
      await client.callTool({
        name: "tack_update_card",
        arguments: {
          id: card.id,
          revision: card.revision,
          title: "MCP edited",
          requestId: "mcp-edit-first",
        },
      }),
    );
    expect(updated.title).toBe("MCP edited");
    await page.goto(`/?board=TCK&issue=${card.key}`);
    await expect(page.getByLabel("Title",{exact:true})).toHaveValue("MCP edited");
    const stale = await client.callTool({
      name: "tack_update_card",
      arguments: {
        id: card.id,
        revision: card.revision,
        title: "Stale",
        requestId: "mcp-edit-stale",
      },
    });
    expect(stale.isError).toBe(true);
    expect(parse(stale).error.code).toBe("revision_conflict");
    const moved = parse(
      await client.callTool({
        name: "tack_move_card",
        arguments: {
          id: card.id,
          revision: updated.revision,
          status: "done",
          position: 0,
          requestId: "mcp-move-one",
        },
      }),
    );
    expect(moved.status).toBe("done");
    expect(
      parse(
        await client.callTool({
          name: "tack_card",
          arguments: { id: card.key },
        }),
      ).title,
    ).toBe("MCP edited");
    const archived = await client.callTool({
      name: "tack_archive_card",
      arguments: {
        id: card.id,
        revision: moved.revision,
        requestId: "mcp-archive-one",
      },
    });
    expect(parse(archived).archivedAt).toBeTruthy();
    await page.request.delete(`/api/keys/${key.id}`, {
      headers: { Origin: origin },
    });
    expect(
      (await client.callTool({ name: "tack_me", arguments: {} })).isError,
    ).toBe(true);
  } finally {
    await client.close();
    await page.request.delete(`/api/keys/${key.id}`, {
      headers: { Origin: origin },
    });
  }
});
