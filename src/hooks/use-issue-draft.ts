"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Issue, IssuePatch } from "@/lib/types";

type TextDraft = { title: string; description: string };
type SaveState = "idle" | "saving" | "saved" | "error";

/** One writer owns text drafts; snapshots from metadata/movement never reset them. */
export function useIssueDraft(
  issue: Issue,
  memberId: string,
  onUpdate: (id: string, patch: IssuePatch) => Promise<void>,
) {
  const [draft, setDraft] = useState<TextDraft>({ title: issue.title, description: issue.description });
  const current = useRef(draft);
  const saved = useRef({ ...draft });
  const inFlight = useRef<Promise<boolean> | null>(null);
  const restored = useRef(false);
  const pauseAutosave = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [recovered, setRecovered] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const storageKey = `tack:draft:${memberId}:${issue.id}`;

  const persist = useCallback(() => {
    try {
      const patch: Partial<TextDraft> = {};
      if (current.current.title.trim() !== saved.current.title) patch.title = current.current.title;
      if (current.current.description !== saved.current.description) patch.description = current.current.description;
      if (Object.keys(patch).length) {
        sessionStorage.setItem(storageKey, JSON.stringify({ patch, expiresAt: Date.now() + 86_400_000 }));
      } else {
        sessionStorage.removeItem(storageKey);
      }
      setStorageAvailable(true);
      return true;
    } catch {
      setStorageAvailable(false);
      return false;
    }
  }, [storageKey]);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!(stored.expiresAt > Date.now()) || !stored.patch ||
        (stored.patch.title !== undefined && (typeof stored.patch.title !== "string" || stored.patch.title.length > 180)) ||
        (stored.patch.description !== undefined && (typeof stored.patch.description !== "string" || stored.patch.description.length > 20_000))) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      const next = { ...saved.current };
      if (stored.patch.title !== undefined) next.title = stored.patch.title;
      if (stored.patch.description !== undefined) next.description = stored.patch.description;
      current.current = next;
      pauseAutosave.current = true;
      setDraft(next);
      setRecovered(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (inFlight.current) return;
    const next = { ...current.current };
    // A move can bring back a newer shared snapshot. Adopt untouched fields,
    // while keeping this tab's unsaved text under the editor's ownership.
    if (next.title.trim() === saved.current.title) {
      next.title = issue.title;
      saved.current.title = issue.title;
    }
    if (next.description === saved.current.description) {
      next.description = issue.description;
      saved.current.description = issue.description;
    }
    if (next.title !== current.current.title || next.description !== current.current.description) {
      current.current = next;
      setDraft(next);
    }
  }, [issue.title, issue.description]);

  const flush = useCallback((): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    pauseAutosave.current = false;
    const save = async () => {
      for (; ;) {
        const sent = { ...current.current };
        if (!sent.title.trim()) {
          setError("Give this card a title, or discard your changes.");
          setSaveState("error");
          return false;
        }
        const patch: IssuePatch = {};
        if (sent.title.trim() !== saved.current.title) patch.title = sent.title.trim();
        if (sent.description !== saved.current.description) patch.description = sent.description;
        if (!Object.keys(patch).length) {
          setSaveState("saved");
          setError("");
          setRecovered(false);
          persist();
          return true;
        }
        setSaveState("saving");
        setError("");
        try {
          await onUpdate(issue.id, patch);
          if (patch.title !== undefined) {
            saved.current.title = patch.title;
            if (current.current.title === sent.title) {
              current.current = { ...current.current, title: patch.title };
              setDraft(current.current);
            }
          }
          if (patch.description !== undefined) saved.current.description = patch.description;
          setSessionExpired(false);
          persist();
          // Drain newer edits before reporting Saved or allowing a transition.
        } catch (failure) {
          const expired = failure instanceof Error && "status" in failure && failure.status === 401;
          setSessionExpired(expired);
          setError(expired ? "Sign in again to save. Your changes are still in the editor." : "Your changes couldn’t be saved. They are still in the editor.");
          setSaveState("error");
          persist();
          return false;
        }
      }
    };
    inFlight.current = save().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [issue.id, onUpdate, persist]);

  const change = (field: keyof TextDraft, value: string) => {
    current.current = { ...current.current, [field]: value };
    setDraft(current.current);
    pauseAutosave.current = false;
    setRecovered(false);
    setError("");
    if (!inFlight.current) setSaveState("idle");
    persist();
  };

  useEffect(() => {
    if (pauseAutosave.current) return;
    if (current.current.title.trim() === saved.current.title && current.current.description === saved.current.description) return;
    const timer = window.setTimeout(() => { void flush(); }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, flush]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (inFlight.current || current.current.title.trim() !== saved.current.title || current.current.description !== saved.current.description) {
        persist();
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [persist]);

  function discard() {
    if (inFlight.current) return;
    current.current = { ...saved.current };
    setDraft(current.current);
    setError("");
    setRecovered(false);
    setSessionExpired(false);
    setSaveState("idle");
    persist();
  }

  return {
    ...draft, change, flush, discard, persist, error, saveState, recovered,
    sessionExpired, storageAvailable,
    isDirty: draft.title.trim() !== saved.current.title || draft.description !== saved.current.description,
  };
}
