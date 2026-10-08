"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { useCaptureDraft } from "@/hooks/use-capture-draft";
import { IssueCard } from "@/components/issue-card";
import type { Issue, IssueStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/types";

type BoardColumnProps = {
  status: IssueStatus;
  memberId: string;
  boardId: string;
  issues: Issue[];
  totalCount: number;
  isFiltered: boolean;
  activeIssueId: string | null;
  selectedIssueId: string | null;
  mobileStatus: IssueStatus;
  onClearFilters: () => void;
  onRefresh: () => Promise<void>;
  onCreate: (title: string, status: IssueStatus) => Promise<void>;
  onOpen: (issue: Issue) => void;
  onMoveToStatus: (id: string, status: IssueStatus) => void;
};

export function BoardColumn({
  status,
  memberId,
  boardId,
  issues,
  totalCount,
  isFiltered,
  activeIssueId,
  selectedIssueId,
  mobileStatus,
  onClearFilters,
  onRefresh,
  onCreate,
  onOpen,
  onMoveToStatus,
}: BoardColumnProps) {
  const capture = useCaptureDraft(memberId, boardId, status);
  const { title } = capture;
  const setTitle = capture.change;
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${status}`,
    data: { type: "column", status },
  });
  const meta = STATUS_META[status];

  async function submitIssue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || isCreating) {
      return;
    }

    setIsCreating(true);
    setError("");
    try {
      await onCreate(nextTitle, status);
      setTitle("");
    } catch {
      setError("Couldn’t confirm the new card. Your title is still here. Check the board before trying again.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section
      ref={setNodeRef}
      className="board-column"
      data-status={status}
      data-active={mobileStatus === status}
      data-drop-target={isOver}
      aria-labelledby={`heading-${status}`}
    >
      <header className="column-header">
        <div>
          <h2 id={`heading-${status}`}>{meta.label}</h2>
          <p>{meta.description}</p>
        </div>
        <span
          className="issue-count"
          aria-label={
            isFiltered
              ? `${issues.length} of ${totalCount} issues shown`
              : `${issues.length} issues`
          }
        >
          {isFiltered ? `${issues.length}/${totalCount}` : issues.length}
        </span>
      </header>

      <form className="quick-add" onSubmit={submitIssue}>
        <label className="visually-hidden" htmlFor={`quick-add-${status}`}>
          Add a card to {meta.label}
        </label>
        <Plus aria-hidden="true" size={16} strokeWidth={2} />
        <input
          id={`quick-add-${status}`}
          data-quick-add={status}
          data-draft-retained={capture.storageAvailable}
          value={title}
          maxLength={180}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a card…"
          autoComplete="off"
          disabled={isCreating}
        />
        <button type="submit" disabled={!title.trim() || isCreating}>
          {isCreating ? "Adding…" : "Add"}
        </button>
      </form>
      {capture.recovered ? <p className="capture-draft-notice" role="status">Recovered unsent title. <button type="button" onClick={() => setTitle("")}>Discard draft</button></p> : null}
      {!capture.storageAvailable && title ? <p className="capture-draft-notice" role="alert">Draft storage is unavailable. Copy this title before leaving.</p> : null}
      {error ? (
        <div className="capture-error"><p className="inline-error" role="alert">{error}</p><button type="button" className="secondary-button" onClick={() => void onRefresh()}>Check board</button></div>
      ) : null}

      <SortableContext
        items={issues.map((issue) => issue.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="issue-list">
          {issues.length === 0 ? (
            <div className="column-empty">
              <p>{isFiltered ? `No matching cards in ${meta.label}.` : "Nothing here yet. Add a card above."}</p>
              {isFiltered ? <button type="button" onClick={onClearFilters}>Clear filters</button> : null}
            </div>
          ) : null}
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              isDragging={activeIssueId === issue.id}
              isSelected={selectedIssueId === issue.id}
              onOpen={onOpen}
              onMoveToStatus={onMoveToStatus}
            />
          ))}
        </div>
      </SortableContext>


    </section>
  );
}
