import { createAgentKey, listAgentKeys } from "@/lib/agent-keys";
import { AgentError } from "@/lib/agent-contract";
import { agentFailure, agentJson, readAgentJson } from "@/lib/agent-http";
import { keyManagementActor } from "@/lib/key-management";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await keyManagementActor(request);
    const all = new URL(request.url).searchParams.get("all") === "1";
    if (all && actor.role !== "admin")
      throw new AgentError(
        403,
        "forbidden",
        "Only administrators can review other users' key metadata.",
      );
    return agentJson({ keys: await listAgentKeys(actor.id, all) });
  } catch (error) {
    return agentFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await keyManagementActor(request);
    return agentJson(
      await createAgentKey(actor.id, await readAgentJson(request)),
      201,
    );
  } catch (error) {
    return agentFailure(error);
  }
}
