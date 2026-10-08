import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);
function sessionOnly(request: Request, handler: (request: Request) => Promise<Response>) {
  if (request.headers.has("authorization")) return Response.json({ error: "Use a browser session for account operations." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return handler(request);
}
export const GET = (request: Request) => sessionOnly(request, handlers.GET);
export const POST = (request: Request) => sessionOnly(request, handlers.POST);
