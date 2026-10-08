import { describe, expect, it } from "vitest";
import { safeReturnPath, signInPath } from "./return-path";

describe("authentication destinations", () => {
  it("preserves card and filter context on owned routes", () => {
    const path = "/?issue=TCK-1&q=two+words&assignee=abc&label=bug";
    expect(safeReturnPath(path)).toBe(path);
    expect(new URL(signInPath(path), "https://tack.invalid").searchParams.get("returnTo")).toBe(path);
    expect(safeReturnPath("/settings/api-keys?board=ENG")).toBe("/settings/api-keys?board=ENG");
    expect(safeReturnPath("/team")).toBe("/team");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/sign-in?returnTo=/", "/api/export", "/%2f%2fevil.example", "/\nevil.example"])("rejects unsafe or unsupported destinations: %s", (path) => {
    expect(safeReturnPath(path)).toBe("/");
  });
});
