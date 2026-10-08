import { z } from "zod";
import { changeAgentKey } from "@/lib/agent-keys";
import { agentFailure, agentJson, readAgentJson } from "@/lib/agent-http";
import { keyManagementActor } from "@/lib/key-management";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await keyManagementActor(request);
    const input = z
      .object({ name: z.string().trim().min(1).max(80) })
      .strict()
      .parse(await readAgentJson(request));
    return agentJson(
      await changeAgentKey(actor, (await context.params).id, input),
    );
  } catch (error) {
    return agentFailure(error);
  }
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await keyManagementActor(request);
    return agentJson(
      await changeAgentKey(actor, (await context.params).id, { revoke: true }),
    );
  } catch (error) {
    return agentFailure(error);
  }
}
