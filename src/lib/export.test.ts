import { describe, expect, it } from "vitest";

import {
  createTackExport,
  escapeCsvCell,
  serializeIssuesCsv,
  type TackExport,
} from "@/lib/export";
import type { BoardSnapshot, TeamMember } from "@/lib/types";

const member: TeamMember = {
  id: "member-alex",
  email: "alex@example.local",
  displayName: "Alex Kim",
  initials: "AK",
  color: "rust",
  role: "admin",
};

const board = { id: "TCK", name: "Engineering board", nextIssueNumber: 3, activeCount: 1, archivedCount: 1, removedAt: null };
const snapshot: BoardSnapshot = {
  board, boards: [board],
  active: [
    {
      id: "issue-2",
      revision: 1, boardId: "TCK", previousKeys: [],
      key: "TCK-2",
      number: 2,
      title: '=HYPERLINK("https://example.invalid")',
      description: 'A comma, a "quote", and\na new line.',
      status: "ready",
      position: 0,
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-27T12:00:00.000Z",
      archivedAt: null,
      assigneeId: member.id,
      assignee: member,
      labels: [{ id: "label-bug", name: "Bug, urgent", color: "rust" }],
    },
  ],
  archived: [
    {
      id: "issue-1",
      revision: 1, boardId: "TCK", previousKeys: [],
      key: "TCK-1",
      number: 1,
      title: "Older card",
      description: "",
      status: "done",
      position: 0,
      createdAt: "2026-07-20T12:00:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z",
      archivedAt: "2026-07-22T12:00:00.000Z",
      assigneeId: null,
      assignee: null,
      labels: [],
    },
  ],
  members: [member],
  labels: [{ id: "label-bug", name: "Bug, urgent", color: "rust" }],
};

describe("Tack exports", () => {
  it("creates a stable snapshot without authentication secrets", async () => {
    const data = await createTackExport(
      {
        listActive: async () => snapshot.active,
        listArchived: async () => snapshot.archived,
        listLabels: async () => snapshot.labels,
        listBoards: async () => snapshot.boards,
        listMembers: async () => [
          member,
          {
            ...member,
            id: "member-disabled",
            email: "disabled@example.local",
            disabled: true,
          },
        ],
      },
      new Date("2026-07-27T15:30:00.000Z"),
    );

    expect(data.exportedAt).toBe("2026-07-27T15:30:00.000Z");
    expect(data.issues.map(({ key }) => key)).toEqual(["TCK-1", "TCK-2"]);
    expect(data.users[1].disabled).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/password|session|token/i);
  });

  it("quotes CSV values and neutralizes spreadsheet formulas", () => {
    expect(escapeCsvCell(" ordinary")).toBe('" ordinary"');
    expect(escapeCsvCell(" =1+1")).toBe('"\' =1+1"');

    const data: TackExport = {
      formatVersion: 2,
      boards: [board],
      exportedAt: "2026-07-27T15:30:00.000Z",
      workspace: { name: "Tack" },
      users: [{ ...member, disabled: false }],
      labels: snapshot.labels,
      issues: [
        {
          id: snapshot.active[0].id,
          boardId: "TCK", previousKeys: [],
          key: snapshot.active[0].key,
          number: snapshot.active[0].number,
          title: snapshot.active[0].title,
          description: snapshot.active[0].description,
          status: snapshot.active[0].status,
          position: snapshot.active[0].position,
          assigneeId: snapshot.active[0].assigneeId,
          labelIds: ["label-bug"],
          createdAt: snapshot.active[0].createdAt,
          updatedAt: snapshot.active[0].updatedAt,
          archivedAt: null,
        },
      ],
    };
    const csv = serializeIssuesCsv(data);

    expect(csv).toContain(
      '"\'=HYPERLINK(""https://example.invalid"")"',
    );
    expect(csv).toContain('"A comma, a ""quote"", and\na new line."');
    expect(csv).toContain('"Bug, urgent"');
  });
});
