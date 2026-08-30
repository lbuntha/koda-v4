import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { ApiError } from "../../lib/sync";
import { PIN_LENGTH, isWellFormed } from "../../lib/familyPin";
import { UIButton, UIModal } from "../ui";
import { themeSystem } from "../../lib/themeSystem";

export interface PinPromptProps {
  isOpen: boolean;
  /** Whose account is being opened, so the ask names a person. */
  accountName?: string;
  onClose(): void;
  onSubmit(pin: string): Promise<void>;
}

/**
 * "Ask a grown-up." — the four digits between a child and their parent's account.
 *
 * Read by a child, so the sentence is short and the tone is a door rather than
 * an accusation. There is no "forgot it" link: the person who set the PIN is
 * standing in the same house, and a self-serve bypass reachable from a child's
 * session would be the whole control undone.
 */
export const PinPrompt: React.FC<PinPromptProps> = ({
  isOpen,
  accountName,
  onClose,
  onSubmit,
}) => {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh prompt every time, so a wrong PIN is never left sitting in the box
  // for the next person to submit again.
  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(null);
    }
  }, [isOpen]);

  const submit = async () => {
    if (!isWellFormed(pin) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin);
    } catch (err) {
      const problem = err as ApiError;
      setError(
        problem.isOffline
          ? "No connection, so this cannot be checked right now."
          : problem.message,
      );
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <UIModal
      isOpen={isOpen}
      onClose={onClose}
      // A non-breaking hyphen: "grown-up" is one word, and a plain hyphen lets
      // a narrow dialog split it across two lines as "Ask a grown-" / "up".
      title={"Ask a grown\u2011up"}
      footer={
        <>
          <UIButton variant="secondary" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton
            variant="primary"
            isLoading={busy}
            disabled={!isWellFormed(pin)}
            onClick={() => void submit()}
          >
            Unlock
          </UIButton>
        </>
      }
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/60">
          <Lock className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
        </div>

        <p className="text-sm text-muted">
          {accountName ? (
            <>
              Opening <strong className="text-ink">{accountName}</strong> needs the family PIN.
            </>
          ) : (
            <>This account needs the family PIN.</>
          )}
        </p>

        <label className="block">
          <span className="sr-only">Family PIN</span>
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog exists to be typed in
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH}
            value={pin}
            disabled={busy}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            className={themeSystem.field("lg", "mx-auto w-40 text-center font-mono !text-2xl tracking-[0.5em]")}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </p>
        )}
      </div>
    </UIModal>
  );
};
