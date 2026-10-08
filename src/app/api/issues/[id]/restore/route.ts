import { getRequestSession, unauthorized } from "@/lib/auth-guards";
import { jsonError, missingIssue } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";

export const runtime = "nodejs";

type RouteParameters = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteParameters) {
  try {
    if (!(await getRequestSession(request))) {
      return unauthorized();
    }
    const { id } = await context.params;
    const boardId = new URL(request.url).searchParams.get("board") ?? undefined;
    const issue = await getIssueStore().restore(id, boardId);
    return issue
      ? Response.json({ issue, snapshot: await getIssueStore().snapshot(boardId ?? issue.boardId) })
      : missingIssue();
  } catch (error) {
    return jsonError(error);
  }
}
