"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { DetailDrawer } from "@/components/detail-drawer";
import { SessionRecovery } from "@/components/session-recovery";
import type { BoardInfo } from "@/lib/types";

export function BoardManagerDrawer({ boards: initialBoards, currentBoardId, onClose, onSwitch, returnFocusRef, onBoardsChange }: {
  onBoardsChange: (boards: BoardInfo[]) => void; boards: BoardInfo[]; currentBoardId: string; onClose: () => void; onSwitch: (id: string, archive?: boolean) => void; returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const [boards, setBoards] = useState(initialBoards);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/boards", { signal: controller.signal }).then(async response => {
      const result = await response.json();
      setExpired(response.status === 401);
      if (!response.ok) throw new Error("Board counts could not be refreshed. Close and reopen this panel to retry.");
      setBoards(result); onBoardsChange(result);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [onBoardsChange]);
  async function request(url: string, init: RequestInit) {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const result = await response.json();
    setExpired(response.status === 401);
    if (!response.ok) throw new Error(result.error || "Change could not be confirmed. Try again.");
    return result;
  }
  return <DetailDrawer title="Manage boards" titleId="boards-title" eyebrow="Workspace" closeLabel="Close board management" closeDisabled={pending} onClose={onClose} returnFocusRef={returnFocusRef}>
    <div className="drawer-body">
      <p>Everyone in this workspace can use every board. Administrators add and remove boards.</p>
      <section aria-label="Existing boards" className="board-list"><h3>Existing boards</h3>{boards.map(board => {
        const populated = board.activeCount + board.archivedCount > 0;
        const reason = boards.length === 1 ? "Keep at least one board in this workspace." : populated ? "Move the active and archived cards out before removing this board." : "";
        return <div key={board.id} className="board-list-row">
          <div><strong>{board.name}</strong><p>{board.id}{board.id === currentBoardId ? " · Current board" : ""} · {board.activeCount} active · {board.archivedCount} archived</p></div>
          <div className="recovery-actions">
            <button type="button" className="secondary-button" disabled={pending} onClick={() => onSwitch(board.id)}>Open {board.id}</button>
            <button type="button" className="secondary-button" disabled={pending} onClick={() => onSwitch(board.id, true)}>View {board.id} archive</button>
            <button type="button" className="danger-button" data-remove-board={board.id} disabled={pending || Boolean(reason)} aria-describedby={reason ? `removal-help-${board.id}` : undefined} onClick={() => { setConfirmation(board.id); setError(""); window.setTimeout(() => cancelRef.current?.focus(), 0); }}>Remove {board.id}</button>
          </div>
          {reason ? <p id={`removal-help-${board.id}`} className="board-help">{reason}</p> : null}
          {confirmation === board.id ? <div className="board-remove-confirm"><p>Remove {board.name}? Its ID remains reserved to preserve old links.</p><div className="recovery-actions">
            <button ref={cancelRef} type="button" className="secondary-button" disabled={pending} onClick={() => { setConfirmation(""); window.setTimeout(() => document.querySelector<HTMLElement>(`[data-remove-board="${board.id}"]`)?.focus(), 0); }}>Cancel removal</button>
            <button type="button" className="danger-button" disabled={pending} onClick={async () => {
              setPending(true); setError("");
              try { const result = await request(`/api/boards/${board.id}`, { method: "DELETE" }); setBoards(result.boards); onBoardsChange(result.boards); setConfirmation(""); setMessage(`${board.id} removed.`); if (board.id === currentBoardId) onSwitch(result.boards[0].id); else addRef.current?.focus(); }
              catch (error) {
                setError(error instanceof Error ? error.message : "Removal could not be confirmed.");
                // A teammate may have added a card since the panel opened.
                try { setBoards(await request("/api/boards", { method: "GET" })); } catch { /* Keep the failure and prior rows visible. */ }
              } finally { setPending(false); }
            }}>Confirm removal</button>
          </div></div> : null}
        </div>;
      })}</section>
      <details className="board-create-disclosure"><summary ref={addRef}>Add a board</summary>
        <form className="auth-form board-create-form" onSubmit={async event => {
          event.preventDefault(); setPending(true); setError(""); setMessage("");
          try { const board = await request("/api/boards", { method: "POST", body: JSON.stringify({ id, name }) }); setBoards(current => [...current, board]); setId(""); setName(""); setMessage(`${board.id} added.`); onSwitch(board.id); }
          catch (error) { setError(error instanceof Error ? error.message : "Board could not be added."); }
          finally { setPending(false); }
        }}>
          <label>Board name<input ref={nameRef} value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={pending} placeholder="Platform engineering" /></label>
          <label>Board ID<input value={id} onChange={event => setId(event.target.value.toUpperCase())} pattern="[A-Z][A-Z0-9]{1,9}" minLength={2} maxLength={10} required disabled={pending} placeholder="ENG" aria-describedby="board-id-help" /></label>
          <p id="board-id-help" className="board-help">2–10 letters or numbers, starting with a letter. Cards use keys like {id || "ENG"}-1. This ID is permanent and cannot be reused after removal.</p>
          <button className="primary-button" disabled={pending}>{pending ? "Working…" : "Add board"}</button>
        </form>
      </details>
    </div>
    {(error || message || expired) ? <div className="drawer-messages">{expired ? <SessionRecovery /> : null}{error ? <p className="drawer-error" role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}</div> : null}
  </DetailDrawer>;
}
