"use client";

import { useEffect, useRef, useState } from "react";

/** Tab-scoped, account/board/column-bound capture; never submits recovered text. */
export function useCaptureDraft(memberId: string, boardId: string, status: string) {
  const key = `tack:capture:${memberId}:${boardId}:${status}`;
  const [title, setTitle] = useState("");
  const [recovered, setRecovered] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const value = JSON.parse(raw);
      if (value.expiresAt > Date.now() && typeof value.title === "string" && value.title.length <= 180) {
        // Hydrate browser-only storage once after SSR, before accepting user edits.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(value.title); setRecovered(Boolean(value.title));
      } else sessionStorage.removeItem(key);
    } catch { setStorageAvailable(false); }
  }, [key]);
  function change(value: string) {
    setTitle(value); setRecovered(false);
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify({ title: value, expiresAt: Date.now() + 86_400_000 }));
      else sessionStorage.removeItem(key);
      setStorageAvailable(true);
    } catch { setStorageAvailable(false); }
  }
  useEffect(() => {
    if (!title || storageAvailable) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [title, storageAvailable]);
  return { title, change, recovered, storageAvailable };
}
