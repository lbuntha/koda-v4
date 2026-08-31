import React, { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

import { ApiError, usePermissions } from "../../lib/sync";
import { FamilyPin, PIN_LENGTH, isWellFormed } from "../../lib/familyPin";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIDialog, UISectionHeader } from "../ui";

/**
 * Setting the four digits that stop a child tapping back into a parent account.
 *
 * Lives on the Children page rather than in Settings because that is where the
 * problem is: "Switch to child" is on the card above this, and the PIN is the
 * other half of that gesture. A parent who has just handed the tablet over is
 * the parent who wants this.
 *
 * The card is deliberately explicit about what the PIN does *not* do. A control
 * that oversells itself gets trusted past its limits, and the honest sentence
 * costs one line.
 */
export const FamilyPinCard: React.FC = () => {
  const { can } = usePermissions();
  const mayChange = can("family:update");
  const [isSet, setIsSet] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    FamilyPin.isSet()
      .then(setIsSet)
      .catch(() => setIsSet(null));
  }, []);

  const save = async () => {
    if (!isWellFormed(pin)) return;
    if (pin !== confirm) {
      setError("Those two do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await FamilyPin.set(pin);
      setIsSet(true);
      setEditing(false);
      setPin("");
      setConfirm("");
      setNotice("Family PIN saved.");
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await FamilyPin.clear();
      setIsSet(false);
      setNotice("Family PIN removed. Switching accounts no longer asks for one.");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
      setClearing(false);
    }
  };

  if (!mayChange) return null;

  const field =
    themeSystem.field("lg", "w-32 text-center font-mono !text-xl tracking-[0.4em]");

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Family PIN"
        subtitle="Asked when a child switches back to a grown-up's account"
        icon={<ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        action={
          isSet === null ? undefined : isSet ? (
            <UIBadge variant="success">On</UIBadge>
          ) : (
            <UIBadge variant="neutral">Not set</UIBadge>
          )
        }
      />

      {error && <p className={themeSystem.flash("error")}>{error}</p>}
      {notice && <p className={themeSystem.flash("success")}>{notice}</p>}

      {editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="koda-admin-label text-ink">New PIN</span>
              <input
                className={field}
                type="password"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="space-y-1">
              <span className="koda-admin-label text-ink">Again</span>
              <input
                className={field}
                type="password"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <UIButton
              variant="primary"
              size="sm"
              isLoading={busy}
              disabled={!isWellFormed(pin) || !isWellFormed(confirm)}
              onClick={() => void save()}
            >
              Save PIN
            </UIButton>
            <UIButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(false);
                setPin("");
                setConfirm("");
                setError(null);
              }}
            >
              Cancel
            </UIButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <UIButton variant={isSet ? "secondary" : "primary"} size="sm" icon={<Lock />} onClick={() => setEditing(true)}>
            {isSet ? "Change PIN" : "Set a PIN"}
          </UIButton>
          {isSet && (
            <UIButton variant="ghost" size="sm" onClick={() => setClearing(true)}>
              Remove
            </UIButton>
          )}
        </div>
      )}

      {/*
        * Said out loud, because a control described as more than it is gets
        * trusted as more than it is. This stops a child tapping through a menu.
        * It does not stop somebody who knows what they are doing with the
        * device — for that, the answer is not a PIN.
        */}
      <p className="text-xs text-muted">
        Four digits. It stops a curious child, not someone who knows their way around the tablet.
      </p>

      <UIDialog
        isOpen={clearing}
        onClose={() => setClearing(false)}
        title="Remove the family PIN?"
        description="Switching from a child's session back to a grown-up's account will stop asking for it."
        confirmText="Remove PIN"
        variant="danger"
        onConfirm={() => void remove()}
      />
    </section>
  );
};
