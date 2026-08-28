import React, { useState } from "react";
import { LogIn } from "lucide-react";

import { ApiError, SessionAPI, accessToken, request, useSession } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIButton, UISectionHeader } from "../ui";

/**
 * The other side of an invite: entering the code you were given.
 *
 * Shown to an adult whose own family is still empty, because that is exactly
 * who an invite is for — somebody who signed up, got a family minted for them
 * by the act of signing up, and is now joining somebody else's. An owner with
 * children of their own is not offered it; the server would refuse them anyway,
 * and an offer that ends in a refusal is worse than no offer.
 */
export const JoinFamilyCard: React.FC<{ hasChildren: boolean; onJoined?: () => void }> = ({
  hasChildren,
  onJoined,
}) => {
  const session = useSession();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  // A child has no account to move, and somebody already looking after children
  // cannot be absorbed into another family.
  if (!session?.email || session.learnerId || hasChildren) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || code.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const token = await accessToken();
      const result = await request<{ familyName: string; role: string }>(
        "/family/invites/redeem",
        { method: "POST", token, body: { code } },
      );
      // The membership moved; the token still describes the old family. A
      // refresh reads the device row, which moved with it.
      await SessionAPI.refresh();
      setJoined(result.familyName || "the family");
      setCode("");
      playSound("pop");
      onJoined?.();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-3`)}>
      <UISectionHeader
        title="Join a family"
        subtitle="If somebody gave you a code to join theirs"
        icon={<LogIn className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {joined ? (
        <p className={themeSystem.flash("success")}>
          You are in <strong>{joined}</strong> now. Their children and settings are yours to see.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5">
            <span className="koda-admin-label text-ink">Invite code</span>
            <input
              value={code}
              disabled={busy}
              maxLength={8}
              autoCapitalize="characters"
              placeholder="ABCD2345"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
              className="w-44 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-center font-mono tracking-[0.25em] text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <UIButton
            variant="primary"
            size="sm"
            type="submit"
            isLoading={busy}
            disabled={code.length < 8}
          >
            Join
          </UIButton>
        </form>
      )}

      {error && <p className={themeSystem.flash("error")}>{error}</p>}
    </section>
  );
};
