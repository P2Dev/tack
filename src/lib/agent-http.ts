import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { AgentError } from "@/lib/agent-contract";
import { DomainError } from "@/lib/domain-error";

export function agentJson(
  data: unknown,
  status = 200,
  requestId = randomUUID(),
  extra: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...extra,
    },
  });
}
export function agentFailure(error: unknown, requestId = randomUUID()) {
  if (error instanceof AgentError)
    return agentJson(
      { error: { code: error.code, message: error.message }, requestId },
      error.status,
      requestId,
      error.status === 429
        ? { "Retry-After": "60" }
        : error.status === 401
          ? { "WWW-Authenticate": "Bearer" }
          : {},
    );
  if (error instanceof ZodError)
    return agentJson(
      {
        error: {
          code: "invalid_input",
          message: error.issues
            .map((item) => `${item.path.join(".") || "input"}: ${item.message}`)
            .join("; "),
        },
        requestId,
      },
      400,
      requestId,
    );
  if (error instanceof DomainError)
    return agentJson(
      {
        error: { code: "invalid_operation", message: error.message },
        requestId,
      },
      error.status,
      requestId,
    );
  console.error("Agent API operation failed", {
    requestId,
    type: error instanceof Error ? error.name : "unknown",
  });
  return agentJson(
    {
      error: {
        code: "server_error",
        message:
          "The operation could not be confirmed. Retry with the same Idempotency-Key.",
      },
      requestId,
    },
    500,
    requestId,
  );
}
export async function readAgentJson(request: Request) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new AgentError(415, "invalid_content_type", "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new AgentError(400, "invalid_input", "A JSON body is required.");
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 131072) {
      await reader.cancel();
      throw new AgentError(413, "body_too_large", "The request is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AgentError(400, "invalid_json", "Supply valid JSON.");
  }
}
