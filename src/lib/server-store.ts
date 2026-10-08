import "server-only";

import { getDatabase } from "@/lib/database";
import { createIssueStore } from "@/lib/issue-store";

export function getIssueStore() {
  return createIssueStore(getDatabase());
}
