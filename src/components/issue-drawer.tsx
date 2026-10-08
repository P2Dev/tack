"use client";

import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import ReactMarkdown from "react-markdown";

import { BoardTransfer } from "@/components/board-transfer";
import { useIssueDraft } from "@/hooks/use-issue-draft";
import { signInPath } from "@/lib/return-path";
import { SessionRecovery } from "@/components/session-recovery";
import { DetailDrawer } from "@/components/detail-drawer";
import type {
  BoardInfo,
  Issue,
  IssuePatch,
  IssueStatus,
  Label,
  TeamMember,
} from "@/lib/types";
import { ISSUE_STATUSES, STATUS_META } from "@/lib/types";

type IssueDrawerProps = {
  navigationGuardRef: RefObject<(() => Promise<boolean>) | null>;
  issue: Issue;
  boards: BoardInfo[];
  onTransfer: (id: string, boardId: string) => Promise<boolean>;
  memberId: string;
  sessionExpired: boolean;
  feedback: { message: string; undo?: () => void } | null;
  members: TeamMember[];
  labels: Label[];
  columnLength: number;
  onClose: () => void;
  onUpdate: (id: string, patch: IssuePatch) => Promise<void>;
  onMove: (id: string, status: IssueStatus, position: number) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
};

export function IssueDrawer({
  navigationGuardRef,
  issue,
  boards,
  onTransfer,
  memberId,
  sessionExpired,
  feedback,
  members,
  labels,
  columnLength,
  onClose,
  onUpdate,
  onMove,
  onArchive,
}: IssueDrawerProps) {
  const draft = useIssueDraft(issue, memberId, onUpdate);
  const { title, description, saveState, isDirty } = draft;
  const [operationError, setOperationError] = useState("");
  const [operationStatus, setOperationStatus] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    navigationGuardRef.current = async () => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      try { return await draft.flush(); }
      finally { busyRef.current = false; setBusy(false); }
    };
    return () => { navigationGuardRef.current = null; };
  }, [draft, navigationGuardRef]);

  async function act(operation: () => void | Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setOperationError("");
    setOperationStatus("");
    try {
      if (await draft.flush()) await operation();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function updateMetadata(patch: IssuePatch) {
    await act(async () => {
      setOperationStatus("Saving details…");
      try {
        await onUpdate(issue.id, patch);
        setOperationStatus("Details saved");
      } catch {
        setOperationStatus("");
        setOperationError("That detail couldn’t be saved. Try it again.");
      }
    });
  }

  async function move(status: IssueStatus, position: number) {
    await act(async () => {
      if (!(await onMove(issue.id, status, position))) {
        setOperationError("Move failed. Previous view restored. Try again.");
      }
    });
  }

  async function copyLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("Link copied");
      setCopyFallback("");
    } catch {
      setCopyMessage("Copy this link to share the card.");
      setCopyFallback(url);
    }
  }

  function signInAgain() {
    if (!draft.persist()) return;
    window.location.assign(signInPath(window.location.pathname + window.location.search));
  }

  return (
    <DetailDrawer
      closeLabel="Close card details"
      closeDisabled={busy}
      descriptionId="issue-drawer-key"
      eyebrow={issue.key}
      eyebrowId="issue-drawer-key"
      onClose={() => act(onClose)}
      title="Card details"
      titleId="issue-drawer-title"
    >
      <div className="drawer-body">
        <div className="field-group">
          <label htmlFor="issue-title">Title</label>
          <textarea
            id="issue-title"
            className="title-editor"
            value={title}
            maxLength={180}
            rows={3}
            disabled={busy}
            aria-invalid={!title.trim() || undefined}
            onChange={(event) => draft.change("title", event.target.value)}
          />
          <span className="character-count">{title.length}/180</span>
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="issue-description">Description</label>
            <span>Markdown · optional</span>
          </div>
          <textarea
            id="issue-description"
            className="description-editor"
            value={description}
            maxLength={20_000}
            rows={5}
            placeholder="Add just enough context to make the work understandable…"
            disabled={busy}
            onChange={(event) => draft.change("description", event.target.value)}
          />
        </div>

        {description.trim() ? (
          <details className="markdown-preview">
            <summary>Preview formatted description</summary>
            <div className="markdown-body">
              <ReactMarkdown>{description}</ReactMarkdown>
            </div>
          </details>
        ) : null}

        <div className="field-grid">
          <div className="field-group">
            <label htmlFor="issue-status">Status</label>
            <select
              id="issue-status"
              className="field-select"
              value={issue.status}
              disabled={busy}
              onChange={(event) => {
                const status = event.target.value as IssueStatus;
                void move(status, Number.MAX_SAFE_INTEGER);
              }}
            >
              {ISSUE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="issue-assignee">Assignee · optional</label>
            <select
              id="issue-assignee"
              className="field-select"
              value={issue.assigneeId ?? ""}
              disabled={busy}
              onChange={(event) =>
                void updateMetadata({
                  assigneeId: event.target.value || null,
                })
              }
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="field-group issue-label-fieldset">
          <legend>Labels · optional</legend>
          {labels.length ? (
            <div className="issue-label-options">
              {labels.map((label) => {
                const checked = issue.labels.some(
                  (current) => current.id === label.id,
                );
                return (
                  <label key={label.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() => {
                        const labelIds = checked
                          ? issue.labels
                            .filter((current) => current.id !== label.id)
                            .map((current) => current.id)
                          : [...issue.labels.map((current) => current.id), label.id];
                        void updateMetadata({ labelIds });
                      }}
                    />
                    <span className="label-chip" data-color={label.color}>
                      {label.name}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="field-empty">No workspace labels yet.</p>
          )}
        </fieldset>

        <details className="card-secondary-actions"><summary>Move to another board or reorder</summary>
        <BoardTransfer issue={issue} boards={boards} disabled={busy} onTransfer={async boardId => {
          let moved = false;
          await act(async () => { moved = await onTransfer(issue.id, boardId); });
          return moved;
        }} />
        <section className="position-controls" aria-labelledby="position-title">
          <div>
            <h3 id="position-title">Position</h3>
            <p>
              {STATUS_META[issue.status].label}, card {issue.position + 1} of{" "}
              {columnLength}
            </p>
          </div>
          <div className="button-pair">
            <button
              type="button"
              className="secondary-button"
              disabled={busy || issue.position === 0}
              onClick={() =>
                void move(issue.status, issue.position - 1)
              }
            >
              <ArrowUp aria-hidden="true" size={16} />
              Earlier
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || issue.position >= columnLength - 1}
              onClick={() =>
                void move(issue.status, issue.position + 1)
              }
            >
              <ArrowDown aria-hidden="true" size={16} />
              Later
            </button>
          </div>
        </section>
        </details>

      </div>

      {sessionExpired && !draft.sessionExpired ? <div className="drawer-messages"><SessionRecovery /></div> : null}
      {feedback || operationError || operationStatus || copyMessage || copyFallback ? (
        <div className="drawer-messages">
          {feedback ? <div className="drawer-feedback"><p role="status">{feedback.message}</p>{feedback.undo ? <button type="button" className="secondary-button" disabled={busy} onClick={() => void act(() => feedback.undo?.())}>Undo</button> : null}</div> : null}
          {operationError ? <p className="drawer-error" role="alert">{operationError}</p> : null}
          {operationStatus ? <p role="status">{operationStatus}</p> : null}
          {copyMessage ? <p role="status">{copyMessage}</p> : null}
          {copyFallback ? <label className="copy-fallback">Card link<input readOnly value={copyFallback} onFocus={(event) => event.target.select()} /></label> : null}
        </div>
      ) : null}

      {draft.error || draft.recovered ? (
        <div className="draft-recovery">
          <p role={draft.error ? "alert" : "status"}>{draft.error || "Recovered unsaved changes from this tab. Review them before saving."}</p>
          {!draft.storageAvailable ? <p>This browser cannot retain your draft. Copy your text before leaving.</p> : null}
          <div>
            {draft.sessionExpired ? <button type="button" className="primary-button" disabled={busy || !draft.storageAvailable} onClick={signInAgain}>Sign in again</button> :
              <button type="button" className="primary-button" disabled={busy} onClick={() => void act(() => { })}>{draft.recovered ? "Save recovered changes" : "Retry save"}</button>}
            <button type="button" className="secondary-button" disabled={busy || saveState === "saving"} onClick={draft.discard}>Discard changes</button>
          </div>
        </div>
      ) : null}

      <div className="drawer-footer">
        <div className="save-state" role="status" aria-live="polite">
          {saveState === "idle" && !isDirty && !busy ? "Changes save automatically" : null}
          {saveState === "saving" || busy ? "Saving…" : null}
          {saveState === "saved" && !isDirty && !busy && !operationError ? (
            <>
              <Check aria-hidden="true" size={15} /> Saved
            </>
          ) : null}
          {saveState === "error" ? "Not saved" : operationError ? "Action failed" : null}
          {saveState === "idle" && isDirty ? "Unsaved changes" : null}
        </div>
        <div className="drawer-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => void copyLink()}
          >
            <Copy aria-hidden="true" size={16} />
            Copy link
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={busy}
            onClick={() => void act(async () => {
              if (!(await onArchive(issue.id))) setOperationError("Archive failed to confirm. Your current view is retained. Try again.");
            })}
          >
            <Archive aria-hidden="true" size={16} />
            Archive
          </button>
        </div>
      </div>
    </DetailDrawer>
  );
}
