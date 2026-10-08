"use client";
import { useState } from "react";
import type { BoardInfo, Issue } from "@/lib/types";

export function BoardTransfer({ issue, boards, disabled = false, onTransfer }: { issue: Issue; boards: BoardInfo[]; disabled?: boolean; onTransfer: (boardId: string) => Promise<boolean> }) {
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (boards.length < 2) return null;
  return <section className="board-transfer" aria-label="Move to another board">
    <div className="field-group"><label htmlFor={`transfer-${issue.id}`}>Move to board</label><select id={`transfer-${issue.id}`} className="field-select" value={target} disabled={disabled || pending} onChange={event => { setTarget(event.target.value); setError(""); }}><option value="">Choose a board…</option>{boards.filter(board => board.id !== issue.boardId).map(board => <option key={board.id} value={board.id}>{board.name} ({board.id})</option>)}</select></div>
    {target ? <><p>The card will receive the next {target} number. Links to {issue.key} will still work. Its status, notes, labels, and {issue.archivedAt ? "archived state" : "assignee"} stay with it.</p><div className="recovery-actions"><button type="button" className="secondary-button" disabled={disabled || pending} onClick={async () => {
      setPending(true); setError("");
      try { if (!(await onTransfer(target))) setError("Move could not be confirmed. Your card and draft are retained. Retry to check the same destination safely."); }
      catch { setError("Move could not be confirmed. Retry or close to check the board."); }
      finally { setPending(false); }
    }}>{pending ? "Moving…" : "Move card"}</button><button type="button" className="secondary-button" disabled={disabled || pending} onClick={() => { setTarget(""); setError(""); }}>Cancel move</button></div></> : null}
    {error ? <p className="drawer-error" role="alert">{error}</p> : null}
  </section>;
}
