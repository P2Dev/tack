import { forbidden, getRequestSession, isAdmin, unauthorized } from "@/lib/auth-guards";
import { jsonError } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";
export const runtime = "nodejs";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();
    if (!isAdmin(session)) return forbidden();
    await getIssueStore().removeBoard((await context.params).id);
    return Response.json({ boards: await getIssueStore().listBoards() });
  } catch (error) { return jsonError(error); }
}
