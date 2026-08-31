import React, { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

import { ApiError } from "../../lib/sync";
import { PIN_LENGTH, isWellFormed } from "../../lib/familyPin";
import { UIButton, UIModal } from "../ui";

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
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      inputRef.current?.focus();
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
      // One sentence and four digits. At the default width the dialog is mostly
      // empty space with the slots marooned in the middle of it.
      maxWidth="max-w-md"
      // One white sheet: no muted band under the buttons, no grey rule under
      // the title. Four digits and a sentence do not need a form's furniture,
      // and the only colour left is the indigo the lock and the field share.
      tone="plain"
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
        {/* Solid, not tinted. A lock drawn in pale indigo on white is a
            decoration; filled, with the ring around it, it is the one heavy
            object in the dialog and the eye lands on it first. */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-indigo-600 shadow-lg shadow-indigo-600/25 ring-8 ring-indigo-500/10 dark:bg-indigo-500 dark:shadow-indigo-950">
          <Lock className="h-7 w-7 text-white" strokeWidth={2.5} />
        </div>

        <p className="text-[15px] text-body">
          {accountName ? (
            <>
              Opening <strong className="text-ink">{accountName}</strong> needs the family PIN.
            </>
          ) : (
            <>This account needs the family PIN.</>
          )}
        </p>

        {/* Four slots, not a text box.
            A password field the width of the dialog says "type a secret of
            some length"; four boxes say "four digits, and you have entered
            two" without a word of instruction. The real <input> is still
            here — full width over the slots, invisible — so autofocus, paste,
            the numeric keypad, screen readers and the Enter key all keep
            working, and the boxes are only what the value looks like. */}
        {/* Fluid, not four fixed boxes in a row: the slots share the width
            they are given, so the same markup is a 240px row on a desktop
            dialog and four narrower slots on a 320px phone, with nothing to
            overflow the sheet. `max-w` keeps them from stretching into
            letterboxes on a wide window. */}
        <label
          className="relative mx-auto block w-full max-w-[15rem]"
          onClick={() => inputRef.current?.focus()}
        >
          <span className="sr-only">Family PIN</span>
          <div className="grid grid-cols-4 gap-2 rail:gap-2.5" aria-hidden="true">
            {Array.from({ length: PIN_LENGTH }, (_, index) => {
              const filled = index < pin.length;
              const next = focused && index === pin.length && !busy;
              return (
                <div
                  key={index}
                  className={[
                    "flex h-14 items-center justify-center rounded-2xl border-2 transition",
                    busy ? "opacity-60" : "",
                    error
                      ? "border-rose-300 bg-rose-50/60 dark:border-rose-900/70 dark:bg-rose-950/30"
                      : filled
                        ? "border-indigo-500 bg-white dark:border-indigo-400 dark:bg-slate-900"
                        : next
                          ? "border-indigo-500 bg-white ring-4 ring-indigo-500/15 dark:border-indigo-400 dark:bg-slate-900"
                          : "border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/70 dark:bg-indigo-950/30",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {filled && (
                    <span className="h-3 w-3 rounded-full bg-indigo-600 dark:bg-indigo-300" />
                  )}
                </div>
              );
            })}
          </div>
          <input
            ref={inputRef}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog exists to be typed in
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH}
            value={pin}
            disabled={busy}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH));
              setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </UIModal>
  );
};
