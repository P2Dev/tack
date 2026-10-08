"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useSyncExternalStore } from "react";

import type { Issue, IssueStatus } from "@/lib/types";
import { ISSUE_STATUSES, STATUS_META } from "@/lib/types";

const subscribeToHydration = () => () => {};

type IssueCardProps = {
  issue: Issue;
  isDragging?: boolean;
  isSelected?: boolean;
  overlay?: boolean;
  onOpen?: (issue: Issue) => void;
  onMoveToStatus?: (id: string, status: IssueStatus) => void;
};

export function IssueCard({
  issue,
  isDragging = false,
  isSelected = false,
  overlay = false,
  onOpen,
  onMoveToStatus,
}: IssueCardProps) {
  // React must attach the change handler before the server-rendered select is usable.
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: issue.id,
    data: { type: "issue", status: issue.status },
    disabled: overlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="issue-card"
      data-dragging={isDragging}
      data-selected={isSelected}
      data-overlay={overlay}
    >
      <div className="card-topline">
        <span className="issue-key">{issue.key}</span>
        {!overlay ? (
          <button
            type="button"
            className="drag-handle"
            aria-label={`Drag ${issue.key} to reorder or change status`}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" size={17} />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="card-title"
        data-issue-trigger={issue.id}
        onClick={() => onOpen?.(issue)}
        disabled={overlay}
      >
        {issue.title}
      </button>
      {issue.labels.length || issue.assignee ? (
        <div className="card-metadata">
          <div className="card-labels" aria-label="Labels">
            {issue.labels.slice(0, 2).map((label) => (
              <span
                className="label-chip"
                data-color={label.color}
                key={label.id}
              >
                {label.name}
              </span>
            ))}
            {issue.labels.length > 2 ? (
              <span className="label-overflow">
                +{issue.labels.length - 2}
                <span className="visually-hidden"> more labels</span>
              </span>
            ) : null}
          </div>
          {issue.assignee ? (
            <span
              className="member-avatar"
              data-color={issue.assignee.color}
              title={`Assigned to ${issue.assignee.displayName}`}
              aria-label={`Assigned to ${issue.assignee.displayName}`}
            >
              {issue.assignee.initials}
            </span>
          ) : null}
        </div>
      ) : null}
      {!overlay ? (
        <div className="card-footer">
          <span className="card-note">
            {issue.description ? "Has description" : ""}
          </span>
          <label className="visually-hidden" htmlFor={`status-${issue.id}`}>
            Move {issue.key}
          </label>
          <select
            id={`status-${issue.id}`}
            className="card-status"
            value={issue.status}
            disabled={!hydrated}
            onChange={(event) =>
              onMoveToStatus?.(
                issue.id,
                event.target.value as IssueStatus,
              )
            }
          >
            {ISSUE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_META[status].label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </article>
  );
}
