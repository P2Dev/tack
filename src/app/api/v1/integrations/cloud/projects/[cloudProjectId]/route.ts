import { randomUUID } from "node:crypto";
import { authenticateAgent } from "@/lib/agent-keys";
import { AgentError, type AgentPrincipal } from "@/lib/agent-contract";
import { agentFailure, agentJson, readAgentJson } from "@/lib/agent-http";
import { syncCloudProject } from "@/lib/cloud-project-service";
import { getDatabase } from "@/lib/database";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(request: Request, context: { params: Promise<{ cloudProjectId: string }> }) {
  const requestId = randomUUID();
  let principal: AgentPrincipal | null = null;
  try {
    principal = await authenticateAgent(request);
    const result = await syncCloudProject(principal, {
      id: (await context.params).cloudProjectId, body: await readAgentJson(request),
      idempotencyKey: request.headers.get("idempotency-key"), requestId,
    });
    return agentJson(result.data, result.status, requestId, result.replayed ? { "Idempotency-Replayed": "true" } : {});
  } catch (error) {
    if (principal) await getDatabase().query("INSERT INTO agent_audit(request_id,user_id,key_id,operation,outcome) VALUES($1,$2,$3,'projects:sync',$4)",
      [requestId, principal.userId, principal.keyId, error instanceof AgentError ? error.code : "failed"]).catch(() => undefined);
    return agentFailure(error, requestId);
  }
}
