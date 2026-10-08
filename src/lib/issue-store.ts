import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { QueryClient } from "@/lib/database";
import { getDatabase, withTransaction } from "@/lib/database";
import type {
  BoardInfo,
  BoardSnapshot,
  Issue,
  IssuePatch,
  IssueStatus,
  Label,
  LabelColor,
  TeamMember,
} from "@/lib/types";
import {
  createBoardSchema,
  transferIssueSchema,
  createIssueSchema,
  createLabelSchema,
  moveIssueSchema,
  updateIssueSchema,
} from "@/lib/validation";

import { DomainError } from "@/lib/domain-error";

type IssueRow = {
  revision: number;
  board_id: string;
  id: string;
  public_number: number;
  title: string;
  description: string;
  status: IssueStatus;
  position: number;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
  assignee_id: string | null;
};

type MemberRow = {
  id: string;
  email: string;
  display_name: string;
  initials: string;
  color: LabelColor;
  role: "admin" | "member";
  banned: boolean;
};

type LabelRow = {
  id: string;
  name: string;
  color: LabelColor;
};

type IssueLabelRow = LabelRow & {
  issue_id: string;
};

function toMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    initials: row.initials,
    color: row.color,
    role: row.role,
    disabled: row.banned,
  };
}

function toLabel(row: LabelRow): Label {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  };
}

