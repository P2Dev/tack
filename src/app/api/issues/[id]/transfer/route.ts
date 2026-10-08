import { getRequestSession, unauthorized } from "@/lib/auth-guards";
import { jsonError, missingIssue } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";
import { transferIssueSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getRequestSession(request))) return unauthorized();
    const issue = await getIssueStore().transfer((await context.params).id, transferIssueSchema.parse(await request.json()));
    return issue ? Response.json(issue) : missingIssue();
  } catch (error) { return jsonError(error); }
}
