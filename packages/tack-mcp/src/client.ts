export type Connection = { base: URL; key: string };
export type TransportMetadata = {
  httpStatus: number | null; operationId: string | null; serverRequestId: string | null;
  replayed: boolean; retryAfterSeconds: number | null; outcome: "confirmed" | "unconfirmed";
};
function retryDelay(value: string | null) {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
}
export function createApiClient(connection: Connection, fetcher: typeof fetch = fetch) {
  function resultFrom(payload: Record<string, unknown>, isError: boolean) {
    // Headers as well as response bodies can contain unexpected server text.
    const safeText = JSON.stringify(payload).split(connection.key).join("[redacted]");
    return { isError, content: [{ type: "text" as const, text: safeText }], structuredContent: JSON.parse(safeText) as Record<string, unknown> };
  }
  return async function call(path: string, method = "GET", body?: unknown, operationId?: string) {
    const transport: TransportMetadata = { httpStatus: null, operationId: operationId ?? null, serverRequestId: null, replayed: false, retryAfterSeconds: null, outcome: "unconfirmed" };
    try {
      const response = await fetcher(new URL(`/api/v1/${path}`, connection.base), {
        method, redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${connection.key}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(operationId ? { "Idempotency-Key": operationId } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      transport.httpStatus = response.status;
      transport.serverRequestId = response.headers.get("X-Request-Id");
      transport.replayed = response.headers.get("Idempotency-Replayed") === "true";
      transport.retryAfterSeconds = retryDelay(response.headers.get("Retry-After"));
      const reader = response.body?.getReader();
      let text = "", bytes = 0;
      const decoder = new TextDecoder();
      if (reader) for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 4000000) { await reader.cancel(); throw new Error(); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      const result = JSON.parse(text);
      if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
      // An HTTP 5xx can follow a committed write. Preserve uncertainty until replay/read confirms it.
      transport.outcome = response.status < 500 ? "confirmed" : "unconfirmed";
      const payload = { status: response.status, requestId: operationId, ...result, _transport: transport };
      return resultFrom(payload, !response.ok);
    } catch {
      const payload = {
        error: { code: "connection_unconfirmed", message: "Connection failed or response could not be confirmed. Check connectivity and credentials. Retry an uncertain write with identical arguments and the same requestId within 24 hours; afterward inspect the card before retrying." },
        requestId: operationId, _transport: transport,
      };
      return resultFrom(payload, true);
    }
  };
}
