import {
  forbidden,
  getRequestSession,
  isAdmin,
  unauthorized,
} from "@/lib/auth-guards";
import { jsonError } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";

export const runtime = "nodejs";

type RouteParameters = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteParameters) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return unauthorized();
    }
    if (!isAdmin(session)) {
      return forbidden();
    }
    const { id } = await context.params;
    const deleted = await getIssueStore().deleteLabel(id);
    return deleted
      ? Response.json({ snapshot: await getIssueStore().snapshot(new URL(request.url).searchParams.get("board") ?? undefined) })
      : Response.json({ error: "That label could not be found." }, { status: 404 });
  } catch (error) {
    return jsonError(error);
  }
}
