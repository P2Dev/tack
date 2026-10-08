"use client";

import { signInPath } from "@/lib/return-path";

/** Keep the interrupted form mounted; credentials are never copied to storage. */
export function SessionRecovery({ returnTo }: { returnTo?: string }) {
  const destination = returnTo ?? (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search);
  return (
    <div className="session-recovery">
      <p>Your session expired. Keep this tab open to retain your input.</p>
      <a className="secondary-button" href={signInPath(destination)} target="_blank" rel="noopener noreferrer">Sign in in another tab</a>
      <p>Then return here and try the action again.</p>
    </div>
  );
}
