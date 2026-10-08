"use client";

import { useState, useSyncExternalStore } from "react";
import { DetailDrawer } from "@/components/detail-drawer";
import type { BoardInfo } from "@/lib/types";

const preferenceKey = "tack:board-navigation-visible";
const preferenceEvent = "tack:board-navigation-change";
const mediaQuery = "(max-width: 1100px)";
function subscribeWidth(listener: () => void) {
  const media = window.matchMedia(mediaQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function subscribePreference(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(preferenceEvent, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(preferenceEvent, listener); };
}
function readPreference() {
  try { return localStorage.getItem(preferenceKey) !== "false"; } catch { return true; }
}
export function useBoardNavigation() {
  const narrow = useSyncExternalStore(subscribeWidth, () => window.matchMedia(mediaQuery).matches, () => true);
  const preference = useSyncExternalStore(subscribePreference, readPreference, () => true);
  const [fallback, setFallback] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const open = narrow ? mobileOpen : fallback ?? preference;
  function setOpen(value: boolean) {
    if (narrow) setMobileOpen(value);
    else {
      try { localStorage.setItem(preferenceKey, String(value)); window.dispatchEvent(new Event(preferenceEvent)); }
      catch { setFallback(value); }
    }
  }
  return { open, narrow, setOpen };
}

export function BoardNavigation({ boards, currentBoardId, narrow, disabled, loading, onClose, onSwitch, onManage }: {
  boards: BoardInfo[]; currentBoardId: string; narrow: boolean; disabled: boolean; loading: boolean; onClose: () => void; onSwitch: (id: string) => void; onManage?: () => void;
}) {
  const navigation = <nav aria-label="Boards" className="board-navigation-list" aria-busy={loading}>{boards.map(board => <button
    key={board.id} type="button" className="board-navigation-link" aria-current={board.id === currentBoardId ? "page" : undefined}
    disabled={disabled} onClick={() => board.id === currentBoardId ? (narrow && onClose()) : onSwitch(board.id)}
  ><span>{board.name}</span><small>{board.id}</small></button>)}</nav>;
  const manage = onManage ? <button type="button" className="board-navigation-manage secondary-button" disabled={disabled} onClick={onManage}>Manage boards</button> : null;
  if (narrow) return <DetailDrawer className="board-navigation-drawer" title="Boards" titleId="board-navigation-title" eyebrow="Workspace" closeLabel="Hide board panel" onClose={onClose}>
    <div id="board-navigation" className="drawer-body">{loading ? <p role="status">Opening board…</p> : null}{navigation}{manage}</div>
  </DetailDrawer>;
  return <aside id="board-navigation" className="board-navigation" aria-label="Board panel">
    <div className="board-navigation-heading"><h2>Boards</h2></div>
    {navigation}{manage}
  </aside>;
}
