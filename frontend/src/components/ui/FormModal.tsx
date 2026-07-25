/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared modal form. Handles the boilerplate every form dialog repeats: the
 * Dialog shell, title/description, submit/busy state, error display, and the
 * Cancel/Submit footer. Pass fields as children and an async `onSubmit` that
 * throws on failure — the modal closes itself on success.
 *
 *   <FormModal isOpen title="Add menu" submitLabel="Add" onClose={…}
 *              onSubmit={async () => { await api.create(...); onSaved(); }}>
 *     <FormField label="Name"><Input … /></FormField>
 *   </FormModal>
 */

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Label } from "./Label";

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel?: string;
  submitDisabled?: boolean;
  onSubmit: () => Promise<void>;
  maxWidthClassName?: string;
  children: React.ReactNode;
}

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  submitLabel = "Save",
  submitDisabled,
  onSubmit,
  maxWidthClassName = "max-w-sm",
  children,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidthClassName={maxWidthClassName}>
      <div className="mb-5 pr-6">
        <h3 className="text-base font-black text-slate-900 tracking-tight dark:text-[#E7E5F7]">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5 dark:text-[#9A94B8]">{description}</p>}
      </div>

      <form onSubmit={handle} className="space-y-4">
        {children}

        {error && (
          <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1 dark:border-white/10 dark:bg-white/10 dark:text-[#DEDCF0] dark:hover:bg-white/15" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={busy || submitDisabled}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

/** A labelled field wrapper for consistent spacing inside a FormModal. */
export const FormField: React.FC<{ label: string; hint?: string; className?: string; children: React.ReactNode }> = ({
  label,
  hint,
  className,
  children,
}) => (
  <div className={cn("space-y-1.5", className)}>
    <Label>{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
  </div>
);

/** Two fields side by side. */
export const FormRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-2 gap-3">{children}</div>
);
