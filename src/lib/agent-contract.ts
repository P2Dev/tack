import { z } from "zod";
import { boardIdSchema } from "@/lib/validation";

export const keyScopeSchema = z.enum(["read", "write", "archive", "transfer"]);
export type KeyScope = z.infer<typeof keyScopeSchema>;
export const keyInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z
      .array(keyScopeSchema)
      .min(1)
      .max(4)
      .refine(
        (items) =>
          items.includes("read") && new Set(items).size === items.length,
        "Include read access and unique permissions.",
      ),
    boardIds: z.array(boardIdSchema).min(1).max(100).nullable(),
    days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(90),
  })
  .strict();
export type AgentKeyView = {
  id: string;
  userId: string;
  ownerName: string;
  name: string;
  prefix: string;
  scopes: KeyScope[];
  boardIds: string[] | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};
export type AgentPrincipal = {
  keyId: string;
  userId: string;
  scopes: KeyScope[];
  boardIds: string[] | null;
};
export class AgentError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function allowBoard(principal: AgentPrincipal, boardId: string) {
  return principal.boardIds === null || principal.boardIds.includes(boardId);
}
export function requireScope(principal: AgentPrincipal, scope: KeyScope) {
  if (!principal.scopes.includes(scope))
    throw new AgentError(
      403,
      "insufficient_scope",
      `This key does not allow ${scope} operations.`,
    );
}
