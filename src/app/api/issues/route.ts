import { getRequestSession, unauthorized } from "@/lib/auth-guards";
import { jsonError } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";
import { createIssueSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!(await getRequestSession(request))) {
      return unauthorized();
    }
    return Response.json(await getIssueStore().snapshot(new URL(request.url).searchParams.get("board") ?? undefined));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!(await getRequestSession(request))) {
      return unauthorized();
    }
    const input = createIssueSchema.parse(await request.json());
    const issue = await getIssueStore().create(input);
    return Response.json(issue, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
