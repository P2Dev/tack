import { describe, expect, it } from "vitest";
import { keyInputSchema } from "@/lib/agent-contract";
import { cloudProjectSchema, parseCloudProject, projectResponse } from "@/lib/cloud-project-contract";
const payload = { schemaVersion: 1, cloudProjectId: "39cbda4f-bc0c-456a-b9dd-87a147fae3f1", revision: 1, slug: "example-project", code: "EXM", name: "Example", description: "", appUrl: null, status: "active" };
describe("Strict Cloud v1 contract", () => {
  it.each([
    { extra: true }, { schemaVersion: 2 }, { revision: 0 }, { revision: 1.1 }, { revision: Number.MAX_SAFE_INTEGER+1 },
    { cloudProjectId: "not-a-uuid" }, { code: "exm" }, { code: "E" }, { code: "1EX" }, { code: "EXM12345678" },
    { slug: "Upper" }, { slug: "has--gap" }, { slug: "x".repeat(81) }, { name: " " }, { name: "x".repeat(81) },
    { description: "x".repeat(20001) }, { appUrl: "http://example.test" }, { appUrl: "javascript:alert(1)" },
    { appUrl: "https://user:secret@example.test" }, { appUrl: "https://example.test\\unsafe" }, { status: "deleted" },
  ])("rejects invalid payload %j", change => expect(cloudProjectSchema.safeParse({ ...payload, ...change }).success).toBe(false));
  it("requires all fields, matching UUID and exact revision key", () => {
    for (const key of Object.keys(payload)) { const body: Record<string, unknown> = { ...payload }; delete body[key]; expect(cloudProjectSchema.safeParse(body).success).toBe(false); }
    expect(() => parseCloudProject(payload.cloudProjectId, payload, null)).toThrow();
    expect(() => parseCloudProject("9ffc0bec-87e1-4d36-b1d8-01b5f19f21fd", payload, "wrong")).toThrow();
    expect(parseCloudProject(payload.cloudProjectId, payload, `cloud-project-${payload.cloudProjectId}-r1`)).toEqual(payload);
  });
  it("keeps the dedicated scope exclusive and defaults ordinary keys to read", () => {
    const key = { name: "Cloud", scopes: ["projects:sync"], boardIds: null, days: 7 };
    expect(keyInputSchema.safeParse(key).success).toBe(true);
    expect(keyInputSchema.safeParse({ ...key, scopes: ["read", "projects:sync"] }).success).toBe(false);
    expect(keyInputSchema.safeParse({ ...key, boardIds: ["TCK"] }).success).toBe(false);
    expect(keyInputSchema.safeParse({ ...key, scopes: ["read"] }).success).toBe(true);
  });
  it("uses the configured Tack origin and a deterministic board URL", () => {
    expect(projectResponse(cloudProjectSchema.parse(payload), "https://tack.example/subpath?evil=1")).toEqual({ schemaVersion: 1, cloudProjectId: payload.cloudProjectId, revision: 1, resourceType: "board", resourceId: "EXM", url: "https://tack.example/?board=EXM" });
  });
});
