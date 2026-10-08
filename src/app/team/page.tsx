import { signInPath } from "@/lib/return-path";
import { boardIdSchema } from "@/lib/validation";
import { redirect } from "next/navigation";

import { TeamManager } from "@/components/team-manager";
import { getPageSession, isAdmin } from "@/lib/auth-guards";
import { getIssueStore } from "@/lib/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const params = await searchParams;
  const parsed = boardIdSchema.safeParse(params.board);
  const boardId = parsed.success ? parsed.data : undefined;
  const boardHref = boardId ? `/?board=${boardId}` : "/";
  const session = await getPageSession();
  if (!session) {
    redirect(signInPath(boardId ? `/team?board=${boardId}` : "/team"));
  }
  if (!isAdmin(session)) {
    redirect("/");
  }

  const members = await getIssueStore().listMembers({
    includeDisabled: true,
  });

  return (
    <TeamManager
      boardHref={boardHref}
      currentUserId={session.user.id}
      initialMembers={members}
    />
  );
}
