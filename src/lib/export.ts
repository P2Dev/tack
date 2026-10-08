import type { IssueStore } from "@/lib/issue-store";
import type {
  BoardInfo,
  IssueStatus,
  Label,
  LabelColor,
  TeamMember,
} from "@/lib/types";

export type TackExportUser = {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  color: LabelColor;
  role: "admin" | "member";
  disabled: boolean;
};

export type TackExportIssue = {
  boardId: string;
  previousKeys: string[];
  id: string;
  key: string;
  number: number;
  title: string;
  description: string;
  status: IssueStatus;
  position: number;
  assigneeId: string | null;
  labelIds: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type TackExport = {
  formatVersion: 2;
  exportedAt: string;
  workspace: {
    name: "Tack";
  };
  boards: BoardInfo[];
  users: TackExportUser[];
  labels: Label[];
  issues: TackExportIssue[];
};

type ExportStore = Pick<IssueStore, "listMembers" | "listActive" | "listArchived" | "listLabels" | "listBoards">;

function exportUser(member: TeamMember): TackExportUser {
  return {
    id: member.id,
    email: member.email,
    displayName: member.displayName,
    initials: member.initials,
    color: member.color,
    role: member.role,
    disabled: Boolean(member.disabled),
  };
}

export async function createTackExport(
  store: ExportStore,
  now = new Date(),
): Promise<TackExport> {
  const [active, archived, labels, boards, members] = await Promise.all([
    store.listActive(), store.listArchived(), store.listLabels(), store.listBoards(true),
    store.listMembers({ includeDisabled: true }),
  ]);
  const issues = [...active, ...archived]
    .sort((left, right) => left.boardId.localeCompare(right.boardId) || left.number - right.number)
    .map((issue) => ({
      id: issue.id,
      boardId: issue.boardId,
      previousKeys: issue.previousKeys,
      key: issue.key,
      number: issue.number,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      position: issue.position,
      assigneeId: issue.assigneeId,
      labelIds: issue.labels.map(({ id }) => id),
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      archivedAt: issue.archivedAt,
    }));

  return {
    formatVersion: 2,
    exportedAt: now.toISOString(),
    workspace: {
      name: "Tack",
    },
    boards,
    users: members.map(exportUser),
    labels,
    issues,
  };
}

export function escapeCsvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  // A leading apostrophe keeps spreadsheet programs from evaluating user text.
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function serializeIssuesCsv(data: TackExport) {
  const usersById = new Map(data.users.map((user) => [user.id, user]));
  const labelsById = new Map(data.labels.map((label) => [label.id, label]));
  const rows: Array<Array<string | number | null>> = [
    [
      "id",
      "key",
      "board_id",
      "previous_keys",
      "number",
      "title",
      "description",
      "status",
      "position",
      "assignee_id",
      "assignee_name",
      "assignee_email",
      "label_ids",
      "labels",
      "created_at",
      "updated_at",
      "archived_at",
    ],
  ];

  for (const issue of data.issues) {
    const assignee = issue.assigneeId
      ? usersById.get(issue.assigneeId)
      : undefined;
    rows.push([
      issue.id,
      issue.key,
      issue.boardId,
      issue.previousKeys.join(" | "),
      issue.number,
      issue.title,
      issue.description,
      issue.status,
      issue.position,
      issue.assigneeId,
      assignee?.displayName ?? "",
      assignee?.email ?? "",
      issue.labelIds.join(" | "),
      issue.labelIds
        .map((id) => labelsById.get(id)?.name ?? id)
        .join(" | "),
      issue.createdAt,
      issue.updatedAt,
      issue.archivedAt,
    ]);
  }

  return `${rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\r\n")}\r\n`;
}
