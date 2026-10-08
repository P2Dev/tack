import "server-only";

import { headers } from "next/headers";

import { auth, type AuthSession } from "@/lib/auth";

export async function getPageSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getRequestSession(request: Request) {
  if (request.headers.has("authorization")) return null;
  return auth.api.getSession({
    headers: request.headers,
  });
}

export function isAdmin(session: AuthSession | null) {
  return session?.user.role === "admin";
}

export function unauthorized() {
  return Response.json(
    { error: "Sign in to continue." },
    { status: 401 },
  );
}

export function forbidden() {
  return Response.json(
    { error: "Administrator access is required." },
    { status: 403 },
  );
}
