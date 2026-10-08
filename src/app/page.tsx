import { redirect } from "next/navigation";

import { signInPath } from "@/lib/return-path";

import { Board } from "@/components/board";
import { getPageSession } from "@/lib/auth-guards";
import { getIssueStore } from "@/lib/server-store";
import type { TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HomePageProps = {
  searchParams: Promise<{
    board?: string | string[];
    archive?: string | string[];
    issue?: string | string[];
    q?: string | string[];
    assignee?: string | string[];
    label?: string | string[];
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const session = await getPageSession();
  if (!session) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (first) query.set(key, first);
    }
    redirect(signInPath(query.size ? `/?${query}` : "/"));
  }

  const { issue, q, assignee, label } = params;
  const selectedKey = Array.isArray(issue) ? issue[0] : issue;
  const store = getIssueStore();
  const linkedIssue = selectedKey ? await store.getByKey(selectedKey) : null;
  const requestedBoard = Array.isArray(params.board) ? params.board[0] : params.board;
  if (linkedIssue && (linkedIssue.key !== selectedKey || (requestedBoard && requestedBoard !== linkedIssue.boardId))) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) { const first = Array.isArray(value) ? value[0] : value; if (first) query.set(key, first); }
    query.set("board", linkedIssue.boardId); query.set("issue", linkedIssue.key);
    redirect(`/?${query}`);
  }
  const boards = await store.listBoards();
  const boardId = linkedIssue?.boardId ?? requestedBoard;
  if (boardId && !boards.some(board => board.id === boardId)) {
    return <main className="auth-shell"><section className="auth-card"><h1>Board unavailable</h1><p>This board was removed or the link is incorrect. Choose an available board.</p><nav aria-label="Available boards">{boards.map(board => <p key={board.id}><a href={`/?board=${board.id}`}>{board.name} ({board.id})</a></p>)}</nav></section></main>;
  }
  const snapshot = await store.snapshot(boardId);
  const currentMember: TeamMember = {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.name,
    initials: session.user.initials,
    color: session.user.color,
    role: session.user.role === "admin" ? "admin" : "member",
  };

  return (
    <Board
      key={`${snapshot.board.id}:${selectedKey ?? ""}:${params.archive ?? ""}`}
      initialSnapshot={snapshot}
      initialArchiveOpen={params.archive === "1" && !selectedKey}
      currentMember={currentMember}
      initialSelectedKey={selectedKey}
      initialFilters={{
        query: Array.isArray(q) ? (q[0] ?? "") : (q ?? ""),
        assigneeId: Array.isArray(assignee)
          ? (assignee[0] ?? "")
          : (assignee ?? ""),
        labelId: Array.isArray(label) ? (label[0] ?? "") : (label ?? ""),
      }}
    />
  );
}
