"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type RefObject, type ReactNode } from "react";

type DetailDrawerProps = {
  children: ReactNode;
  className?: string;
  closeLabel: string;
  closeDisabled?: boolean;
  descriptionId?: string;
  eyebrow: ReactNode;
  eyebrowId?: string;
  onClose: () => void | Promise<void>;
  title: ReactNode;
  titleId: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function DetailDrawer({
  children,
  className,
  closeLabel,
  closeDisabled = false,
  descriptionId,
  eyebrow,
  eyebrowId,
  onClose,
  title,
  titleId,
  returnFocusRef,
}: DetailDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnTarget = returnFocusRef?.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (returnFocusRef) window.setTimeout(() => {
        if (!document.querySelector("dialog[open]")) returnTarget?.focus();
      }, 0);
    };
  }, [returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className={["detail-drawer", className].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, summary, [tabindex]',
        )).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) void onClose();
      }}
    >
      <div className="drawer-header">
        <div>
          <p className="drawer-eyebrow" id={eyebrowId}>
            {eyebrow}
          </p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="icon-button"
          aria-label={closeLabel}
          disabled={closeDisabled}
          onClick={() => void onClose()}
        >
          <X aria-hidden="true" size={19} />
        </button>
      </div>
      <p className="drawer-freshness">Shared updates pause while this panel is open.</p>
      {children}
    </dialog>
  );
}
