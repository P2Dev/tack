export const ISSUE_STATUSES = [
  "backlog",
  "ready",
  "in_progress",
  "done",
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const LABEL_COLORS = [
  "rust",
  "blue",
  "gold",
  "green",
  "slate",
  "violet",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

export type TeamMember = {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  color: LabelColor;
  role: "admin" | "member";
  disabled?: boolean;
};

export type Label = {
  id: string;
  name: string;
  color: LabelColor;
};

export type BoardInfo = {
  id: string;
  name: string;
  nextIssueNumber: number;
  activeCount: number;
  archivedCount: number;
  removedAt: string | null;
};

export type Issue = {
  revision: number;
  boardId: string;
  previousKeys: string[];
  id: string;
  key: string;
  number: number;
  title: string;
  description: string;
  status: IssueStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  assigneeId: string | null;
  assignee: TeamMember | null;
  labels: Label[];
};

export type BoardSnapshot = {
  board: BoardInfo;
  boards: BoardInfo[];
  active: Issue[];
  archived: Issue[];
  members: TeamMember[];
  labels: Label[];
};

export type IssuePatch = {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  labelIds?: string[];
};

export const STATUS_META: Record<
  IssueStatus,
  { label: string; shortLabel: string; description: string }
> = {
  backlog: {
    label: "Backlog",
    shortLabel: "Backlog",
    description: "Captured, not committed",
  },
  ready: {
    label: "Ready",
    shortLabel: "Ready",
    description: "A sensible next item",
  },
  in_progress: {
    label: "In progress",
    shortLabel: "In progress",
    description: "Actively being worked",
  },
  done: {
    label: "Done",
    shortLabel: "Done",
    description: "Tracking is complete",
  },
};
