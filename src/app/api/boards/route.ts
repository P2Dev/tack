import { forbidden, getRequestSession, isAdmin, unauthorized } from "@/lib/auth-guards";
import { jsonError } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";
import { createBoardSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await getRequestSession(request))) return unauthorized();
  return Response.json(await getIssueStore().listBoards());
}
export async function POST(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();
    if (!isAdmin(session)) return forbidden();
    const board = await getIssueStore().createBoard(createBoardSchema.parse(await request.json()));
    return Response.json(board, { status: 201 });
  } catch (error) { return jsonError(error); }
}
