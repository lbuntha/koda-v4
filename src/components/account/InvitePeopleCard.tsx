import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, Mail, Trash2, UserPlus } from "lucide-react";

import { ApiError, accessToken, request, usePermissions } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIModal, UISectionHeader } from "../ui";

import { translate } from "../../lib/i18n";
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
  { id: "parent", get label() { return translate("admin.invitePeopleCard.parent"); }, get detail() { return translate("admin.invitePeopleCard.everythingExceptHandingTheFamilyOn"); } },
  { id: "caregiver", get label() { return translate("admin.invitePeopleCard.caregiver"); }, get detail() { return translate("admin.invitePeopleCard.seesTheChildrenAndTheirRecords"); } },
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
        title={translate("admin.invitePeopleCard.inviteSomeone")}
        subtitle={translate("admin.invitePeopleCard.aSecondParentOrAGrandparent")}
        icon={<Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

      {error && <p className={themeSystem.flash("error")}>{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <span className="koda-admin-label text-ink">{translate("admin.invitePeopleCard.joinAs")}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={translate("admin.invitePeopleCard.inviteAs")}>
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
          {translate("admin.invitePeopleCard.makeACode")}
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
                  {translate("admin.invitePeopleCard.waitingToBeUsedRole", { role: invite.role })}
                </p>
                <p className="text-xs text-muted">{expiryWords(invite.expiresAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <UIBadge variant="warning">{translate("admin.invitePeopleCard.outstanding")}</UIBadge>
                <UIButton
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  isLoading={busy === invite.id}
                  onClick={() => void revoke(invite)}
                >
                  {translate("admin.invitePeopleCard.withdraw")}
                </UIButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <UIModal
        isOpen={Boolean(made)}
        onClose={() => setMade(null)}
        title={translate("admin.invitePeopleCard.shareThisCode")}
        footer={
          <UIButton variant="primary" onClick={() => setMade(null)}>
            {translate("admin.invitePeopleCard.done")}
          </UIButton>
        }
      >
        {made && (
          <div className="space-y-5 text-center">
            <p className="text-sm text-muted">
              {translate("admin.invitePeopleCard.theyCreateTheirOwnKodaAccount")}{" "}
              <strong className="text-ink">{made.role}</strong>.
            </p>
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-5 dark:border-indigo-800 dark:bg-indigo-950/40">
              <div className="font-mono text-3xl font-bold tracking-[0.3em] text-indigo-800 dark:text-indigo-200">
                {made.code}
              </div>
              <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">
                {translate("admin.invitePeopleCard.valueSingleUse", { value: expiryWords(made.expiresAt) })}
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
              {copied ? translate("admin.invitePeopleCard.copied") : translate("admin.invitePeopleCard.copyCode")}
            </UIButton>
            {/*
              * Said plainly because it is the one surprising thing here: the
              * code is stored hashed, so this dialog is the only time it can be
              * shown. Closing it without copying means making another.
              */}
            <p className="text-xs text-muted">
              {translate("admin.invitePeopleCard.thisIsTheOnlyTimeThe")}
            </p>
          </div>
        )}
      </UIModal>
    </section>
  );
};
