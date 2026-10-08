"use client";
import Link from "next/link";
import { ArrowLeft, KeyRound, Plus } from "lucide-react";
import { useRef, useState } from "react";
import type { AgentKeyView, KeyScope } from "@/lib/agent-contract";
import { SessionRecovery } from "@/components/session-recovery";

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        data.error?.message ||
          "The change could not be confirmed. Refresh the list before retrying.",
      ),
      { status: response.status },
    );
  return data;
}
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC" : "Never";
}
function KeyRow({
  item,
  own,
  onChanged,
}: {
  item: AgentKeyView;
  own: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expiredSession, setExpiredSession] = useState(false);
  const revokeRef = useRef<HTMLButtonElement>(null);
  const renameRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [now] = useState(() => Date.now());
  const state = item.revokedAt
    ? "Revoked"
    : new Date(item.expiresAt).getTime() <= now
      ? "Expired"
      : "Active";
  async function change(init: RequestInit) {
    setPending(true);
    setError("");
    setExpiredSession(false);
    try {
      await request(`/api/keys/${item.id}`, init);
      setEditing(false);
      setConfirm(false);
      await onChanged();
      window.setTimeout(() => headingRef.current?.focus(), 0);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The change failed.");
      setExpiredSession((error as { status?: number }).status === 401);
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="api-key-row" aria-labelledby={`key-${item.id}`}>
      <div className="api-key-row-heading">
        <h3 ref={headingRef} tabIndex={-1} id={`key-${item.id}`}>
          {item.name}
        </h3>
        <span className="key-state" data-state={state}>
          {state}
        </span>
      </div>
      {!own ? <p>Owned by {item.ownerName}</p> : null}
      <p>
        <code>{item.prefix}…</code> ·{" "}
        {item.scopes
          .map(
            (scope) =>
              ({
                read: "Read",
                write: "Update cards",
                archive: "Archive / restore",
                transfer: "Transfer",
              })[scope],
          )
          .join(", ")}
      </p>
      <p>
        Boards:{" "}
        {item.boardIds?.join(", ") ?? "All boards, including future boards"}
      </p>
      <dl className="key-dates">
        <div>
          <dt>Created</dt>
          <dd>{date(item.createdAt)}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{date(item.expiresAt)}</dd>
        </div>
        <div>
          <dt>Last used</dt>
          <dd>{date(item.lastUsedAt)}</dd>
        </div>
      </dl>
      {editing ? (
        <form
          className="key-rename"
          onSubmit={(event) => {
            event.preventDefault();
            void change({ method: "PATCH", body: JSON.stringify({ name }) });
          }}
        >
          <label>
            Key name
            <input
              autoFocus
              required
              maxLength={80}
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button className="primary-button" disabled={pending}>
            Save name
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              window.setTimeout(() => renameRef.current?.focus(), 0);
            }}
          >
            Cancel rename
          </button>
        </form>
      ) : (
        <div className="recovery-actions">
          {own ? (
            <button
              ref={renameRef}
              type="button"
              className="secondary-button"
              disabled={pending}
              onClick={() => {
                setName(item.name);
                setEditing(true);
              }}
            >
              Rename {item.name}
            </button>
          ) : null}
          {state === "Active" ? (
            <button
              ref={revokeRef}
              className="danger-button"
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirm(true);
                window.setTimeout(() => cancelRef.current?.focus(), 0);
              }}
            >
              Revoke {item.name}
            </button>
          ) : null}
        </div>
      )}
      {confirm ? (
        <div className="key-revoke">
          <p>
            Revoke {item.name}? Its agent will lose access on subsequent
            requests. Completed changes remain saved.
          </p>
          <div className="recovery-actions">
            <button
              ref={cancelRef}
              className="secondary-button"
              disabled={pending}
              onClick={() => {
                setConfirm(false);
                window.setTimeout(() => revokeRef.current?.focus(), 0);
              }}
            >
              Cancel revocation
            </button>
            <button
              className="danger-button"
              disabled={pending}
              onClick={() => void change({ method: "DELETE" })}
            >
              {pending ? "Revoking…" : "Confirm revocation"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {expiredSession ? <SessionRecovery /> : null}
    </article>
  );
}
export function ApiKeyManager({
  initialKeys,
  boards,
  currentBoardId,
  userId,
  admin,
  baseUrl,
}: {
  initialKeys: AgentKeyView[];
  boards: { id: string; name: string }[];
  currentBoardId: string;
  userId: string;
  admin: boolean;
  baseUrl: string;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [showForm, setShowForm] = useState(false);
  const [allUsers, setAllUsers] = useState(false);
  const [name, setName] = useState("");
  const [write, setWrite] = useState(false);
  const [archive, setArchive] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [allBoards, setAllBoards] = useState(false);
  const [boardIds, setBoardIds] = useState<string[]>(
    currentBoardId ? [currentBoardId] : [],
  );
  const [days, setDays] = useState(90);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const newRef = useRef<HTMLButtonElement>(null);
  const secretRef = useRef<HTMLInputElement>(null);
  async function refresh(all = allUsers) {
    const data = await request(`/api/keys${all ? "?all=1" : ""}`);
    setKeys(data.keys);
  }
  async function reload(all = allUsers) {
    const previous = allUsers;
    setAllUsers(all);
    setPending(true);
    setError("");
    try {
      await refresh(all);
      setExpired(false);
      setMessage("Key list refreshed.");
    } catch (error) {
      setAllUsers(previous);
      setError((error as Error).message);
      setExpired((error as { status?: number }).status === 401);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="team-shell api-keys-shell">
      <header className="team-header">
        <div>
          <Link className="back-link" href={`/?board=${currentBoardId}`}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to board
          </Link>
          <p className="eyebrow">Your account</p>
          <h1>API keys</h1>
          <p>
            Give each agent its own key. Choose the boards and actions it can
            use, then revoke access whenever you need to.
          </p>
        </div>
        <button
          ref={newRef}
          className="primary-button"
          disabled={pending || Boolean(secret)}
          onClick={() => {
            setShowForm(true);
            setError("");
            setMessage("");
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Create API key
        </button>
      </header>
      {expired ? <SessionRecovery /> : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {secret ? (
        <section className="key-secret" aria-labelledby="key-secret-title">
          <h2 id="key-secret-title">Your API key is ready</h2>
          <p>
            Copy this key now; it will not be shown again. Store it in your
            agent’s secret or environment configuration.
          </p>
          <label>
            New API key
            <input
              ref={secretRef}
              autoFocus
              readOnly
              value={secret}
              onFocus={(event) => event.target.select()}
              spellCheck={false}
            />
          </label>
          <div className="recovery-actions">
            <button
              className="primary-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(secret);
                  setMessage("API key copied.");
                } catch {
                  secretRef.current?.focus();
                  secretRef.current?.select();
                  setMessage("Copy the selected key manually.");
                }
              }}
            >
              Copy API key
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setSecret("");
                setMessage(
                  "Key hidden. You can create a replacement if you lose it.",
                );
                window.setTimeout(() => newRef.current?.focus(), 0);
              }}
            >
              I’ve stored my key
            </button>
          </div>
          <p>
            Set <code>TACK_BASE_URL</code> to <code>{baseUrl}</code> and{" "}
            <code>TACK_API_KEY</code> to this value. Your first connection check
            is <code>GET /api/v1/me</code>.
          </p>
        </section>
      ) : null}
      {showForm && !secret ? (
        <section className="key-create" aria-labelledby="create-key-title">
          <h2 id="create-key-title">Connect an agent</h2>
          <form
            className="create-member-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              setExpired(false);
              setMessage("");
              const scopes: KeyScope[] = [
                "read",
                ...(write ? ["write" as const] : []),
                ...(archive ? ["archive" as const] : []),
                ...(transfer ? ["transfer" as const] : []),
              ];
              try {
                const result = await request("/api/keys", {
                  method: "POST",
                  body: JSON.stringify({
                    name,
                    scopes,
                    boardIds: allBoards ? null : boardIds,
                    days,
                  }),
                });
                setSecret(result.secret);
                setShowForm(false);
                setName("");
                await refresh();
              } catch (error) {
                setError(
                  (error as Error).message +
                    " Check the list before retrying if creation was interrupted.",
                );
                setExpired((error as { status?: number }).status === 401);
                try {
                  await refresh();
                } catch {
                  /* Recovery remains available. */
                }
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              Agent or key name
              <input
                autoFocus
                required
                maxLength={80}
                value={name}
                disabled={pending}
                onChange={(event) => setName(event.target.value)}
                placeholder="Local coding agent"
              />
            </label>
            <fieldset disabled={pending}>
              <legend>Access</legend>
              <label className="key-choice">
                <input
                  type="checkbox"
                  checked={write}
                  onChange={(event) => setWrite(event.target.checked)}
                />
                Read and update cards
              </label>
              <p>
                Read-only unless enabled. Updates include creating cards,
                editing details, assigning, and changing status.
              </p>
              <label className="key-choice">
                <input
                  type="checkbox"
                  checked={archive}
                  onChange={(event) => setArchive(event.target.checked)}
                />
                Allow archiving and restoring
              </label>
              <label className="key-choice">
                <input
                  type="checkbox"
                  checked={transfer}
                  onChange={(event) => setTransfer(event.target.checked)}
                />
                Allow transfers between permitted boards
              </label>
            </fieldset>
            <fieldset disabled={pending}>
              <legend>Boards</legend>
              <label className="key-choice">
                <input
                  type="checkbox"
                  checked={allBoards}
                  onChange={(event) => setAllBoards(event.target.checked)}
                />
                All boards, including future boards
              </label>
              {!allBoards ? (
                <div className="key-board-options">
                  {boards.map((board) => (
                    <label className="key-choice" key={board.id}>
                      <input
                        type="checkbox"
                        checked={boardIds.includes(board.id)}
                        onChange={(event) =>
                          setBoardIds((current) =>
                            event.target.checked
                              ? [...current, board.id]
                              : current.filter((id) => id !== board.id),
                          )
                        }
                      />
                      {board.name} ({board.id})
                    </label>
                  ))}
                </div>
              ) : null}
              {!allBoards && !boardIds.length ? (
                <p>Select at least one board.</p>
              ) : null}
            </fieldset>
            <label>
              Expires after
              <select
                value={days}
                disabled={pending}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
            <p>
              Keys cannot manage accounts, create more API keys, or export the
              workspace—even if you are an administrator. To change a key’s
              access, create a replacement and revoke the old key.
            </p>
            <div className="recovery-actions">
              <button
                className="primary-button"
                disabled={pending || (!allBoards && !boardIds.length)}
              >
                {pending ? "Creating…" : "Generate key"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={pending}
                onClick={() => {
                  setShowForm(false);
                  newRef.current?.focus();
                }}
              >
                Cancel creation
              </button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="key-list" aria-labelledby="keys-list-title" aria-busy={pending}>
        <div className="key-list-heading">
          <h2 id="keys-list-title">
            {allUsers ? "Workspace keys" : "Your keys"}
          </h2>
          <div className="recovery-actions">
            {admin ? (
              <label className="key-choice">
                <input
                  type="checkbox"
                  checked={allUsers}
                  disabled={pending}
                  onChange={(event) => void reload(event.target.checked)}
                />
                Show all users’ keys
              </label>
            ) : null}
            <button
              className="secondary-button"
              disabled={pending}
              onClick={() => void reload()}
            >
              {pending ? "Refreshing…" : "Refresh keys"}
            </button>
          </div>
        </div>
        {!keys.length ? (
          <div className="key-empty">
            <KeyRound aria-hidden="true" />
            <p>
              No API keys yet. Create a key when you’re ready to connect an
              agent.
            </p>
          </div>
        ) : (
          keys.map((item) => (
            <KeyRow
              key={item.id}
              item={item}
              own={item.userId === userId}
              onChanged={() => refresh()}
            />
          ))
        )}
      </section>
      <section className="key-connection">
        <h2>Connect locally</h2>
        <p>
          The optional MCP adapter runs beside your agent and calls Tack using
          its API key. You can also call the API directly.
        </p>
        <pre>{`curl -H "Authorization: Bearer $TACK_API_KEY" \\\n  "$TACK_BASE_URL/api/v1/me"`}</pre>
        <p>
          Expired or revoked key? Create a replacement, update your agent’s
          configuration, and retry. Rotating a key does not change your Tack
          password.
        </p>
      </section>
    </main>
  );
}
