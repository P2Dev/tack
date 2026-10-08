import "server-only";
import { getRequestSession } from "@/lib/auth-guards";
import { getDatabase } from "@/lib/database";
import { AgentError } from "@/lib/agent-contract";

export async function keyManagementActor(request: Request) {
  // Key lifecycle always requires a browser session, never a delegated credential.
  if (request.headers.has("authorization"))
    throw new AgentError(
      401,
      "session_required",
      "Sign in to manage API keys.",
    );
  const session = await getRequestSession(request);
  if (!session)
    throw new AgentError(
      401,
      "session_required",
      "Sign in to manage API keys.",
    );
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const allowed = new Set(
      [
        process.env.BETTER_AUTH_URL,
        ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
      ]
        .filter(Boolean)
        .map((value) => new URL(value!.trim()).origin),
    );
    if (!origin || !allowed.has(origin))
      throw new AgentError(
        403,
        "invalid_origin",
        "Use the API keys page on this Tack instance.",
      );
  }
  const result = await getDatabase().query<{ id: string; role: string }>(
    `SELECT id,role FROM "user" WHERE id=$1 AND NOT banned`,
    [session.user.id],
  );
  if (!result.rows[0])
    throw new AgentError(
      401,
      "session_required",
      "This account is no longer active.",
    );
  return result.rows[0];
}
