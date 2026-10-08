"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Archive,
  Link,
  LogOut,
  MoreHorizontal,
  PanelLeft,
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Search,
  Tags,
  Users,
  X,
} from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { BoardNavigation, useBoardNavigation } from "@/components/board-navigation";
import { BoardManagerDrawer } from "@/components/board-manager-drawer";
import { BoardTransfer } from "@/components/board-transfer";
import ReactMarkdown from "react-markdown";
import { SessionRecovery } from "@/components/session-recovery";
import { DetailDrawer } from "@/components/detail-drawer";
import { ArchiveDrawer } from "@/components/archive-drawer";
import { BoardColumn } from "@/components/board-column";
import { IssueCard } from "@/components/issue-card";
import { IssueDrawer } from "@/components/issue-drawer";
import { LabelManagerDrawer } from "@/components/label-manager-drawer";
import type {
  BoardInfo,
  BoardSnapshot,
  Issue,
  IssuePatch,
  IssueStatus,
  Label,
  LabelColor,
  TeamMember,
} from "@/lib/types";
import { ISSUE_STATUSES, STATUS_META } from "@/lib/types";
import { authClient } from "@/lib/auth-client";

type BoardFilters = {
  query: string;
  assigneeId: string;
  labelId: string;
};

type BoardProps = {
  initialSnapshot: BoardSnapshot;
  currentMember: TeamMember;
  initialSelectedKey?: string;
  initialArchiveOpen?: boolean;
  initialFilters: BoardFilters;
};

type Toast = {
  message: string;
  undo?: () => void;
};

type SyncState = "live" | "refreshing" | "offline";

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw Object.assign(new Error(payload.error ?? "Request failed"), { status: response.status });
  }
  return payload;
}

function reorderIssues(
  issues: Issue[],
  id: string,
  status: IssueStatus,
  position: number,
) {
  const moving = issues.find((issue) => issue.id === id);
  if (!moving) {
    return issues;
  }

  const withoutMoving = issues.filter((issue) => issue.id !== id);
  const next: Issue[] = [];

  for (const currentStatus of ISSUE_STATUSES) {
    const columnIssues = withoutMoving
      .filter((issue) => issue.status === currentStatus)
      .sort((a, b) => a.position - b.position);

    if (currentStatus === status) {
      const targetPosition = Math.min(position, columnIssues.length);
      columnIssues.splice(targetPosition, 0, {
        ...moving,
        status,
        position: targetPosition,
      });
    }

    next.push(
      ...columnIssues.map((issue, nextPosition) => ({
        ...issue,
        position: nextPosition,
      })),
    );
  }

  return next;
}

function replaceIssue(snapshot: BoardSnapshot, issue: Issue): BoardSnapshot {
  const collection = issue.archivedAt ? "archived" : "active";
  return {
    ...snapshot,
    [collection]: snapshot[collection].map((current) =>
      current.id === issue.id ? issue : current,
    ),
  };
}

function patchIssue(
  snapshot: BoardSnapshot,
  id: string,
  patch: IssuePatch,
  serverIssue?: Issue,
): BoardSnapshot {
  const current = [...snapshot.active, ...snapshot.archived].find(
    (issue) => issue.id === id,
  );
  if (!current) {
    return snapshot;
  }

  const next = { ...current };
  if (patch.title !== undefined) {
    next.title = serverIssue?.title ?? patch.title;
  }
  if (patch.description !== undefined) {
    next.description = serverIssue?.description ?? patch.description;
  }
  if (Object.hasOwn(patch, "assigneeId")) {
    next.assigneeId = serverIssue?.assigneeId ?? patch.assigneeId ?? null;
    next.assignee =
      serverIssue?.assignee ??
      snapshot.members.find((member) => member.id === patch.assigneeId) ??
      null;
  }
  if (patch.labelIds !== undefined) {
    next.labels =
      serverIssue?.labels ??
      snapshot.labels.filter((label) => patch.labelIds?.includes(label.id));
  }
  if (serverIssue) {
    next.updatedAt = serverIssue.updatedAt;
  }

  return replaceIssue(snapshot, next);
}

function rollbackPatch(previous: Issue, patch: IssuePatch): IssuePatch {
  const rollback: IssuePatch = {};
  if (patch.title !== undefined) {
    rollback.title = previous.title;
  }
  if (patch.description !== undefined) {
    rollback.description = previous.description;
  }
  if (Object.hasOwn(patch, "assigneeId")) {
    rollback.assigneeId = previous.assigneeId;
  }
  if (patch.labelIds !== undefined) {
    rollback.labelIds = previous.labels.map((label) => label.id);
  }
  return rollback;
}

