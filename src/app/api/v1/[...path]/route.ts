import { randomUUID } from "node:crypto";
import { authenticateAgent } from "@/lib/agent-keys";
import { agentFailure, agentJson, readAgentJson } from "@/lib/agent-http";
import { getDatabase } from "@/lib/database";
import { AgentError, type AgentPrincipal } from "@/lib/agent-contract";
import { agentOperation } from "@/lib/agent-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const requestId = randomUUID();
  let principal: AgentPrincipal | null = null;
  try {
    principal = await authenticateAgent(request);
    const result = await agentOperation(principal, {
      method: request.method,
      path: (await context.params).path,
      query: new URL(request.url).searchParams,
      body: request.method === "GET" ? undefined : await readAgentJson(request),
      idempotencyKey: request.headers.get("idempotency-key"),
      requestId,
    });
    return agentJson(
      result.data,
      result.status,
      requestId,
      result.replayed ? { "Idempotency-Replayed": "true" } : {},
    );
  } catch (error) {
    if (principal && request.method !== "GET") {
      // Record attribution only; never persist raw paths, bodies, or credentials.
      await getDatabase()
        .query(
          "INSERT INTO agent_audit(request_id,user_id,key_id,operation,outcome) VALUES($1,$2,$3,$4,$5)",
          [
            requestId,
            principal.userId,
            principal.keyId,
            request.method,
            error instanceof AgentError ? error.code : "failed",
          ],
        )
        .catch(() => undefined);
    }
    return agentFailure(error, requestId);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
