import "server-only";
import { auth } from "@/lib/auth";
import { getDatabase, withTransaction } from "@/lib/database";
import {
  AgentError,
  keyInputSchema,
  type AgentKeyView,
  type AgentPrincipal,
} from "@/lib/agent-contract";

export async function listAgentKeys(
  userId: string,
  all = false,
): Promise<AgentKeyView[]> {
  const result = await getDatabase().query(
    `SELECT k.id, k.user_id AS "userId", u.name AS "ownerName", k.name, k.prefix, k.scopes,
    k.board_ids AS "boardIds", k.created_at AS "createdAt", k.expires_at AS "expiresAt", k.revoked_at AS "revokedAt", k.last_used_at AS "lastUsedAt"
    FROM agent_keys k JOIN "user" u ON u.id=k.user_id WHERE ($2 OR k.user_id=$1) ORDER BY k.created_at DESC LIMIT 500`,
    [userId, all],
  );
  return JSON.parse(JSON.stringify(result.rows));
}
export async function createAgentKey(userId: string, input: unknown) {
  const data = keyInputSchema.parse(input);
  if (data.boardIds !== null) {
    const boards = await getDatabase().query(
      "SELECT id FROM boards WHERE removed_at IS NULL AND id=ANY($1::TEXT[])",
      [data.boardIds],
    );
    if (boards.rowCount !== new Set(data.boardIds).size)
      throw new AgentError(400, "invalid_board", "Choose available boards.");
  }
  const count = await getDatabase().query(
    "SELECT COUNT(*)::INT AS count FROM agent_keys WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>NOW()",
    [userId],
  );
  if (count.rows[0].count >= 50)
    throw new AgentError(
      400,
      "key_limit",
      "Revoke an unused key before creating another (50 active keys maximum).",
    );
  const key = await auth.api.createApiKey({
    body: { userId, name: data.name, expiresIn: data.days * 86400 },
  });
  try {
    await getDatabase().query(
      `INSERT INTO agent_keys(id,user_id,name,prefix,scopes,board_ids,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        key.id,
        userId,
        data.name,
        key.key.slice(0, 12),
        data.scopes,
        data.boardIds,
        key.expiresAt,
      ],
    );
  } catch (error) {
    await getDatabase().query("DELETE FROM apikey WHERE id=$1", [key.id]);
    throw error;
  }
  return { id: key.id, secret: key.key };
}
export async function changeAgentKey(
  actor: { id: string; role: string },
  id: string,
  change: { name?: string; revoke?: boolean },
) {
  return withTransaction(async (client) => {
    const result = await client.query(
      "SELECT * FROM agent_keys WHERE id=$1 FOR UPDATE",
      [id],
    );
    const key = result.rows[0];
    if (
      !key ||
      (key.user_id !== actor.id && !(actor.role === "admin" && change.revoke))
    )
      throw new AgentError(404, "not_found", "That key is unavailable.");
    if (change.revoke) {
      await client.query(
        "UPDATE agent_keys SET revoked_at=COALESCE(revoked_at,NOW()) WHERE id=$1",
        [id],
      );
      await client.query(
        'UPDATE apikey SET enabled=FALSE, "updatedAt"=NOW() WHERE id=$1',
        [id],
      );
    } else if (change.name)
      await client.query("UPDATE agent_keys SET name=$2 WHERE id=$1", [
        id,
        change.name,
      ]);
    return { success: true };
  });
}
export async function authenticateAgent(
  request: Request,
): Promise<AgentPrincipal> {
  const value = request.headers.get("authorization") ?? "";
  const match = /^Bearer (tack_[A-Za-z0-9_-]{20,200})$/i.exec(value);
  if (!match)
    throw new AgentError(
      401,
      "invalid_credentials",
      "Supply a valid Tack API key in the Authorization header.",
    );
  const result = await auth.api.verifyApiKey({ body: { key: match[1] } });
  if (!result.valid || !result.key) {
    if (
      ["RATE_LIMITED", "RATE_LIMIT_EXCEEDED"].includes(result.error?.code ?? "")
    )
      throw new AgentError(
        429,
        "rate_limited",
        "Too many requests. Retry after 60 seconds.",
      );
    throw new AgentError(
      401,
      "invalid_credentials",
      "This key is invalid, expired, or revoked. Check your API keys page.",
    );
  }
  const record = await getDatabase().query(
    `SELECT k.*, u.banned FROM agent_keys k JOIN "user" u ON u.id=k.user_id
    WHERE k.id=$1 AND k.user_id=$2 AND k.revoked_at IS NULL AND k.expires_at>NOW() AND NOT u.banned`,
    [result.key.id, result.key.referenceId],
  );
  const key = record.rows[0];
  if (!key)
    throw new AgentError(
      401,
      "invalid_credentials",
      "This key or its owner is no longer active.",
    );
  await getDatabase().query(
    "UPDATE agent_keys SET last_used_at=NOW() WHERE id=$1",
    [key.id],
  );
  return {
    keyId: key.id,
    userId: key.user_id,
    scopes: key.scopes,
    boardIds: key.board_ids,
  };
}
