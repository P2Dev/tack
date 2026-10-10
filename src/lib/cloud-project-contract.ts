import { z } from "zod";
import { AgentError } from "@/lib/agent-contract";

export const cloudUuidSchema = z.string().uuid().regex(/^[0-9a-f-]+$/, "Use a lowercase UUID.");
export const cloudSlugSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const cloudCodeSchema = z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/);
const revisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const cloudProjectSchema = z.object({
  schemaVersion: z.literal(1), cloudProjectId: cloudUuidSchema,
  revision: revisionSchema, slug: cloudSlugSchema, code: cloudCodeSchema,
  name: z.string().min(1).max(80).refine(value => value === value.trim(), "Use a nonblank name without outer whitespace."),
  description: z.string().max(20000),
  appUrl: z.string().max(2048).url().refine(value => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !/[\\\r\n]/.test(value); }
    catch { return false; }
  }, "Use an HTTPS URL without credentials.").nullable(),
  status: z.enum(["active", "archived"]),
}).strict();
export type CloudProject = z.infer<typeof cloudProjectSchema>;
export const importApprovalSchema = z.object({
  cloudProjectId: cloudUuidSchema, slug: cloudSlugSchema, code: cloudCodeSchema, revision: revisionSchema,
}).strict();
export type ImportApproval = z.infer<typeof importApprovalSchema>;
export const operatorMappingSchema = z.object({
  schemaVersion: z.literal(1), cloudProjectId: cloudUuidSchema,
  boardId: cloudCodeSchema, revision: revisionSchema,
  slug: cloudSlugSchema, code: cloudCodeSchema,
  provisionedBy: z.literal("p2dev-cloud-operator"),
}).strict().refine(value => value.boardId === value.code, "Board ID and code must match.");
export function parseCloudProject(id: string, body: unknown, requestKey: string | null) {
  const uuid = cloudUuidSchema.parse(id);
  const project = cloudProjectSchema.parse(body);
  if (uuid !== project.cloudProjectId) throw new AgentError(400, "identity_mismatch", "Path and payload UUID must match.");
  if (requestKey !== `cloud-project-${uuid}-r${project.revision}`)
    throw new AgentError(400, "invalid_idempotency_key", "Use cloud-project-{UUID}-r{revision}.");
  return project;
}
export function projectResponse(project: CloudProject, baseUrl: string) {
  const base = new URL(baseUrl);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password)
    throw new Error("Invalid Tack origin configuration");
  const url = new URL("/", base.origin);
  url.searchParams.set("board", project.code);
  return { schemaVersion: 1, cloudProjectId: project.cloudProjectId, revision: project.revision,
    resourceType: "board", resourceId: project.code, url: url.href };
}
