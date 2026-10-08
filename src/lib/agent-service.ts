import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { getDatabase, withTransaction } from "@/lib/database";
import { IssueStore } from "@/lib/issue-store";
import {
  AgentError,
  allowBoard,
  requireScope,
  type AgentPrincipal,
  type KeyScope,
} from "@/lib/agent-contract";
import {
  boardIdSchema,
  createIssueSchema,
  issueStatusSchema,
  moveIssueSchema,
  transferIssueSchema,
  updateIssueSchema,
} from "@/lib/validation";
import type { Issue } from "@/lib/types";

const revisionSchema = z.number().int().positive();
const idempotencySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_.:-]+$/);
export type AgentCall = {
  method: string;
  path: string[];
  query: URLSearchParams;
  body?: unknown;
  idempotencyKey?: string | null;
  requestId: string;
};
function cardView(issue: Issue, principal: AgentPrincipal) {
  return {
    ...issue,
    previousKeys: issue.previousKeys.filter((key) =>
      allowBoard(principal, key.slice(0, key.lastIndexOf("-"))),
    ),
    assignee: issue.assignee
      ? { id: issue.assignee.id, displayName: issue.assignee.displayName }
      : null,
    url: new URL(
      `/?board=${issue.boardId}&issue=${issue.key}`,
      process.env.BETTER_AUTH_URL || "http://localhost:3000",
    ).href,
  };
}
function missing(): never {
  throw new AgentError(
    404,
    "not_found",
    "That card or board is unavailable to this key.",
  );
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export async function agentOperation(
  principal: AgentPrincipal,
  call: AgentCall,
  pool: Pool = getDatabase(),
) {
  return withTransaction(async (client) => {
    // Keep authorization current while a mutation is running; revoke/disable waits for this transaction.
    const live = await client.query(
      `SELECT k.scopes,k.board_ids FROM agent_keys k JOIN "user" u ON u.id=k.user_id
      WHERE k.id=$1 AND k.user_id=$2 AND k.revoked_at IS NULL AND k.expires_at>NOW() AND NOT u.banned FOR SHARE OF k,u`,
      [principal.keyId, principal.userId],
    );
    if (!live.rows[0])
      throw new AgentError(
        401,
        "invalid_credentials",
        "This key or its owner is no longer active.",
      );
    const actor: AgentPrincipal = {
      ...principal,
      scopes: live.rows[0].scopes,
      boardIds: live.rows[0].board_ids,
    };
    const store = new IssueStore(client, pool, true);
    const [resource, id, action] = call.path;
    const read = call.method === "GET";
    requireScope(actor, "read");
    if (read) {
      if (resource === "me" && call.path.length === 1)
        return { status: 200, data: actor };
      if (resource === "boards" && call.path.length === 1)
        return {
          status: 200,
          data: {
            boards: (await store.listBoards())
              .filter((board) => allowBoard(actor, board.id))
              .map(({ id, name, activeCount, archivedCount }) => ({
                id,
                name,
                activeCount,
                archivedCount,
              })),
          },
        };
      if (
        resource === "boards" &&
        action === "metadata" &&
        call.path.length === 3
      ) {
        const boardId = boardIdSchema.parse(id);
        if (
          !allowBoard(actor, boardId) ||
          !(await store.listBoards()).some((board) => board.id === boardId)
        )
          missing();
        return {
          status: 200,
          data: {
            labels: await store.listLabels(),
            assignees: (await store.listMembers()).map(
              ({ id, displayName }) => ({ id, displayName }),
            ),
          },
        };
      }
      if (resource === "cards" && call.path.length === 2) {
        const issue = (await store.getByKey(id)) ?? (await store.get(id));
        if (!issue || !allowBoard(actor, issue.boardId)) missing();
        return { status: 200, data: cardView(issue, actor) };
      }
      if (resource === "cards" && call.path.length === 1) {
        const query = z
          .object({
            board: z.string().optional(),
            q: z.string().max(180).default(""),
            status: issueStatusSchema.optional(),
            archived: z.enum(["false", "true", "all"]).default("false"),
            limit: z.coerce.number().int().min(1).max(100).default(50),
            offset: z.coerce.number().int().min(0).max(100000).default(0),
          })
          .parse(Object.fromEntries(call.query));
        const boardId = query.board ? boardIdSchema.parse(query.board) : null;
        if (boardId && !allowBoard(actor, boardId)) missing();
        const rows = await client.query<{ id: string }>(
          `SELECT i.id FROM issues i WHERE ($1::TEXT[] IS NULL OR i.board_id=ANY($1))
          AND ($2::TEXT IS NULL OR i.board_id=$2) AND ($3::TEXT IS NULL OR i.status=$3)
          AND ($4='all' OR (i.archived_at IS NOT NULL)=($4='true'))
          AND ($5='' OR i.title ILIKE '%' || $5 || '%' OR EXISTS(SELECT 1 FROM issue_keys k WHERE k.issue_id=i.id AND LOWER(k.key)=LOWER($6)))
          ORDER BY i.board_id,i.public_number LIMIT $7 OFFSET $8`,
          [
            actor.boardIds,
            boardId,
            query.status ?? null,
            query.archived,
            query.q.replace(/[\\%_]/g, "\\$&"),
            query.q,
            query.limit + 1,
            query.offset,
          ],
        );
        const cards = [];
        for (const row of rows.rows.slice(0, query.limit)) {
          const card = await store.get(row.id);
          if (card && allowBoard(actor, card.boardId))
            cards.push(cardView(card, actor));
        }
        return {
          status: 200,
          data: {
            cards,
            nextOffset:
              rows.rows.length > query.limit
                ? query.offset + query.limit
                : null,
          },
        };
      }
      throw new AgentError(404, "not_found", "Unknown API operation.");
    }
    if (resource !== "cards" || call.path.length > 3)
      throw new AgentError(404, "not_found", "Unknown API operation.");
    const scope: KeyScope =
      action === "transfer"
        ? "transfer"
        : action === "archive" || action === "restore"
          ? "archive"
          : "write";
    requireScope(actor, scope);
    // Match the store's ordering lock before locking cards to prevent lock-order inversions.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('tack-board-order'))",
    );
    const requestKey = idempotencySchema.parse(call.idempotencyKey);
    const fingerprint = createHash("sha256")
      .update(
        canonical({ method: call.method, path: call.path, body: call.body }),
      )
      .digest("hex");
    await client.query("DELETE FROM agent_requests WHERE expires_at<=NOW()");
    const previous = await client.query(
      "SELECT * FROM agent_requests WHERE key_id=$1 AND request_key=$2",
      [actor.keyId, requestKey],
    );
    if (previous.rows[0]) {
      const saved = previous.rows[0];
      if (saved.fingerprint !== fingerprint)
        throw new AgentError(
          409,
          "idempotency_conflict",
          "Use a new Idempotency-Key for different input.",
        );
      const current = await store.get(saved.issue_id);
      if (
        !current ||
        !allowBoard(actor, current.boardId) ||
        !saved.board_ids.every((board: string) => allowBoard(actor, board))
      )
        missing();
      return { status: saved.status, data: saved.response, replayed: true };
    }
    let issue: Issue | null = null;
    let status = 200;
    let affectedBoards: string[] = [];
    if (call.method === "POST" && call.path.length === 1) {
      const input = createIssueSchema
        .extend({ boardId: boardIdSchema })
        .strict()
        .parse(call.body);
      if (!allowBoard(actor, input.boardId)) missing();
      issue = await store.create(input);
      status = 201;
      affectedBoards = [input.boardId];
    } else {
      if (!id) missing();
      await client.query("SELECT id FROM issues WHERE id=$1 FOR UPDATE", [id]);
      const current = await store.get(id);
      if (!current || !allowBoard(actor, current.boardId)) missing();
      const { revision, ...payload } = z
        .object({ revision: revisionSchema })
        .passthrough()
        .parse(call.body);
      if (revision !== current.revision)
        throw new AgentError(
          409,
          "revision_conflict",
          "The card changed. Read it again before editing.",
        );
      affectedBoards = [current.boardId];
      if (call.method === "PATCH" && call.path.length === 2)
        issue = await store.update(
          id,
          updateIssueSchema.strict().parse(payload),
          current.boardId,
        );
      else if (call.method === "POST" && call.path.length === 3) {
        if (action === "move")
          issue = await store.move(
            id,
            moveIssueSchema.strict().parse(payload),
            current.boardId,
          );
        else if (action === "transfer") {
          const input = transferIssueSchema.strict().parse(payload);
          if (
            !allowBoard(actor, input.boardId) ||
            !allowBoard(actor, input.fromBoardId)
          )
            missing();
          if (input.fromBoardId !== current.boardId)
            throw new AgentError(
              409,
              "revision_conflict",
              "The card moved. Read it again before transferring.",
            );
          affectedBoards.push(input.boardId);
          issue = await store.transfer(id, input);
        } else if (action === "archive" || action === "restore") {
          z.object({}).strict().parse(payload);
          issue =
            action === "archive"
              ? await store.archive(id, current.boardId)
              : await store.restore(id, current.boardId);
        }
      }
      if (!issue)
        throw new AgentError(
          400,
          "invalid_operation",
          "Choose a supported card operation.",
        );
    }
    const data = cardView(issue, actor);
    await client.query(
      `INSERT INTO agent_requests(key_id,request_key,fingerprint,issue_id,response,status,board_ids,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,NOW()+INTERVAL '24 hours')`,
      [
        actor.keyId,
        requestKey,
        fingerprint,
        issue.id,
        JSON.stringify(data),
        status,
        affectedBoards,
      ],
    );
    await client.query(
      "INSERT INTO agent_audit(request_id,user_id,key_id,operation,target,outcome) VALUES($1,$2,$3,$4,$5,'succeeded')",
      [
        call.requestId,
        actor.userId,
        actor.keyId,
        `${call.method} ${action ?? resource}`,
        issue.id,
      ],
    );
    return { status, data };
  }, pool);
}
