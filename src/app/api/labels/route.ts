import {
  forbidden,
  getRequestSession,
  isAdmin,
  unauthorized,
} from "@/lib/auth-guards";
import { jsonError } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";
import { createLabelSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return unauthorized();
    }
    if (!isAdmin(session)) {
      return forbidden();
    }
    const input = createLabelSchema.parse(await request.json());
    const label = await getIssueStore().createLabel(input);
    return Response.json(
      { label, snapshot: await getIssueStore().snapshot(new URL(request.url).searchParams.get("board") ?? undefined) },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