function iso(value: Date | string | null) {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

export class IssueStore {
  constructor(
    private readonly database: QueryClient,
    private readonly pool: Pool,
    private readonly inTransaction = false,
  ) {}

  private transact<T>(operation: (client: QueryClient) => Promise<T>): Promise<T> {
    return this.inTransaction ? operation(this.database) : withTransaction(operation, this.pool);
  }

  async listMembers(options: { includeDisabled?: boolean } = {}) {
    const result = await this.database.query<MemberRow>(
      `SELECT
         id,
         email,
         name AS display_name,
         initials,
         color,
         CASE WHEN role = 'admin' THEN 'admin' ELSE 'member' END AS role,
         COALESCE(banned, FALSE) AS banned
       FROM "user"
       ${options.includeDisabled ? "" : "WHERE COALESCE(banned, FALSE) = FALSE"}
       ORDER BY LOWER(name)`,
    );

    return result.rows.map(toMember);
  }

  async listLabels() {
    const result = await this.database.query<LabelRow>(
      `SELECT id, name, color
       FROM labels
       ORDER BY LOWER(name)`,
    );
    return result.rows.map(toLabel);
  }

  private async hydrateIssues(rows: IssueRow[]): Promise<Issue[]> {
    if (rows.length === 0) {
      return [];
    }

    const [members, labelResult, keyResult] = await Promise.all([
      this.listMembers({ includeDisabled: true }),
      this.database.query<IssueLabelRow>(
        `SELECT il.issue_id, labels.id, labels.name, labels.color
         FROM issue_labels AS il
         INNER JOIN labels ON labels.id = il.label_id
         WHERE il.issue_id = ANY($1::TEXT[])
         ORDER BY LOWER(labels.name)`,
        [rows.map(({ id }) => id)],
      ),
      this.database.query<{ key: string; issue_id: string }>("SELECT key, issue_id FROM issue_keys WHERE issue_id = ANY($1::TEXT[])", [rows.map(({ id }) => id)]),
    ]);
    const membersById = new Map(members.map((member) => [member.id, member]));
    const labelsByIssue = new Map<string, Label[]>();

    for (const row of labelResult.rows) {
      const labels = labelsByIssue.get(row.issue_id) ?? [];
      labels.push(toLabel(row));
      labelsByIssue.set(row.issue_id, labels);
    }

    return rows.map((row) => ({
      id: row.id,
      revision: row.revision,
      key: `${row.board_id}-${row.public_number}`,
      boardId: row.board_id,
      previousKeys: keyResult.rows.filter(key => key.issue_id === row.id && key.key !== `${row.board_id}-${row.public_number}`).map(key => key.key),
      number: row.public_number,
      title: row.title,
      description: row.description,
      status: row.status,
      position: row.position,
      createdAt: iso(row.created_at) as string,
      updatedAt: iso(row.updated_at) as string,
      archivedAt: iso(row.archived_at),
      assigneeId: row.assignee_id,
      assignee: row.assignee_id
        ? (membersById.get(row.assignee_id) ?? null)
        : null,
      labels: labelsByIssue.get(row.id) ?? [],
    }));
  }

  async listActive(boardId?: string) {
    const result = await this.database.query<IssueRow>(
      `SELECT *
       FROM issues
       WHERE archived_at IS NULL AND ($1::TEXT IS NULL OR board_id = $1)
       ORDER BY
         CASE status
           WHEN 'backlog' THEN 0
           WHEN 'ready' THEN 1
           WHEN 'in_progress' THEN 2
           ELSE 3
         END,
         board_id, position`,
      [boardId ?? null],
    );

    return this.hydrateIssues(result.rows);
  }

  async listArchived(boardId?: string) {
    const result = await this.database.query<IssueRow>(
      `SELECT *
       FROM issues
       WHERE archived_at IS NOT NULL AND ($1::TEXT IS NULL OR board_id = $1)
       ORDER BY archived_at DESC, public_number DESC`,
      [boardId ?? null],
    );

    return this.hydrateIssues(result.rows);
  }

  async listBoards(includeRemoved = false): Promise<BoardInfo[]> {
    const result = await this.database.query<BoardInfo>(`SELECT id, name, next_issue_number AS "nextIssueNumber", removed_at AS "removedAt",
      (SELECT COUNT(*)::INT FROM issues WHERE board_id = boards.id AND archived_at IS NULL) AS "activeCount",
      (SELECT COUNT(*)::INT FROM issues WHERE board_id = boards.id AND archived_at IS NOT NULL) AS "archivedCount" FROM boards ${includeRemoved ? "" : "WHERE removed_at IS NULL"} ORDER BY CASE WHEN id = 'TCK' THEN 0 ELSE 1 END, name, id`);
    return result.rows.map(board => ({ ...board, removedAt: iso(board.removedAt) }));
  }

  async snapshot(boardId?: string): Promise<BoardSnapshot> {
    const boards = await this.listBoards();
    const board = boardId ? boards.find(board => board.id === boardId) : boards[0];
    if (!board) throw new DomainError("That board is no longer available. Choose another board.", 404);
    const [active, archived, members, labels] = await Promise.all([
      this.listActive(board.id), this.listArchived(board.id), this.listMembers(), this.listLabels(),
    ]);
    return { board, boards, active, archived, members, labels };
  }

  async createBoard(input: { id: string; name: string }) {
    const parsed = createBoardSchema.parse(input);
    return this.transact(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))");
      const existing = await client.query("SELECT 1 FROM boards WHERE id = $1", [parsed.id]);
      if (existing.rowCount) throw new DomainError("That board ID has already been used. Choose another ID.");
      await client.query("INSERT INTO boards (id, name) VALUES ($1, $2)", [parsed.id, parsed.name]);
      return (await new IssueStore(client, this.pool, true).listBoards()).find(board => board.id === parsed.id)!;
    });
  }

  async removeBoard(id: string) {
    return this.transact(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))");
      const boards = await new IssueStore(client, this.pool, true).listBoards();
      if (!boards.some(board => board.id === id)) throw new DomainError("That board is no longer available.", 404);
      if (boards.length === 1) throw new DomainError("Keep at least one board in this workspace.");
      const issues = await client.query("SELECT 1 FROM issues WHERE board_id = $1 LIMIT 1", [id]);
      if (issues.rowCount) throw new DomainError("Move all active and archived cards to another board before removing this board.");
      await client.query("UPDATE boards SET removed_at = NOW() WHERE id = $1", [id]);
    });
  }

  private assertBoard(issue: Issue, boardId?: string) {
    if (boardId && issue.boardId !== boardId) throw new DomainError("This card has moved to another board. Reopen its link to continue.");
  }

  async get(id: string) {
    const result = await this.database.query<IssueRow>(
      "SELECT * FROM issues WHERE id = $1",
      [id],
    );
    return result.rows[0]
      ? (await this.hydrateIssues([result.rows[0]]))[0]
      : null;
  }

  async getByKey(key: string) {
    if (!/^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/i.test(key)) return null;
    const result = await this.database.query<IssueRow>(
      "SELECT issues.* FROM issues JOIN issue_keys ON issue_keys.issue_id = issues.id WHERE issue_keys.key = $1", [key.toUpperCase()],
    );
    return result.rows[0] ? (await this.hydrateIssues([result.rows[0]]))[0] : null;
  }

  private async allocateNumber(client: QueryClient, boardId: string) {
    const result = await client.query<{ number: number }>(`UPDATE boards SET next_issue_number = next_issue_number + 1 WHERE id = $1 AND removed_at IS NULL RETURNING next_issue_number - 1 AS number`, [boardId]);
    if (!result.rows[0]) throw new DomainError("That board is no longer available.", 404);
    return result.rows[0].number;
  }

  async create(input: { title: string; status: IssueStatus; boardId?: string }) {
    const parsed = createIssueSchema.parse(input);
    return this.transact(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))");
      const store = new IssueStore(client, this.pool, true);
      const boardId = parsed.boardId ?? (await store.listBoards())[0]?.id;
      if (!boardId) throw new DomainError("Choose an available board.", 404);
      const number = await this.allocateNumber(client, boardId);
      const position = await client.query<{ count: number }>("SELECT COUNT(*)::INT AS count FROM issues WHERE board_id = $1 AND status = $2 AND archived_at IS NULL", [boardId, parsed.status]);
      const id = randomUUID();
      await client.query(`INSERT INTO issues (id, board_id, public_number, title, description, status, position, created_at, updated_at) VALUES ($1, $2, $3, $4, '', $5, $6, NOW(), NOW())`, [id, boardId, number, parsed.title, parsed.status, position.rows[0].count]);
      await client.query("INSERT INTO issue_keys (key, issue_id) VALUES ($1, $2)", [`${boardId}-${number}`, id]);
      return (await store.get(id))!;
    });
  }

  async transfer(id: string, input: { boardId: string; fromBoardId: string }) {
    const parsed = transferIssueSchema.parse(input);
    return this.transact(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))");
      await client.query("SELECT id FROM issues WHERE id = $1 FOR UPDATE", [id]);
      const store = new IssueStore(client, this.pool, true);
      const issue = await store.get(id);
      if (!issue) return null;
      if (issue.boardId === parsed.boardId) return issue; // Safe retry after a lost response.
      this.assertBoard(issue, parsed.fromBoardId);
      const number = await this.allocateNumber(client, parsed.boardId);
      let position = issue.position;
      if (!issue.archivedAt) {
        await client.query("UPDATE issues SET position = position - 1 WHERE board_id = $1 AND status = $2 AND archived_at IS NULL AND position > $3", [issue.boardId, issue.status, issue.position]);
        const target = await client.query<{ count: number }>("SELECT COUNT(*)::INT AS count FROM issues WHERE board_id = $1 AND status = $2 AND archived_at IS NULL", [parsed.boardId, issue.status]);
        position = target.rows[0].count;
      }
      await client.query("UPDATE issues SET board_id = $1, public_number = $2, position = $3, updated_at = NOW() WHERE id = $4", [parsed.boardId, number, position, id]);
      await client.query("INSERT INTO issue_keys (key, issue_id) VALUES ($1, $2)", [`${parsed.boardId}-${number}`, id]);
      return (await store.get(id))!;
    });
  }

  async update(id: string, patch: IssuePatch, boardId?: string) {
    const parsed = updateIssueSchema.parse(patch);

    return this.transact(async (client) => {
      const transactionStore = new IssueStore(client, this.pool, true);
      const existing = await client.query(
        "SELECT 1 FROM issues WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (existing.rowCount === 0) {
        return null;
      }

      this.assertBoard((await transactionStore.get(id))!, boardId);
      const hasAssignee = Object.hasOwn(parsed, "assigneeId");
      if (hasAssignee && parsed.assigneeId) {
        const assignee = await client.query(
          `SELECT 1
           FROM "user"
           WHERE id = $1 AND COALESCE(banned, FALSE) = FALSE`,
          [parsed.assigneeId],
        );
        if (assignee.rowCount === 0) {
          throw new DomainError("Unknown assignee.", 400);
        }
      }

      if (parsed.labelIds) {
        const knownLabels = await client.query<{ count: number }>(
          `SELECT COUNT(*)::INT AS count
           FROM labels
           WHERE id = ANY($1::TEXT[])`,
          [parsed.labelIds],
        );
        if (knownLabels.rows[0].count !== parsed.labelIds.length) {
          throw new DomainError("Unknown label.", 400);
        }
      }

      await client.query(
        `UPDATE issues
         SET
           title = CASE WHEN $1::BOOLEAN THEN $2 ELSE title END,
           description = CASE WHEN $3::BOOLEAN THEN $4 ELSE description END,
           assignee_id = CASE WHEN $5::BOOLEAN THEN $6 ELSE assignee_id END,
           updated_at = NOW()
         WHERE id = $7`,
        [
          parsed.title !== undefined,
          parsed.title ?? "",
          parsed.description !== undefined,
          parsed.description ?? "",
          hasAssignee,
          parsed.assigneeId ?? null,
          id,
        ],
      );

      if (parsed.labelIds) {
        await client.query("DELETE FROM issue_labels WHERE issue_id = $1", [
          id,
        ]);
        for (const labelId of parsed.labelIds) {
          await client.query(
            `INSERT INTO issue_labels (issue_id, label_id)
             VALUES ($1, $2)`,
            [id, labelId],
          );
        }
      }

      return transactionStore.get(id);
    });
  }

  async createLabel(input: { name: string; color: LabelColor }) {
    const parsed = createLabelSchema.parse(input);
    const id = randomUUID();
    const result = await this.database.query<LabelRow>(
      `INSERT INTO labels (id, name, color, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, color`,
      [id, parsed.name, parsed.color],
    );

    return toLabel(result.rows[0]);
  }

  async deleteLabel(id: string) {
    const result = await this.database.query(
      "DELETE FROM labels WHERE id = $1",
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async move(id: string, input: { status: IssueStatus; position: number }, boardId?: string) {
    const parsed = moveIssueSchema.parse(input);

    return this.transact(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))",
      );
      const transactionStore = new IssueStore(client, this.pool, true);
      const current = await transactionStore.get(id);
      if (current) this.assertBoard(current, boardId);
      if (!current || current.archivedAt) {
        return null;
      }

      const targetCountResult = await client.query<{ count: number }>(
        `SELECT COUNT(*)::INT AS count
         FROM issues
         WHERE board_id = (SELECT board_id FROM issues WHERE id = $3) AND status = $1 AND archived_at IS NULL AND id <> $2`,
            [parsed.status, id, id],
      );
      const targetPosition = Math.min(
        parsed.position,
        targetCountResult.rows[0].count,
      );

      if (current.status === parsed.status) {
        if (targetPosition === current.position) {
          return current;
        }

        if (targetPosition < current.position) {
          await client.query(
            `UPDATE issues
             SET position = position + 1
             WHERE board_id = (SELECT board_id FROM issues WHERE id = $5) AND status = $1
               AND archived_at IS NULL
               AND id <> $2
               AND position >= $3
               AND position < $4`,
            [current.status, id, targetPosition, current.position, id],
          );
        } else {
          await client.query(
            `UPDATE issues
             SET position = position - 1
             WHERE board_id = (SELECT board_id FROM issues WHERE id = $5) AND status = $1
               AND archived_at IS NULL
               AND id <> $2
               AND position > $3
               AND position <= $4`,
            [current.status, id, current.position, targetPosition, id],
          );
        }
      } else {
        await client.query(
          `UPDATE issues
           SET position = position - 1
           WHERE board_id = (SELECT board_id FROM issues WHERE id = $3) AND status = $1
             AND archived_at IS NULL
             AND position > $2`,
            [current.status, current.position, id],
        );
        await client.query(
          `UPDATE issues
           SET position = position + 1
           WHERE board_id = (SELECT board_id FROM issues WHERE id = $3) AND status = $1
             AND archived_at IS NULL
             AND position >= $2`,
            [parsed.status, targetPosition, id],
        );
      }

      await client.query(
        `UPDATE issues
         SET status = $1, position = $2, updated_at = NOW()
         WHERE id = $3`,
        [parsed.status, targetPosition, id],
      );

      return transactionStore.get(id);
    });
  }

  async archive(id: string, boardId?: string) {
    return this.transact(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))",
      );
      const transactionStore = new IssueStore(client, this.pool, true);
      const current = await transactionStore.get(id);
      if (current) this.assertBoard(current, boardId);
      if (!current || current.archivedAt) {
        return current;
      }

      await client.query(
        `UPDATE issues
         SET position = position - 1
         WHERE board_id = (SELECT board_id FROM issues WHERE id = $3) AND status = $1
           AND archived_at IS NULL
           AND position > $2`,
            [current.status, current.position, id],
      );
      const result = await client.query(
        `UPDATE issues
         SET archived_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [id],
      );

      return result.rowCount ? transactionStore.get(id) : null;
    });
  }

  async restore(id: string, boardId?: string) {
    return this.transact(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))",
      );
      const transactionStore = new IssueStore(client, this.pool, true);
      const current = await transactionStore.get(id);
      if (current) this.assertBoard(current, boardId);
      if (!current || !current.archivedAt) {
        return current;
      }

      const countResult = await client.query<{ count: number }>(
        `SELECT COUNT(*)::INT AS count
         FROM issues
         WHERE board_id = (SELECT board_id FROM issues WHERE id = $2) AND status = $1 AND archived_at IS NULL`,
            [current.status, id],
      );
      const targetPosition = Math.min(
        current.position,
        countResult.rows[0].count,
      );

      await client.query(
        `UPDATE issues
         SET position = position + 1
         WHERE board_id = (SELECT board_id FROM issues WHERE id = $3) AND status = $1
           AND archived_at IS NULL
           AND position >= $2`,
            [current.status, targetPosition, id],
      );
      await client.query(
        `UPDATE issues
         SET position = $1, archived_at = NULL, updated_at = NOW()
         WHERE id = $2`,
        [targetPosition, id],
      );

      return transactionStore.get(id);
    });
  }
}

export function createIssueStore(database: Pool = getDatabase()) {
  return new IssueStore(database, database);
}