export function Board({
  initialSnapshot,
  currentMember,
  initialSelectedKey,
  initialArchiveOpen = false,
  initialFilters,
}: BoardProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const navigation = useBoardNavigation();
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationOpen = navigation.narrow && navigation.open;
  function hideNavigation() {
    navigation.setOpen(false);
    // The native modal must close before its background opener can take focus.
    window.setTimeout(() => navigationTriggerRef.current?.focus(), 0);
  }
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(() => {
    const allIssues = [...initialSnapshot.active, ...initialSnapshot.archived];
    return (
      allIssues.find(
        (issue) => issue.key.toLowerCase() === initialSelectedKey?.toLowerCase(),
      )?.id ?? null
    );
  });
  const [archiveOpen, setArchiveOpen] = useState(initialArchiveOpen);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [boardUnavailable, setBoardUnavailable] = useState(false);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [mobileSelection, setMobileSelection] = useState<IssueStatus | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createdIssue, setCreatedIssue] = useState<Issue | null>(null);
  const managerReturnRef = useRef<HTMLElement | null>(null);
  const navigationGuardRef = useRef<(() => Promise<boolean>) | null>(null);
  const historyHandlerRef = useRef<(event: PopStateEvent) => void>(() => {});
  const historyPhase = useRef<"idle" | "restoring" | "approved">("idle");
  const ownedCard = useRef<{ key: string; parent: string; archive: boolean } | null>(null);
  const optionsRef = useRef<HTMLDetailsElement>(null);
  const optionsTriggerRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState(initialFilters.query);
  const [assigneeFilter, setAssigneeFilter] = useState(
    initialFilters.assigneeId,
  );
  const [labelFilter, setLabelFilter] = useState(initialFilters.labelId);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [lastChecked, setLastChecked] = useState("");
  const refreshInFlight = useRef(false);
  const [actionFailure, setActionFailure] = useState<{ id: string; message: string; retry: () => void } | null>(null);
  const boardRequest = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    try {
      const scoped = `${url}${url.includes("?") ? "&" : "?"}board=${encodeURIComponent(initialSnapshot.board.id)}`;
      const result = await requestJson<T>(scoped, init);
      setSessionExpired(false);
      return result;
    } catch (error) {
      if ((error as { status?: number }).status === 401) setSessionExpired(true);
      else if ((error as { status?: number }).status === 403) setSessionExpired(false);
      throw error;
    }
  }, [initialSnapshot.board.id]);
  const [syncState, setSyncState] = useState<SyncState>("live");
  const [toast, setToast] = useState<Toast | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const toastTimer = useRef<number | null>(null);
  const archiveTriggerRef = useRef<HTMLButtonElement>(null);
  const labelManagerTriggerRef = useRef<HTMLButtonElement>(null);
  const snapshotRef = useRef(snapshot);
  const commitSnapshot = useCallback((next: BoardSnapshot | ((current: BoardSnapshot) => BoardSnapshot)) => {
    const value = typeof next === "function" ? next(snapshotRef.current) : next;
    snapshotRef.current = value;
    setSnapshot(value);
  }, []);
  const updateBoards = useCallback((boards: BoardInfo[]) => {
    commitSnapshot(current => ({ ...current, boards, board: boards.find(board => board.id === current.board.id) ?? current.board }));
  }, [commitSnapshot]);
  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());
  const runMutation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const next = mutationQueue.current.then(operation);
    mutationQueue.current = next.catch(() => { });
    return next;
  }, []);
  const archiveOrigin = useRef(false);
  const [archivePending, setArchivePending] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [copyViewFallback, setCopyViewFallback] = useState("");
  const [missingKey, setMissingKey] = useState(() => initialSelectedKey &&
    ![...initialSnapshot.active, ...initialSnapshot.archived].some((issue) => issue.key.toLowerCase() === initialSelectedKey.toLowerCase()) ? initialSelectedKey : "");
  const panelOpen = Boolean(selectedIssueId || archiveOpen || labelsOpen || boardsOpen || missingKey || mobileNavigationOpen);
  const pendingMutationsRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const canRefreshRef = useRef(true);
  canRefreshRef.current =
    !selectedIssueId && !archiveOpen && !labelsOpen && !boardsOpen && !activeIssueId && !mobileNavigationOpen && !isNavigating;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const allIssues = useMemo(
    () => [...snapshot.active, ...snapshot.archived],
    [snapshot],
  );
  const selectedIssue =
    allIssues.find((issue) => issue.id === selectedIssueId) ?? null;
  const activeIssue =
    snapshot.active.find((issue) => issue.id === activeIssueId) ?? null;
  const hasFilters = Boolean(query.trim() || assigneeFilter || labelFilter);

  const filteredIssues = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return snapshot.active.filter((issue) => {
      const matchesQuery =
        !normalizedQuery ||
        issue.key.toLowerCase().includes(normalizedQuery) ||
        issue.title.toLowerCase().includes(normalizedQuery);
      const matchesAssignee =
        !assigneeFilter ||
        (assigneeFilter === "unassigned"
          ? !issue.assigneeId
          : issue.assigneeId === assigneeFilter);
      const matchesLabel =
        !labelFilter ||
        issue.labels.some((label) => label.id === labelFilter);
      return matchesQuery && matchesAssignee && matchesLabel;
    });
  }, [assigneeFilter, labelFilter, query, snapshot.active]);

  const columnPreferenceKey = `tack:column:${currentMember.id}:${snapshot.board.id}`;
  const rememberedColumn = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => { try { const value = sessionStorage.getItem(columnPreferenceKey); return ISSUE_STATUSES.includes(value as IssueStatus) ? value as IssueStatus : null; } catch { return null; } },
    () => null,
  );
  const setMobileStatus = useCallback((status: IssueStatus) => {
    setMobileSelection(status);
    try { sessionStorage.setItem(columnPreferenceKey, status); } catch { /* Keep in memory. */ }
  }, [columnPreferenceKey]);
  const visibleMobileStatus = mobileSelection ?? rememberedColumn ??
    (filteredIssues.some(issue => issue.status === "in_progress") ? "in_progress" : filteredIssues[0]?.status ?? "backlog");
  const filterCount = [query.trim(), assigneeFilter, labelFilter].filter(Boolean).length;
  const hiddenCreatedIssue = createdIssue && snapshot.active.some((issue) => issue.id === createdIssue.id) &&
    !filteredIssues.some((issue) => issue.id === createdIssue.id) ? createdIssue : null;

  useEffect(() => {
    function dismissOptions(event: PointerEvent | KeyboardEvent) {
      if (!optionsRef.current?.open || document.querySelector("dialog[open]")) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        optionsTriggerRef.current?.focus();
      } else if (optionsRef.current.contains(event.target as Node)) return;
      optionsRef.current.open = false;
    }
    document.addEventListener("pointerdown", dismissOptions);
    document.addEventListener("keydown", dismissOptions);
    return () => {
      document.removeEventListener("pointerdown", dismissOptions);
      document.removeEventListener("keydown", dismissOptions);
    };
  }, []);

  const startMutation = useCallback(() => {
    pendingMutationsRef.current += 1;
    setPendingWrites(pendingMutationsRef.current);
    mutationVersionRef.current += 1;
  }, []);

  const finishMutation = useCallback(() => {
    pendingMutationsRef.current = Math.max(
      0,
      pendingMutationsRef.current - 1,
    );
    setPendingWrites(pendingMutationsRef.current);
  }, []);

  const refreshSnapshot = useCallback(async () => {
    if (!canRefreshRef.current || pendingMutationsRef.current || refreshInFlight.current) {
      return;
    }

    refreshInFlight.current = true;
    const version = mutationVersionRef.current;
    setSyncState("refreshing");
    try {
      const freshSnapshot = await boardRequest<BoardSnapshot>("/api/issues");
      if (
        version === mutationVersionRef.current &&
        canRefreshRef.current &&
        !pendingMutationsRef.current
      ) {
        commitSnapshot(freshSnapshot);
        setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
      setSyncState("live");
    } catch (error) {
      if ((error as { status?: number }).status === 404) setBoardUnavailable(true);
      setSyncState("offline");
    } finally {
      refreshInFlight.current = false;
    }
  }, [boardRequest, commitSnapshot]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setAssigneeFilter("");
    setLabelFilter("");
  }, []);

  const showToast = useCallback((nextToast: Toast) => {
    setToast(nextToast);
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => setToast(null), 6_000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshSnapshot();
    }, 12_000);
    function refreshOnFocus() {
      void refreshSnapshot();
    }
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshSnapshot();
      }
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (initialSnapshot.board.id !== "TCK" || url.searchParams.has("board")) url.searchParams.set("board", initialSnapshot.board.id);
    if (query.trim()) {
      url.searchParams.set("q", query.trim());
    } else {
      url.searchParams.delete("q");
    }
    if (assigneeFilter) {
      url.searchParams.set("assignee", assigneeFilter);
    } else {
      url.searchParams.delete("assignee");
    }
    if (labelFilter) {
      url.searchParams.set("label", labelFilter);
    } else {
      url.searchParams.delete("label");
    }
    window.history.replaceState(window.history.state, "", url);
  }, [assigneeFilter, labelFilter, query, initialSnapshot.board.id]);

  useEffect(() => {
    function handleBoardShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isEditing =
        target.matches("input, textarea, select") ||
        target.isContentEditable ||
        target.closest("dialog") !== null ||
        selectedIssueId !== null ||
        archiveOpen ||
        labelsOpen || boardsOpen || isNavigating;

      if (
        isEditing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        setMobileStatus("backlog");
        window.setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>(
                '[data-quick-add="backlog"]',
              )
              ?.focus(),
          0,
        );
      }

      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("[data-board-search]")?.focus();
      }
    }

    document.addEventListener("keydown", handleBoardShortcuts);
    return () => document.removeEventListener("keydown", handleBoardShortcuts);
  }, [archiveOpen, labelsOpen, boardsOpen, selectedIssueId, setMobileStatus, isNavigating]);

  function updateUrl(issue?: Issue) {
    const url = new URL(window.location.href);
    if (initialSnapshot.board.id !== "TCK" || url.searchParams.has("board")) url.searchParams.set("board", initialSnapshot.board.id);
    if (issue) {
      url.searchParams.set("issue", issue.key);
    } else {
      url.searchParams.delete("issue");
    }
    window.history.replaceState({ ...window.history.state, tackCard: undefined }, "", url);
  }

  function openIssue(issue: Issue, fromHistory = false) {
    archiveOrigin.current = archiveOpen;
    setArchiveError("");
    setSelectedIssueId(issue.id);
    setArchiveOpen(false);
    setLabelsOpen(false);
    if (!fromHistory) {
      const entry = { key: issue.key, parent: window.location.href, archive: archiveOpen };
      const url = new URL(window.location.href);
      url.searchParams.set("issue", issue.key);
      ownedCard.current = entry;
      window.history.pushState({ ...window.history.state, tackCard: entry }, "", url);
    }

  }

  function closeIssue(fromHistory = false) {
    if (!fromHistory && ownedCard.current) {
      historyPhase.current = "approved";
      window.history.back();
      return;
    }
    ownedCard.current = null;
    const previousIssueId = selectedIssueId;
    const returnToArchive = archiveOrigin.current;
    setSelectedIssueId(null);
    setMissingKey("");
    if (returnToArchive) setArchiveOpen(true);
    archiveOrigin.current = false;
    if (!fromHistory) updateUrl();
    window.setTimeout(() => {
      const trigger = document.querySelector<HTMLElement>(returnToArchive
        ? `[data-archive-trigger="${previousIssueId}"]`
        : `[data-issue-trigger="${previousIssueId}"]`);
      if (trigger?.getClientRects().length) trigger.focus();
      else if (returnToArchive) document.querySelector<HTMLElement>('[aria-label="Close archive"]')?.focus();
      else optionsTriggerRef.current?.focus();
      void refreshSnapshot();
    }, 0);
  }

  // Restore the card entry while an asynchronous save is checked. Only then
  // replay Back, preserving the browser's Forward entry and the original filters.
  historyHandlerRef.current = async (event: PopStateEvent) => {
      const entry = event.state?.tackCard as { key: string; parent: string; archive: boolean } | undefined;
      if (historyPhase.current === "restoring") {
        event.stopImmediatePropagation();
        if (archivePending) { historyPhase.current = "idle"; return; }
        const saved = navigationGuardRef.current ? await navigationGuardRef.current() : true;
        historyPhase.current = saved ? "approved" : "idle";
        if (saved) window.history.back();
        return;
      }
      if (ownedCard.current && window.location.href === ownedCard.current.parent) {
        event.stopImmediatePropagation();
        if (historyPhase.current === "approved") {
          historyPhase.current = "idle";
          closeIssue(true);
        } else {
          historyPhase.current = "restoring";
          window.history.forward();
        }
        return;
      }
      if (entry && !selectedIssueId) {
        const issue = allIssues.find(item => item.key === entry.key);
        if (issue) {
          event.stopImmediatePropagation();
          ownedCard.current = entry;
          openIssue(issue, true);
          archiveOrigin.current = entry.archive;
        }
      }
  };
  useEffect(() => {
    const onPop = (event: PopStateEvent) => historyHandlerRef.current(event);
    window.addEventListener("popstate", onPop, true);
    return () => window.removeEventListener("popstate", onPop, true);
  }, []);

  function canLeaveCapture() {
    const unretained = Array.from(document.querySelectorAll<HTMLInputElement>('[data-quick-add][data-draft-retained="false"]')).some(input => input.value.trim());
    return !unretained || window.confirm("Draft storage is unavailable. Leave and discard the unfinished new-card title?");
  }
  function openBoardManager() {
    managerReturnRef.current = optionsRef.current?.contains(document.activeElement) ? optionsTriggerRef.current : navigation.narrow ? navigationTriggerRef.current : document.activeElement as HTMLElement;
    if (navigation.narrow) navigation.setOpen(false);
    setBoardsOpen(true);
    if (optionsRef.current) optionsRef.current.open = false;
  }
  const exactSearchKey = /^[a-z][a-z0-9]{1,9}-[1-9]\d*$/i.test(query.trim()) ? query.trim().toUpperCase() : null;
  function findCardKey() {
    if (exactSearchKey && canLeaveCapture()) startNavigation(() => router.push(`/?issue=${encodeURIComponent(exactSearchKey)}`, { scroll: false }));
  }

  function updateArchiveUrl(open: boolean) {
    const url = new URL(window.location.href);
    if (open) url.searchParams.set("archive", "1");
    else url.searchParams.delete("archive");
    window.history.replaceState(window.history.state, "", url);
  }
  function closeArchive() {
    setArchiveOpen(false);
    updateArchiveUrl(false);
    window.setTimeout(() => {
      archiveTriggerRef.current?.focus();
      void refreshSnapshot();
    }, 0);
  }

  function closeLabelManager() {
    setLabelsOpen(false);
    window.setTimeout(() => {
      labelManagerTriggerRef.current?.focus();
      void refreshSnapshot();
    }, 0);
  }

  function switchBoard(id: string, archive = false) {
    if (pendingMutationsRef.current || isNavigating) return;
    if (!canLeaveCapture()) return;
    setBoardsOpen(false);
    if (id === snapshot.board.id) { setArchiveOpen(archive); updateArchiveUrl(archive); return; }
    startNavigation(() => router.push(`/?board=${encodeURIComponent(id)}${archive ? "&archive=1" : ""}`, { scroll: false }));
  }

  async function transferIssue(id: string, boardId: string): Promise<boolean> {
    return runMutation(async () => {
      startMutation(); setArchivePending(true);
      try {
        const moved = await boardRequest<Issue>(`/api/issues/${id}/transfer`, { method: "POST", body: JSON.stringify({ boardId, fromBoardId: initialSnapshot.board.id }) });
        setSelectedIssueId(null);
        startNavigation(() => router.push(`/?board=${encodeURIComponent(moved.boardId)}&issue=${encodeURIComponent(moved.key)}`, { scroll: false }));
        return true;
      } catch { return false; }
      finally { finishMutation(); setArchivePending(false); }
    });
  }

  async function copyView() {
    const url = new URL(window.location.href);
    if (initialSnapshot.board.id !== "TCK" || url.searchParams.has("board")) url.searchParams.set("board", initialSnapshot.board.id);
    url.searchParams.delete("issue");
    try {
      await navigator.clipboard.writeText(url.href);
      setCopyViewFallback("");
      showToast({ message: "View link copied." });
    } catch {
      setCopyViewFallback(url.href);
    }
  }

  async function createIssue(title: string, status: IssueStatus) {
    return runMutation(async () => {
      startMutation();
      try {
        const issue = await boardRequest<Issue>("/api/issues", {
          method: "POST",
          body: JSON.stringify({ title, status, boardId: initialSnapshot.board.id }),
        });
        commitSnapshot((current) => ({
          ...current,
          active: reorderIssues(
            [...current.active, issue],
            issue.id,
            status,
            issue.position,
          ),
        }));
        setCreatedIssue(issue);
        showToast({ message: `${issue.key} added to ${STATUS_META[status].label}.` });
        setAnnouncement(`${issue.key} added to ${STATUS_META[status].label}.`);
      } finally {
        finishMutation();
      }
    });
  }

  const updateIssue = useCallback(
    async (id: string, patch: IssuePatch) => {
      return runMutation(async () => {
        const previousIssue = [
          ...snapshotRef.current.active,
          ...snapshotRef.current.archived,
        ].find((issue) => issue.id === id);
        if (!previousIssue) {
          throw new Error("That card is no longer available.");
        }

        startMutation();
        commitSnapshot((current) => patchIssue(current, id, patch));

        try {
          const issue = await boardRequest<Issue>(`/api/issues/${id}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          });
          commitSnapshot((current) => patchIssue(current, id, patch, issue));
        } catch (error) {
          commitSnapshot((current) =>
            patchIssue(
              current,
              id,
              rollbackPatch(previousIssue, patch),
              previousIssue,
            ),
          );
          throw error;
        } finally {
          finishMutation();
        }
      });
    },
    [boardRequest, commitSnapshot, finishMutation, runMutation, startMutation],
  );

  const moveIssue = useCallback(
    async (
      id: string,
      status: IssueStatus,
      position: number,
      offerUndo = true,
    ) => {
      return runMutation(async () => {
        const currentSnapshot = snapshotRef.current;
        const issue = currentSnapshot.active.find((current) => current.id === id);
        if (!issue) {
          return false;
        }

        const previousSnapshot = currentSnapshot;
        const previousStatus = issue.status;
        const previousPosition = issue.position;
        const targetCount = currentSnapshot.active.filter(
          (current) => current.status === status && current.id !== id,
        ).length;
        const targetPosition = Math.min(position, targetCount);

        if (
          previousStatus === status &&
          previousPosition === targetPosition
        ) {
          return true;
        }

        startMutation();
        commitSnapshot((current) => ({
          ...current,
          active: reorderIssues(current.active, id, status, targetPosition),
        }));
        setMobileStatus(status);

        try {
          const response = await boardRequest<{
            issue: Issue;
            snapshot: BoardSnapshot;
          }>(`/api/issues/${id}/move`, {
            method: "POST",
            body: JSON.stringify({ status, position: targetPosition }),
          });
          commitSnapshot(response.snapshot);
          setActionFailure((failure) => failure?.id === id ? null : failure);
          setAnnouncement(
            `${response.issue.key} moved to ${STATUS_META[status].label}, position ${response.issue.position + 1}.`,
          );

          if (offerUndo) {
            showToast({
              message: `${response.issue.key} moved to ${STATUS_META[status].label}.`,
              undo: () => {
                void moveIssue(id, previousStatus, previousPosition, false);
                setToast(null);
              },
            });
          }
          return true;
        } catch {
          commitSnapshot(previousSnapshot);
          setMobileStatus(previousStatus);
          setActionFailure({ id, message: `${issue.key}: Move failed to confirm. Previous view restored. Retry the move or check the board.`, retry: () => { void moveIssue(id, status, position, offerUndo); } });
          setToast(null);
          return false;
        } finally {
          finishMutation();
        }
      });
    },
    [boardRequest, commitSnapshot, finishMutation, runMutation, setMobileStatus, showToast, startMutation],
  );

  function moveToStatus(id: string, status: IssueStatus) {
    const position = snapshotRef.current.active.filter(
      (issue) => issue.status === status,
    ).length;
    void moveIssue(id, status, position);
  }

  async function archiveIssue(id: string): Promise<boolean> {
    return runMutation(async () => {
      startMutation();
      try {
        const response = await boardRequest<{ issue: Issue; snapshot: BoardSnapshot }>(`/api/issues/${id}/archive`, { method: "POST" });
        commitSnapshot(response.snapshot);
        closeIssue();
        setAnnouncement(`${response.issue.key} archived.`);
        showToast({ message: `${response.issue.key} archived.`, undo: () => { void restoreIssue(id, false); setToast(null); } });
        return true;
      } catch {
        return false;
      } finally {
        finishMutation();
      }
    });
  }

  async function restoreIssue(id: string, showConfirmation = true): Promise<boolean> {
    return runMutation(async () => {
      startMutation();
      try {
        const response = await boardRequest<{ issue: Issue; snapshot: BoardSnapshot }>(`/api/issues/${id}/restore`, { method: "POST" });
        commitSnapshot(response.snapshot);
        setMobileStatus(response.issue.status);
        setActionFailure((failure) => failure?.id === id ? null : failure);
        setAnnouncement(`${response.issue.key} restored.`);
        if (showConfirmation) showToast({ message: `${response.issue.key} restored to the board.` });
        return true;
      } catch {
        setActionFailure({ id, message: "Restore failed to confirm. Check the archive or retry.", retry: () => { void restoreIssue(id); } });
        setToast(null);
        return false;
      } finally {
        finishMutation();
      }
    });
  }

  async function createLabel(input: { name: string; color: LabelColor }) {
    return runMutation(async () => {
      startMutation();
      try {
        const response = await boardRequest<{
          label: Label;
          snapshot: BoardSnapshot;
        }>("/api/labels", {
          method: "POST",
          body: JSON.stringify(input),
        });
        commitSnapshot(response.snapshot);
        setAnnouncement(`${response.label.name} label added.`);
      } finally {
        finishMutation();
      }
    });
  }

  async function deleteLabel(label: Label) {
    return runMutation(async () => {
      startMutation();
      try {
        const response = await boardRequest<{ snapshot: BoardSnapshot }>(
          `/api/labels/${label.id}`,
          { method: "DELETE" },
        );
        commitSnapshot(response.snapshot);
        if (labelFilter === label.id) {
          setLabelFilter("");
        }
        setAnnouncement(`${label.name} label removed.`);
      } finally {
        finishMutation();
      }
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveIssueId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveIssueId(null);
    const { active, over } = event;
    if (!over) {
      return;
    }

    const issue = snapshot.active.find(
      (current) => current.id === String(active.id),
    );
    if (!issue) {
      return;
    }

    const overId = String(over.id);
    const overIssue = snapshot.active.find(
      (current) => current.id === overId,
    );
    const targetStatus = overId.startsWith("column:")
      ? (overId.replace("column:", "") as IssueStatus)
      : overIssue?.status;
    if (!targetStatus) {
      return;
    }

    const targetPosition = overIssue
      ? overIssue.position
      : snapshot.active.filter((current) => current.status === targetStatus)
        .length;
    void moveIssue(issue.id, targetStatus, targetPosition);
  }

  return (
    <div className="app-shell compact-board">
      <header className="app-header">
        <div className="brand-block">
          <button ref={navigationTriggerRef} type="button" className="icon-button board-navigation-toggle" title={navigation.open ? "Hide board panel" : "Show board panel"} aria-label={navigation.open ? "Hide board panel" : "Show board panel"} aria-expanded={navigation.open} aria-controls={navigation.open ? "board-navigation" : undefined} onClick={() => navigation.setOpen(!navigation.open)}><PanelLeft aria-hidden="true" size={20} /></button>
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <p className="brand-name">Tack</p>
            <p className="brand-subtitle">Team boards</p>
          </div>
        </div>
        <div className="header-context">
          <span
            className="live-dot"
            data-state={syncState}
            aria-hidden="true"
          />
          {sessionExpired ? "Sign-in required" : syncState === "refreshing"
            ? "Checking for updates"
            : syncState === "offline"
              ? "Connection paused"
              : "Shared team board"}

        </div>
        <div className="header-actions" inert={isNavigating}>
          <button
            type="button"
            className="header-button"
            onClick={() => {
              setMobileStatus("backlog");
              window.setTimeout(
                () =>
                  document
                    .querySelector<HTMLInputElement>(
                      '[data-quick-add="backlog"]',
                    )
                    ?.focus(),
                0,
              );
            }}
          >
            <Plus aria-hidden="true" size={17} />
            New card
            <kbd>C</kbd>
          </button>
          <details className="board-options" ref={optionsRef}>
            <summary ref={optionsTriggerRef} aria-label="Board options"><MoreHorizontal aria-hidden="true" size={20} /><span>Options</span></summary>
            <div className="board-options-panel">
              <button
                ref={archiveTriggerRef}
                type="button"
                className="header-button quiet"
                onClick={() => {
                  setSelectedIssueId(null);
                  setLabelsOpen(false);
                  setArchiveOpen(true);
                  updateUrl();
                }}
              >
                <Archive aria-hidden="true" size={17} />
                Archive
                {snapshot.archived.length ? (
                  <span className="archive-count">{snapshot.archived.length}</span>
                ) : null}
              </button>
              {currentMember.role === "admin" ? <button type="button" className="header-button quiet" disabled={pendingWrites > 0} onClick={openBoardManager}>Manage boards</button> : null}
              {currentMember.role === "admin" ? (
                <NextLink className="header-button quiet" href={`/team?board=${snapshot.board.id}`} onClick={event => { if (!canLeaveCapture()) event.preventDefault(); }}>
                  <Users aria-hidden="true" size={17} />
                  Team
                </NextLink>
              ) : null}
              {currentMember.role === "admin" ? (
                <button
                  ref={labelManagerTriggerRef}
                  type="button"
                  className="manage-labels-button"
                  onClick={() => {
                    setSelectedIssueId(null);
                    setArchiveOpen(false);
                    setLabelsOpen(true);
                    updateUrl();
                  }}
                >
                  <Tags aria-hidden="true" size={16} />
                  Manage labels
                </button>
              ) : null}
              <NextLink className="header-button quiet" href={`/settings/api-keys?board=${snapshot.board.id}`} onClick={event => { if (!canLeaveCapture()) event.preventDefault(); }}>API keys</NextLink>
              <p className="options-account">{currentMember.displayName} · {currentMember.role}</p>
              <button
                type="button"
                className="header-button quiet"
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  if (!canLeaveCapture()) return;
                  await authClient.signOut();
                  router.replace("/sign-in");
                  router.refresh();
                }}
              >
                <LogOut aria-hidden="true" size={17} />
                Sign out
              </button>
            </div>
          </details>
        </div>
      </header>

      <span className="visually-hidden" role="status">{isNavigating ? "Opening board…" : ""}</span>
      <div className={`board-workspace${navigation.open && !navigation.narrow ? " has-board-navigation" : ""}`}>
      {navigation.open ? <BoardNavigation boards={snapshot.boards} currentBoardId={snapshot.board.id} narrow={navigation.narrow} loading={isNavigating} disabled={pendingWrites > 0 || isNavigating} onClose={hideNavigation} onSwitch={switchBoard} onManage={currentMember.role === "admin" ? openBoardManager : undefined} /> : null}
      <main className="board-main" aria-busy={isNavigating} inert={isNavigating}>
        <div className="board-intro">
          <h1>{snapshot.board.name}</h1>
          <p>{isNavigating ? "Opening board…" : `${snapshot.active.length} active cards`}</p>
        </div>

        {boardUnavailable ? <div className="board-recovery" role="alert"><p>This board is no longer available.</p><NextLink href="/">Choose an available board</NextLink></div> : null}
        {!panelOpen && sessionExpired ? <div className="board-recovery"><SessionRecovery /><button type="button" className="secondary-button" disabled={syncState === "refreshing" || pendingWrites > 0} onClick={() => void refreshSnapshot()}>Check sign-in</button></div> : !panelOpen && syncState === "offline" ? <div className="board-recovery" role="status"><p>Shared updates are unavailable. This board may be out of date. Your confirmed changes are saved.</p><button type="button" className="secondary-button" onClick={() => void refreshSnapshot()}>Retry refresh</button></div> : null}
        {!panelOpen && actionFailure ? <div className="board-recovery"><p role="alert">{actionFailure.message}</p><div className="recovery-actions"><button type="button" className="secondary-button" disabled={pendingWrites > 0} onClick={actionFailure.retry}>Retry action</button><button type="button" className="secondary-button" disabled={pendingWrites > 0} onClick={() => void refreshSnapshot()}>Check board</button><button type="button" className="secondary-button" onClick={() => setActionFailure(null)}>Dismiss</button></div></div> : null}

        <section className="board-tools" aria-label="Find and filter issues">
          <div className="search-control">
            <Search aria-hidden="true" size={17} />
            <label className="visually-hidden" htmlFor="board-search">
              Search this board
            </label>
            <input
              id="board-search"
              data-board-search
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this board…"
              aria-describedby="search-scope"
              onKeyDown={event => { if (event.key === "Enter" && exactSearchKey) findCardKey(); }}
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X aria-hidden="true" size={15} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </div>

          <button type="button" className="filters-toggle secondary-button" aria-expanded={filtersOpen} aria-controls="board-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
            <SlidersHorizontal size={16} aria-hidden="true" />Filters{filterCount ? ` (${filterCount})` : ""}
          </button>
          <div id="board-filters" className="filter-controls" data-expanded={filtersOpen}>
            <label>
              <span>Assignee</span>
              <select
                aria-label="Filter by assignee"
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
              >
                <option value="">Anyone</option>
                <option value="unassigned">Unassigned</option>
                {snapshot.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Label</span>
              <select
                aria-label="Filter by label"
                value={labelFilter}
                onChange={(event) => setLabelFilter(event.target.value)}
              >
                <option value="">Any label</option>
                {snapshot.labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </label>


          </div>

          <div className={query.trim() ? "search-scope" : "visually-hidden"} id="search-scope">Search active cards on {snapshot.board.id} by key or title.
            {exactSearchKey ? <button type="button" className="secondary-button" onClick={findCardKey}>Open {exactSearchKey} across all boards and archives</button> : <span> Enter a full card key to open it anywhere, including old keys.</span>}
          </div>
          {copyViewFallback ? <label className="copy-fallback">Copy this view link<input readOnly value={copyViewFallback} onFocus={(event) => event.target.select()} /></label> : null}
          <div className="view-summary">
            {hasFilters ? <div className="active-filters" aria-label="Active filters">
              {query.trim() ? <button type="button" onClick={() => setQuery("")} aria-label="Remove search filter">“{query.trim()}” <X size={13} aria-hidden="true" /></button> : null}
              {assigneeFilter ? <button type="button" onClick={() => setAssigneeFilter("")} aria-label="Remove assignee filter">{assigneeFilter === "unassigned" ? "Unassigned" : snapshot.members.find((member) => member.id === assigneeFilter)?.displayName ?? "Assignee"} <X size={13} aria-hidden="true" /></button> : null}
              {labelFilter ? <button type="button" onClick={() => setLabelFilter("")} aria-label="Remove label filter">{snapshot.labels.find((label) => label.id === labelFilter)?.name ?? "Label"} <X size={13} aria-hidden="true" /></button> : null}
            </div> : null}
            <p>
              {hasFilters
                ? `${filteredIssues.length} of ${snapshot.active.length} cards shown`
                : `Active cards on ${snapshot.board.id}`}
              <span className="board-freshness"> · {pendingWrites ? "Saving changes…" : sessionExpired ? "Sign-in required" : syncState === "refreshing" ? "Checking updates…" : syncState === "offline" ? "Updates unavailable" : selectedIssueId || archiveOpen || labelsOpen ? "Updates paused" : lastChecked ? `Checked at ${lastChecked}` : "Board loaded"}</span>
            </p>
            <div>
              <button type="button" onClick={() => void copyView()}>
                <Link aria-hidden="true" size={15} />
                Copy view
              </button>
              {hasFilters ? (
                <button type="button" onClick={clearFilters}>
                  <X aria-hidden="true" size={15} />
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {hiddenCreatedIssue ? <div className="capture-notice">
          <p role="status">{hiddenCreatedIssue.key} added to {STATUS_META[hiddenCreatedIssue.status].label}. Hidden by your filters.</p>
          <div><button type="button" onClick={() => openIssue(hiddenCreatedIssue)}>Show card</button><button type="button" onClick={() => { clearFilters(); setMobileStatus(hiddenCreatedIssue.status); }}>Clear filters</button><button type="button" aria-label="Dismiss capture notice" onClick={() => setCreatedIssue(null)}><X size={16} aria-hidden="true" /></button></div>
        </div> : null}

        <nav className="mobile-status-nav" aria-label="Board columns">
          {ISSUE_STATUSES.map((status) => {
            const count = filteredIssues.filter(
              (issue) => issue.status === status,
            ).length;
            return (
              <button
                key={status}
                type="button"
                aria-current={
                  visibleMobileStatus === status ? "page" : undefined
                }
                onClick={() => setMobileStatus(status)}
              >
                {STATUS_META[status].shortLabel}
                <span>{count}</span>
              </button>
            );
          })}
        </nav>

        <DndContext
          id="tack-board-dnd"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveIssueId(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="board-grid">
            {ISSUE_STATUSES.map((status) => (
              <BoardColumn
                key={status}
                memberId={currentMember.id}
                boardId={snapshot.board.id}
                status={status}
                issues={filteredIssues.filter(
                  (issue) => issue.status === status,
                )}
                totalCount={
                  snapshot.active.filter((issue) => issue.status === status)
                    .length
                }
                isFiltered={hasFilters}
                activeIssueId={activeIssueId}
                selectedIssueId={selectedIssueId}
                mobileStatus={visibleMobileStatus}
                onRefresh={refreshSnapshot}
                onClearFilters={clearFilters}
                onCreate={createIssue}
                onOpen={openIssue}
                onMoveToStatus={moveToStatus}
              />
            ))}
          </div>
          {typeof document !== "undefined"
            ? createPortal(
              <DragOverlay dropAnimation={null}>
                {activeIssue ? (
                  <IssueCard issue={activeIssue} overlay />
                ) : null}
              </DragOverlay>,
              document.body,
            )
            : null}
        </DndContext>
      </main>
      </div>

      {selectedIssue && !selectedIssue.archivedAt ? (
        <IssueDrawer
          key={selectedIssue.id}
          navigationGuardRef={navigationGuardRef}
          issue={selectedIssue}
          boards={snapshot.boards}
          onTransfer={transferIssue}
          memberId={currentMember.id}
          sessionExpired={sessionExpired}
          feedback={toast?.message.startsWith(selectedIssue.key + " ") ? toast : null}
          members={snapshot.members}
          labels={snapshot.labels}
          columnLength={
            snapshot.active.filter(
              (issue) => issue.status === selectedIssue.status,
            ).length
          }
          onClose={closeIssue}
          onUpdate={updateIssue}
          onMove={(id, status, position) => moveIssue(id, status, position)}
          onArchive={archiveIssue}
        />
      ) : null}

      {archiveOpen ? (
        <ArchiveDrawer
          issues={snapshot.archived}
          sessionExpired={sessionExpired}
          onClose={closeArchive}
          onOpen={openIssue}
          onRestore={restoreIssue}
        />
      ) : null}

      {boardsOpen ? <BoardManagerDrawer onBoardsChange={updateBoards} boards={snapshot.boards} currentBoardId={snapshot.board.id} returnFocusRef={managerReturnRef} onClose={() => { setBoardsOpen(false); window.setTimeout(() => void refreshSnapshot(), 0); }} onSwitch={switchBoard} /> : null}

      {labelsOpen ? (
        <LabelManagerDrawer
          labels={snapshot.labels}
          sessionExpired={sessionExpired}
          onClose={closeLabelManager}
          onCreate={createLabel}
          onDelete={deleteLabel}
        />
      ) : null}

      {selectedIssue?.archivedAt ? (
        <DetailDrawer
          closeLabel={archiveOrigin.current ? "Back to archive" : "Close archived card"}
          closeDisabled={archivePending}
          eyebrow={selectedIssue.key}
          title={selectedIssue.title}
          titleId="archived-issue-title"
          onClose={() => { if (!archivePending) closeIssue(); }}
        >
          <div className="drawer-body">
            <p>Archived · {STATUS_META[selectedIssue.status].label}</p>
            <BoardTransfer issue={selectedIssue} boards={snapshot.boards} disabled={archivePending} onTransfer={boardId => transferIssue(selectedIssue.id, boardId)} />
              <div className="markdown-body"><ReactMarkdown>{selectedIssue.description || "No description."}</ReactMarkdown></div>
          </div>
          {archiveError || sessionExpired ? <div className="drawer-messages">{archiveError ? <p className="drawer-error" role="alert">{archiveError}</p> : null}{sessionExpired ? <SessionRecovery /> : null}</div> : null}
          <div className="drawer-footer">
            <button type="button" className="secondary-button" disabled={archivePending} onClick={() => closeIssue()}>{archiveOrigin.current ? "Back to archive" : "Close"}</button>
            <button type="button" className="primary-button" disabled={archivePending} onClick={async () => {
              setArchivePending(true);
              setArchiveError("");
              const restored = await restoreIssue(selectedIssue.id);
              setArchivePending(false);
              if (restored) { archiveOrigin.current = false; /* The restored card stays open for review. */ }
              else setArchiveError("Restore failed to confirm. Your archived view is retained. Try again.");
            }}><RotateCcw aria-hidden="true" size={16} />{archivePending ? "Restoring…" : "Restore"}</button>
          </div>
        </DetailDrawer>
      ) : null}

      {missingKey ? (
        <DetailDrawer closeLabel="Return to board" eyebrow={missingKey} title="Card unavailable" titleId="missing-card-title" onClose={closeIssue}>
          <div className="drawer-body"><p>That card could not be found. Your board filters are still available.</p><button type="button" className="primary-button" onClick={() => closeIssue()}>Return to board</button></div>
        </DetailDrawer>
      ) : null}

      {toast && !panelOpen ? (
        <div className="toast">
          <span role="status">{toast.message}</span>
          {toast.undo ? (
            <button type="button" onClick={toast.undo}>
              <RotateCcw aria-hidden="true" size={15} />
              Undo
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

    </div>
  );
}
