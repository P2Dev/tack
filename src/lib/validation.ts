import { z } from "zod";

import { ISSUE_STATUSES, LABEL_COLORS } from "@/lib/types";

export const issueStatusSchema = z.enum(ISSUE_STATUSES);

export const boardIdSchema = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,9}$/, "Use 2–10 letters or numbers, starting with a letter.");

export const createBoardSchema = z.object({
  id: boardIdSchema,
  name: z.string().trim().min(1).max(80),
});
export const transferIssueSchema = z.object({
  boardId: boardIdSchema,
  fromBoardId: boardIdSchema,
});

export const createIssueSchema = z.object({
  boardId: boardIdSchema.optional(),
  title: z.string().trim().min(1).max(180),
  status: issueStatusSchema,
});

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    description: z.string().max(20_000).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    labelIds: z
      .array(z.string().min(1))
      .max(12)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Labels must be unique.",
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

export const moveIssueSchema = z.object({
  status: issueStatusSchema,
  position: z.number().int().nonnegative(),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(24),
  color: z.enum(LABEL_COLORS),
});
