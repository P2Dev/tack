import { redirect } from "next/navigation";
import { getPageSession } from "@/lib/auth-guards";
import { listAgentKeys } from "@/lib/agent-keys";
import { getIssueStore } from "@/lib/server-store";
import { getDatabase } from "@/lib/database";
import { signInPath } from "@/lib/return-path";
import { ApiKeyManager } from "@/components/api-key-manager";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const { board } = await searchParams;
  const session = await getPageSession();
  if (!session)
    redirect(
      signInPath(
        `/settings/api-keys${board ? `?board=${encodeURIComponent(board)}` : ""}`,
      ),
    );
  const user = await getDatabase().query<{ id: string; role: string }>(
    'SELECT id,role FROM "user" WHERE id=$1 AND NOT banned',
    [session.user.id],
  );
  if (!user.rows[0]) redirect("/sign-in");
  const boards = await getIssueStore().listBoards();
  const selected =
    boards.find((item) => item.id === board)?.id ?? boards[0]?.id ?? "";
  return (
    <ApiKeyManager
      initialKeys={await listAgentKeys(session.user.id)}
      boards={boards.map(({ id, name }) => ({ id, name }))}
      currentBoardId={selected}
      userId={session.user.id}
      admin={user.rows[0].role === "admin"}
      baseUrl={process.env.BETTER_AUTH_URL || "http://localhost:3000"}
    />
  );
}
