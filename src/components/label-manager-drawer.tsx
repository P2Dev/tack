"use client";

import { Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";

import { SessionRecovery } from "@/components/session-recovery";
import { DetailDrawer } from "@/components/detail-drawer";
import type { Label, LabelColor } from "@/lib/types";
import { LABEL_COLORS } from "@/lib/types";

const COLOR_NAMES: Record<LabelColor, string> = {
  rust: "Rust",
  blue: "Blue",
  gold: "Gold",
  green: "Green",
  slate: "Slate",
  violet: "Violet",
};

type LabelManagerDrawerProps = {
  labels: Label[];
  sessionExpired: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; color: LabelColor }) => Promise<void>;
  onDelete: (label: Label) => Promise<void>;
};

export function LabelManagerDrawer({
  labels,
  sessionExpired,
  onClose,
  onCreate,
  onDelete,
}: LabelManagerDrawerProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("rust");
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<Label | null>(null);
  const [operation, setOperation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createLabel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || pending) {
      return;
    }

    setPending(true);
    setMessage("");
    setOperation("Adding label…");
    setError("");
    try {
      await onCreate({ name: cleanName, color });
      setName("");
      setMessage(`${cleanName} label added.`);
      window.setTimeout(() => document.getElementById("label-name")?.focus(), 0);
    } catch (error) {
      const status = (error as { status?: number }).status;
      setError(status === 401 ? "Sign in again to add this label." : status === 403 ? "Only administrators can manage labels." : status === 409 || status === 400 ? (error as Error).message : "Couldn’t confirm the new label. Your name and color are retained. Check the list before trying again.");
    } finally {
      setPending(false);
    }
  }

  async function deleteLabel(label: Label) {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    setOperation(`Removing ${label.name}…`);
    try {
      await onDelete(label);
      setRemoving(null);
      setMessage(`${label.name} removed from the workspace and every card.`);
      window.setTimeout(() => document.getElementById("label-name")?.focus(), 0);
    } catch (error) {
      const status = (error as { status?: number }).status;
      setError(status === 401 ? "Sign in again to remove this label." : status === 403 ? "Only administrators can manage labels." : "Couldn’t confirm removal. Check the label list or try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DetailDrawer
      className="label-drawer"
      closeLabel="Close label manager"
      eyebrow="Workspace vocabulary"
      closeDisabled={pending}
      onClose={() => { if (!pending) onClose(); }}
      title="Manage labels"
      titleId="label-manager-title"
    >
      <div className="drawer-body">
        <p className="drawer-intro">
          Keep the list short. Labels add context; they never block a card from
          moving.
        </p>

        <form className="label-create-form" onSubmit={createLabel}>
          <div className="field-group">
            <label htmlFor="label-name">Label name</label>
            <input
              id="label-name"
              value={name}
              maxLength={24}
              onChange={(event) => setName(event.target.value)}
              placeholder="For example, Docs"
              autoComplete="off"
              disabled={pending}
            />
          </div>

          <fieldset className="color-picker">
            <legend>Color</legend>
            <div>
              {LABEL_COLORS.map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="label-color"
                    value={option}
                    checked={color === option}
                    onChange={() => setColor(option)}
                    disabled={pending}
                  />
                  <span
                    className="color-swatch"
                    data-color={option}
                    aria-hidden="true"
                  />
                  <span className="visually-hidden">{COLOR_NAMES[option]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="primary-button label-create-button"
            disabled={!name.trim() || pending}
          >
            <Plus aria-hidden="true" size={16} />
            {pending && operation === "Adding label…" ? "Adding…" : "Add label"}
          </button>
        </form>


        <section className="label-list-section" aria-labelledby="label-list-title">
          <div className="label-list-heading">
            <div>
              <h3 id="label-list-title">Available labels</h3>
              <p>{labels.length} total</p>
            </div>
            <Tags aria-hidden="true" size={18} />
          </div>

          <div className="managed-label-list">
            {labels.map((label) => (
              <div className="managed-label" key={label.id}>
                <span className="label-chip" data-color={label.color}>
                  {label.name}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  data-remove-label={label.id}
                  aria-label={`Remove ${label.name} label`}
                  onClick={() => { setRemoving(label); setError(""); setMessage(""); window.setTimeout(() => document.querySelector<HTMLElement>("[data-cancel-label-removal]")?.focus(), 0); }}
                  disabled={pending}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
      {removing || error || message || pending || sessionExpired ? <div className="drawer-messages">
        {removing ? <div className="label-removal" role="group" aria-labelledby="label-removal-prompt"><p id="label-removal-prompt">Remove “{removing.name}” from the workspace and every card?</p><div className="recovery-actions"><button type="button" className="danger-button" disabled={pending} onClick={() => void deleteLabel(removing)}>Remove label</button><button type="button" className="secondary-button" data-cancel-label-removal aria-describedby="label-removal-prompt" disabled={pending} onClick={() => { const id = removing.id; setRemoving(null); setError(""); window.setTimeout(() => document.querySelector<HTMLElement>(`[data-remove-label="${id}"]`)?.focus(), 0); }}>Cancel</button></div></div> : null}
        {pending ? <p role="status">{operation}</p> : null}
        {error ? <p className="drawer-error" role="alert">{error}</p> : null}
        {sessionExpired ? <SessionRecovery /> : null}
        {message ? <p role="status">{message}</p> : null}
      </div> : null}
    </DetailDrawer>
  );
}
