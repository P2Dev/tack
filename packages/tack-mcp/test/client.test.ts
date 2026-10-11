import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chmodSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createApiClient } from "../src/client";
import { loadConnection } from "../src/config";

const connection = { base: new URL("http://127.0.0.1:3157"), key: "fixture-key-must-not-appear" };
test("preserves workflow status, retry/replay headers and distinct operation/server IDs", async () => {
  let received: RequestInit | undefined;
  const call = createApiClient(connection, (async (_url, init) => {
    received = init;
    return Response.json({ id: "stable-id", status: "ready", revision: 2, requestId: "server-body-id" }, { headers: { "X-Request-Id": "server-header-id", "Idempotency-Replayed": "true", "Retry-After": "60" } });
  }) as typeof fetch);
  const result = await call("cards/stable-id/move", "POST", { status: "ready", revision: 1 }, "operation-id-one");
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.status, "ready");
  assert.deepEqual(result.structuredContent._transport, { httpStatus: 200, operationId: "operation-id-one", serverRequestId: "server-header-id", replayed: true, retryAfterSeconds: 60, outcome: "confirmed" });
  assert.equal((received?.headers as Record<string,string>)["Idempotency-Key"], "operation-id-one");
  assert.equal(received?.redirect, "error");
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
});
test("returns rate-limit error with delay and redacts unexpected secret echoes", async () => {
  const call = createApiClient(connection, (async () => Response.json({ error: { code: "rate_limited", message: connection.key } }, { status: 429, headers: { "Retry-After": new Date(Date.now() + 60000).toUTCString() } })) as typeof fetch);
  const result = await call("me");
  assert.equal(result.isError, true);
  assert.equal((result.structuredContent.error as {code:string}).code, "rate_limited");
  assert.equal(JSON.stringify(result).includes(connection.key), false);
  const delay = (result.structuredContent._transport as {retryAfterSeconds:number}).retryAfterSeconds;
  assert.ok(delay > 55 && delay <= 60);
});
test("retains uncertainty for a lost response or server 5xx and operation identity", async () => {
  for (const fetcher of [async () => { throw new Error(connection.key); }, async () => new Response("broken", {headers:{"X-Request-Id":connection.key}}), async () => Response.json({ error: {code:"internal_error"} }, {status:500})]) {
    const result = await createApiClient(connection, fetcher as typeof fetch)("cards", "POST", { title: "one card" }, "retry-same-id");
    assert.equal(result.isError, true);
    assert.equal((result.structuredContent._transport as {outcome:string}).outcome, "unconfirmed");
    assert.equal((result.structuredContent._transport as {operationId:string}).operationId, "retry-same-id");
    assert.equal(JSON.stringify(result).includes(connection.key), false);
  }
});
test("rejects an oversized response", async () => {
  const result = await createApiClient(connection, (async () => new Response('"'+'x'.repeat(4000001)+'"')) as typeof fetch)("cards");
  assert.equal(result.isError, true);
  assert.equal((result.structuredContent.error as {code:string}).code, "connection_unconfirmed");
});
test("loads only an explicitly selected private file; process settings win", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "tack-mcp-config-"));
  try {
    const file = resolve(directory, "tack.env");
    writeFileSync(file, 'TACK_API_KEY="file-key"\nTACK_BASE_URL=http://localhost:3000\n', {mode:0o600});
    assert.equal(loadConnection(file, {}).key, "file-key");
    assert.equal(loadConnection(file, {TACK_API_KEY:"environment-key"}).key, "environment-key");
    assert.throws(() => loadConnection(file, {TACK_API_KEY:""}));
    if (process.platform !== "win32") {
      chmodSync(file, 0o644);
      assert.throws(() => loadConnection(file, {}), /private file/);
      chmodSync(file, 0o600);
    }
    assert.throws(() => loadConnection(undefined, {}));
    writeFileSync(file, "TACK_API_KEY=file-key\nTACK_BASE_URL=https://tack.example\nPOSTGRES_PASSWORD=private\n");
    assert.throws(() => loadConnection(file, {}), /only TACK_BASE_URL/);
  } finally { rmSync(directory, {recursive:true,force:true}); }
});
test("rejects insecure/untrusted origin shapes without echoing supplied values", () => {
  for (const address of ["http://192.168.1.4:3000", "https://user:private@tack.example", "https://tack.example/path", "https://tack.example?key=private", "https://tack.example/#private", "private-invalid"]) {
    assert.throws(() => loadConnection(undefined, {TACK_API_KEY:connection.key,TACK_BASE_URL:address}), error => !String(error).includes(connection.key) && !String(error).includes("private"));
  }
  assert.equal(loadConnection(undefined, {TACK_API_KEY:connection.key,TACK_BASE_URL:"http://[::1]:3000"}).base.hostname,"[::1]");
  assert.throws(() => loadConnection(undefined, {TACK_API_KEY:connection.key,TACK_BASE_URL:"https://tack.example",NODE_TLS_REJECT_UNAUTHORIZED:"0"}), /Certificate verification/);
});
