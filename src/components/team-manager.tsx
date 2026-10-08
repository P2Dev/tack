"use client";

import {
  ArrowLeft,
  Check,
  Download,
  KeyRound,
  Shield,
  UserPlus,
  UserRoundX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState, useTransition } from "react";

import { SessionRecovery } from "@/components/session-recovery";
import { authClient } from "@/lib/auth-client";
import {
  LABEL_COLORS,
  type LabelColor,
  type TeamMember,
} from "@/lib/types";

type TeamManagerProps = {
  boardHref?: string;
  currentUserId: string;
  initialMembers: TeamMember[];
};

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function TeamManager({
  boardHref = "/",
  currentUserId,
  initialMembers,
}: TeamManagerProps) {
  const router = useRouter();
  const members = initialMembers;
  const actionInFlight = useRef(false);
  const [refreshing, startRefresh] = useTransition();
  const [feedbackKey, setFeedbackKey] = useState("");
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);

  async function runAction(
    key: string,
    action: () => Promise<{ error?: { message?: string; status?: number } | null }>,
    successMessage: string,
  ) {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setFeedbackKey(key);
    setExpired(false);
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (result.error) {
        setExpired(result.error.status === 401);
        setError(result.error.message ?? "That account change was not saved.");
        return false;
      }

      setMessage(successMessage);
      startRefresh(() => router.refresh());
      return true;
    } catch {
      setError("The change could not be confirmed. Your input is still here. Check the account before trying again.");
      return false;
    } finally {
      actionInFlight.current = false;
      setBusy("");
    }
  }

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const role = String(form.get("role")) === "admin" ? "admin" : "user";
    if (!name) {
      setFeedbackKey("create");
      setError("Enter a name.");
      return;
    }

    const created = await runAction(
      "create",
      () =>
        authClient.admin.createUser({
          name,
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
          role,
          data: {
            initials: initialsFor(name),
            color: String(form.get("color") ?? "blue"),
          },
        }),
      `${name} can now sign in.`,
    );
    if (created) {
      formElement.reset();
    }
  }

  async function resetPassword(
    event: FormEvent<HTMLFormElement>,
    member: TeamMember,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");

    const reset = await runAction(
      `password:${member.id}`,
      () =>
        authClient.admin.setUserPassword({
          userId: member.id,
          newPassword,
        }),
      `${member.displayName}'s password was reset.`,
    );
    if (reset) {
      closePasswordForm(member.id);
    }
  }

  function closePasswordForm(id: string) {
    setResetUserId(null);
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-reset-member="${id}"]`)?.focus(), 0);
  }

  function feedbackFor(scope: string) {
    if (!(feedbackKey === scope || feedbackKey.endsWith(`:${scope}`))) return null;
    return <div className="account-feedback">
      {busy ? <p role="status">{busy.startsWith("password:") ? "Saving password…" : busy.startsWith("role:") ? "Changing role…" : busy.startsWith("status:") ? "Updating access…" : "Creating account…"}</p> : null}
      {error ? <p role="alert" className="inline-error">{error}</p> : null}
      {expired ? <SessionRecovery returnTo="/team" /> : null}
      {message ? <p role="status">{message}</p> : null}
    </div>;
  }

  const activeAdminCount = members.filter(
    (member) => member.role === "admin" && !member.disabled,
  ).length;

  return (
    <main className="team-shell">
      <header className="team-header">
        <div>
          <Link className="back-link" href={boardHref}>
            <ArrowLeft aria-hidden="true" size={16} />
            Back to board
          </Link>
          <p className="eyebrow">Administrator</p>
          <h1>Team access</h1>
          <p>
            Accounts grant access to every board in this workspace. Administrators
            also manage boards, labels, accounts, and exports.
          </p>
        </div>
        <span className="team-count">
          {members.length} {members.length === 1 ? "account" : "accounts"}
        </span>
      </header>

      <div className="team-layout">
        <section className="team-list-panel" aria-labelledby="team-list-title">
          <div className="panel-heading">
            <div>
              <h2 id="team-list-title">People with access</h2>
              <p>Disabled accounts stay visible on historical assignments.</p>
            </div>
          </div>

          <div className="member-list">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              const isLastAdmin =
                member.role === "admin" &&
                !member.disabled &&
                activeAdminCount === 1;

              return (
                <article
                  className="member-row"
                  data-disabled={member.disabled || undefined}
                  key={member.id}
                >
                  <span className="member-avatar" data-color={member.color}>
                    {member.initials}
                  </span>
                  <div className="member-identity">
                    <div>
                      <h3>{member.displayName}</h3>
                      {isSelf ? <span className="you-badge">You</span> : null}
                      {member.role === "admin" ? (
                        <span className="role-badge">
                          <Shield aria-hidden="true" size={12} />
                          Admin
                        </span>
                      ) : null}
                      {member.disabled ? (
                        <span className="disabled-badge">Disabled</span>
                      ) : null}
                    </div>
                    <p>{member.email}</p>
                  </div>
                  <div className="member-actions">
                    <button
                      data-reset-member={member.id}
                      aria-expanded={resetUserId === member.id}
                      className="secondary-button"
                      type="button"
                      disabled={Boolean(busy) || refreshing}
                      onClick={() =>
                        setResetUserId((current) =>
                          current === member.id ? null : member.id,
                        )
                      }
                    >
                      <KeyRound aria-hidden="true" size={15} />
                      Reset password
                    </button>
                    {!isSelf ? (
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={Boolean(busy) || refreshing || isLastAdmin}
                        onClick={() =>
                          void runAction(
                            `role:${member.id}`,
                            () =>
                              authClient.admin.setRole({
                                userId: member.id,
                                role:
                                  member.role === "admin" ? "user" : "admin",
                              }),
                            `${member.displayName} is now ${member.role === "admin" ? "a member" : "an admin"
                            }.`,
                          )
                        }
                      >
                        <Shield aria-hidden="true" size={15} />
                        {member.role === "admin"
                          ? "Make member"
                          : "Make admin"}
                      </button>
                    ) : null}
                    <button
                      className={
                        member.disabled ? "secondary-button" : "danger-button"
                      }
                      type="button"
                      disabled={Boolean(busy) || refreshing || isSelf || isLastAdmin}
                      title={
                        isSelf
                          ? "You cannot disable your current account."
                          : isLastAdmin
                            ? "Keep at least one active administrator."
                            : undefined
                      }
                      onClick={() =>
                        void runAction(
                          `status:${member.id}`,
                          () =>
                            member.disabled
                              ? authClient.admin.unbanUser({
                                userId: member.id,
                              })
                              : authClient.admin.banUser({
                                userId: member.id,
                                banReason: "Disabled by a Tack administrator",
                              }),
                          `${member.displayName} was ${member.disabled ? "enabled" : "disabled"
                          }.`,
                        )
                      }
                    >
                      {member.disabled ? (
                        <Check aria-hidden="true" size={15} />
                      ) : (
                        <UserRoundX aria-hidden="true" size={15} />
                      )}
                      {member.disabled ? "Enable" : "Disable"}
                    </button>
                  </div>

                  {isSelf || isLastAdmin ? <p className="account-protection">{isSelf ? "Your current account cannot be disabled or have its role changed here." : "Keep at least one active administrator."}</p> : null}
                  {feedbackFor(member.id)}
                  {resetUserId === member.id ? (
                    <form
                      className="password-reset-row"
                      onSubmit={(event) => void resetPassword(event, member)}
                    >
                      <label>
                        <span>Temporary password</span>
                        <input
                          disabled={Boolean(busy) || refreshing}
                          name="newPassword"
                          type="password"
                          minLength={10}
                          maxLength={128}
                          autoComplete="new-password"
                          required
                          autoFocus
                        />
                      </label>
                      <button
                        className="primary-button"
                        disabled={Boolean(busy) || refreshing}
                      >
                        {busy === `password:${member.id}` ? "Saving…" : "Save password"}
                      </button>
                      <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => { closePasswordForm(member.id); setError(""); setMessage(""); setExpired(false); }}>Cancel</button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="team-sidebar">
          <section className="create-member-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Invite without email</p>
                <h2>Create an account</h2>
                <p>
                  Share the temporary password through your usual secure
                  channel.
                </p>
              </div>
              <UserPlus aria-hidden="true" size={20} />
            </div>
            <form className="create-member-form" onSubmit={createMember}>
              <label>
                <span>Name</span>
                <input disabled={Boolean(busy) || refreshing} name="name" required maxLength={80} />
              </label>
              <label>
                <span>Email</span>
                <input disabled={Boolean(busy) || refreshing} name="email" type="email" required />
              </label>
              <label>
                <span>Temporary password</span>
                <input
                  disabled={Boolean(busy) || refreshing}
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="inline-fields">
                <label>
                  <span>Role</span>
                  <select disabled={Boolean(busy) || refreshing} name="role" defaultValue="member">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label>
                  <span>Avatar color</span>
                  <select disabled={Boolean(busy) || refreshing} name="color" defaultValue="blue">
                    {LABEL_COLORS.map((color: LabelColor) => (
                      <option key={color} value={color}>
                        {color[0].toUpperCase() + color.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="primary-button create-account-button"
                disabled={Boolean(busy) || refreshing}
              >
                <UserPlus aria-hidden="true" size={16} />
                {busy === "create" ? "Creating…" : "Create account"}
              </button>
            </form>
            {feedbackFor("create")}
          </section>

          <section
            className="data-export-panel"
            aria-labelledby="data-export-title"
          >
            <p className="eyebrow">Data portability</p>
            <h2 id="data-export-title">Export workspace</h2>
            <p>
              JSON includes all boards, active and archived cards, labels, and account profiles.
              CSV includes active and archived cards from every board, with their labels and assignees.
              Passwords and sessions are never included.
            </p>
            <div className="export-actions">
              <a
                className="secondary-button export-button"
                href="/api/export?format=json"
                download
              >
                <Download aria-hidden="true" size={15} />
                JSON
              </a>
              <a
                className="secondary-button export-button"
                href="/api/export?format=csv"
                download
              >
                <Download aria-hidden="true" size={15} />
                CSV
              </a>
            </div>
          </section>
        </aside>
      </div>

    </main>
  );
}
