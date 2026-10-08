"use client";

import { useState } from "react";
import { ArchiveRestore } from "lucide-react";

import { SessionRecovery } from "@/components/session-recovery";
import { DetailDrawer } from "@/components/detail-drawer";
import type { Issue } from "@/lib/types";
import { STATUS_META } from "@/lib/types";

type ArchiveDrawerProps = {
  issues: Issue[];
  sessionExpired: boolean;
  onClose: () => void;
  onOpen: (issue: Issue) => void;
  onRestore: (id: string) => Promise<boolean>;
};

export function ArchiveDrawer({
  issues,
  sessionExpired,
  onClose,
  onOpen,
  onRestore,
}: ArchiveDrawerProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [failedIssue, setFailedIssue] = useState<Issue | null>(null);
  const [restoredIssue, setRestoredIssue] = useState<Issue | null>(null);
  async function restore(issue: Issue) {
    if (pending) return;
    setPending(true);
    setError("");
    setRestoredIssue(null);
    const restored = await onRestore(issue.id);
    setPending(false);
    if (!restored) {
      setFailedIssue(issue);
      setError(`${issue.key}: Restore failed to confirm. Your archived view is retained.`);
    } else {
      setFailedIssue(null);
      setRestoredIssue(issue);
      window.setTimeout(() => document.querySelector<HTMLElement>('[data-show-restored]')?.focus(), 0);
    }
  }
  return (
    <DetailDrawer
      className="archive-drawer"
      closeLabel="Close archive"
      closeDisabled={pending}
      eyebrow="Recoverable history"
      onClose={() => { if (!pending) onClose(); }}
      title="Archive"
      titleId="archive-title"
    >
      <div className="drawer-body archive-list">
        {issues.length === 0 ? (
          <div className="archive-empty">
            <p>Nothing archived.</p>
            <span>Cards you archive can be restored from here.</span>
          </div>
        ) : (
          issues.map((issue) => (
            <article className="archive-item" key={issue.id}>
              <button type="button" data-archive-trigger={issue.id} disabled={pending} onClick={() => onOpen(issue)}>
                <span>{issue.key}</span>
                {issue.title}
              </button>
              <div>
                <span>{STATUS_META[issue.status].label}</span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={pending}
                  onClick={() => void restore(issue)}
                >
                  <ArchiveRestore aria-hidden="true" size={15} />
                  Restore
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      {error || restoredIssue || sessionExpired ? <div className="drawer-messages">
        {error ? <p className="drawer-error" role="alert">{error}</p> : null}
        {sessionExpired ? <SessionRecovery /> : null}
        {failedIssue ? <button type="button" className="secondary-button" disabled={pending} onClick={() => void restore(failedIssue)}>{pending ? "Restoring…" : "Retry restore"}</button> : null}
        {restoredIssue ? <><p role="status">{restoredIssue.key} restored to {STATUS_META[restoredIssue.status].label}.</p><button type="button" className="secondary-button" data-show-restored onClick={() => onOpen(restoredIssue)}>Show restored card</button></> : null}
      </div> : null}
    </DetailDrawer>
  );
}
