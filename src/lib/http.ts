import { DomainError } from "@/lib/domain-error";
import { ZodError } from "zod";

export function jsonError(error: unknown) {
  if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "Please check the issue details and try again.",
        details: error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  console.error(error);
  return Response.json(
    { error: "Something went wrong. Your change was not saved." },
    { status: 500 },
  );
}

export function missingIssue() {
  return Response.json({ error: "That issue could not be found." }, { status: 404 });
}
