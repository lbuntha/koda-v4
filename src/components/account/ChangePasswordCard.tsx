import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { useT } from "../../lib/i18n";

import { ApiError, accessToken, request, useSession } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIButton, UISectionHeader } from "../ui";

/**
 * Changing your own password.
 *
 * Shown only to an account that has one: a child joined with a code and has no
 * password to change, so offering them this would be a door onto nothing.
 *
 * Knowing the current password is what authorises the change — the server
 * checks it — so a device left unlocked on a kitchen table is not enough to
 * lock its owner out of their own family.
 */
export const ChangePasswordCard: React.FC = () => {
  const session = useSession();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // No password behind a child's join code, and no user row behind a bare
  // device session.
  if (!session?.email) return null;

  const reset = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !current || !next) return;
    setBusy(true);
    setError(null);
    try {
      const token = await accessToken();
      const result = await request<{ signedOutSessions: number }>("/auth/me/password", {
        method: "PATCH",
        token,
        body: { currentPassword: current, newPassword: next },
      });
      reset();
      // Say what it cost. A parent who has just signed their own tablet out
      // should hear it from us rather than discover it later.
      setNotice(
        result.signedOutSessions > 0
          ? t("password.changedSignedOut", { count: result.signedOutSessions })
          : t("password.changed"),
      );
      playSound("pop");
    } catch (err) {
      const problem = err as ApiError;
      setError(
        problem.isOffline
          ? t("password.offline")
          : problem.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const field =
    themeSystem.field("lg", "w-full");

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-3`)}>
      <UISectionHeader
        title={t("account.password")}
        subtitle={t("password.subtitle")}
        icon={<KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {error && <p className={themeSystem.flash("error")}>{error}</p>}
      {notice && <p className={themeSystem.flash("success")}>{notice}</p>}

      {open ? (
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="koda-admin-label text-ink">{t("password.current")}</span>
            <input
              className={field}
              type="password"
              autoComplete="current-password"
              value={current}
              disabled={busy}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="koda-admin-label text-ink">{t("password.new")}</span>
            <input
              className={field}
              type="password"
              autoComplete="new-password"
              value={next}
              disabled={busy}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <UIButton
              variant="primary"
              size="sm"
              type="submit"
              isLoading={busy}
              disabled={!current || !next}
            >
              {t("password.change")}
            </UIButton>
            <UIButton variant="secondary" size="sm" type="button" onClick={reset}>
              {t("common.cancel")}
            </UIButton>
          </div>
        </form>
      ) : (
        <UIButton
          variant="secondary"
          size="sm"
          icon={<KeyRound />}
          onClick={() => {
            setNotice(null);
            setOpen(true);
          }}
        >
          {t("password.change")}
        </UIButton>
      )}
    </section>
  );
};
