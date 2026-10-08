import { getRequestSession, unauthorized } from "@/lib/auth-guards";
import { jsonError, missingIssue } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";
import { updateIssueSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteParameters = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteParameters) {
  try {
    if (!(await getRequestSession(request))) {
      return unauthorized();
    }
    const { id } = await context.params;
    const input = updateIssueSchema.parse(await request.json());
    const issue = await getIssueStore().update(id, input, new URL(request.url).searchParams.get("board") ?? undefined);
    return issue ? Response.json(issue) : missingIssue();
  } catch (error) {
    return jsonError(error);
  }
}
