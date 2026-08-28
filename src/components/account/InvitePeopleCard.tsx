import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, Mail, Trash2, UserPlus } from "lucide-react";

import { ApiError, accessToken, request, usePermissions } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIModal, UISectionHeader } from "../ui";

interface Invite {
  id: string;
  role: string;
  expiresAt: string;
  code?: string | null;
}

/**
 * Bringing a second adult into the family.
 *
 * A code rather than an emailed link, and the reasons are worth keeping next to
 * the feature: it needs no mail transport, it reuses the shape already trusted
 * for pairing a child's tablet, and it matches what actually happens — two
 * parents in the same room, one reading eight characters to the other.
 *
 * The code is shown **once**, at the moment it is made. It is stored hashed, so
 * there is nothing to show again; the list below can only ever say that an
 * invite is outstanding and when it lapses.
 */

const ROLES: { id: string; label: string; detail: string }[] = [
  { id: "parent", label: "Parent", detail: "Everything except handing the family on" },
  { id: "caregiver", label: "Caregiver", detail: "Sees the children and their records; changes nothing" },
];

const expiryWords = (iso: string): string => {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "expired";
  return days === 1 ? "expires tomorrow" : `expires in ${days} days`;
};

export const InvitePeopleCard: React.FC = () => {
  const { can } = usePermissions();
  const mayInvite = can("member:invite");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState("parent");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!mayInvite) return;
    try {
      const token = await accessToken();
      const response = await request<{ invites: Invite[] }>("/family/invites", { token });
      setInvites(response.invites);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }, [mayInvite]);

  useEffect(() => void load(), [load]);

  const create = async () => {
    setBusy("create");
    setError(null);
    try {
      const token = await accessToken();
      const invite = await request<Invite>("/family/invites", {
        method: "POST",
        token,
        body: { role },
      });
      setMade(invite);
      setCopied(false);
      void load();
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (invite: Invite) => {
    setBusy(invite.id);
    try {
      const token = await accessToken();
      await request(`/family/invites/${invite.id}`, { method: "DELETE", token });
      setInvites((current) => current.filter((item) => item.id !== invite.id));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  if (!mayInvite) return null;

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Invite someone"
        subtitle="A second parent, or a grandparent who should see how the children are getting on"
        icon={<Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {error && <p className={themeSystem.flash("error")}>{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <span className="koda-admin-label text-ink">Join as</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Invite as">
            {ROLES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={role === option.id}
                onClick={() => {
                  playSound("pop");
                  setRole(option.id);
                }}
                className={themeSystem.button(role === option.id ? "primary" : "secondary", "sm")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <UIButton
          variant="primary"
          size="sm"
          icon={<UserPlus />}
          isLoading={busy === "create"}
          onClick={() => void create()}
        >
          Make a code
        </UIButton>
      </div>

      <p className="text-xs text-muted">{ROLES.find((r) => r.id === role)?.detail}</p>

      {invites.length > 0 && (
        <ul className="space-y-2">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold text-ink">
                  Waiting to be used · {invite.role}
                </p>
                <p className="text-xs text-muted">{expiryWords(invite.expiresAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <UIBadge variant="warning">Outstanding</UIBadge>
                <UIButton
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  isLoading={busy === invite.id}
                  onClick={() => void revoke(invite)}
                >
                  Withdraw
                </UIButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <UIModal
        isOpen={Boolean(made)}
        onClose={() => setMade(null)}
        title="Share this code"
        footer={
          <UIButton variant="primary" onClick={() => setMade(null)}>
            Done
          </UIButton>
        }
      >
        {made && (
          <div className="space-y-5 text-center">
            <p className="text-sm text-muted">
              They create their own Koda account, then enter this on the Roles page to join as{" "}
              <strong className="text-ink">{made.role}</strong>.
            </p>
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-5 dark:border-indigo-800 dark:bg-indigo-950/40">
              <div className="font-mono text-3xl font-bold tracking-[0.3em] text-indigo-800 dark:text-indigo-200">
                {made.code}
              </div>
              <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">
                {expiryWords(made.expiresAt)} · single use
              </p>
            </div>
            <UIButton
              variant="secondary"
              icon={copied ? <Check /> : <Copy />}
              onClick={async () => {
                await navigator.clipboard?.writeText(made.code ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? "Copied" : "Copy code"}
            </UIButton>
            {/*
              * Said plainly because it is the one surprising thing here: the
              * code is stored hashed, so this dialog is the only time it can be
              * shown. Closing it without copying means making another.
              */}
            <p className="text-xs text-muted">
              This is the only time the code is shown. If you lose it, withdraw the invite and
              make another.
            </p>
          </div>
        )}
      </UIModal>
    </section>
  );
};
