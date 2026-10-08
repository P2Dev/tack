import {
  forbidden,
  getRequestSession,
  isAdmin,
  unauthorized,
} from "@/lib/auth-guards";
import {
  createTackExport,
  serializeIssuesCsv,
} from "@/lib/export";
import { jsonError } from "@/lib/http";
import { getIssueStore } from "@/lib/server-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return unauthorized();
    }
    if (!isAdmin(session)) {
      return forbidden();
    }

    const format =
      new URL(request.url).searchParams.get("format") ?? "json";
    if (format !== "json" && format !== "csv") {
      return Response.json(
        { error: "Choose either json or csv." },
        { status: 400 },
      );
    }

    const data = await createTackExport(getIssueStore());
    const filename = `tack-export-${data.exportedAt.slice(0, 10)}.${format}`;
    const body =
      format === "csv"
        ? serializeIssuesCsv(data)
        : `${JSON.stringify(data, null, 2)}\n`;

    return new Response(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
