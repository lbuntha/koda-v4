import React, { useEffect, useState } from "react";
import { ChevronDown, RotateCcw, Users } from "lucide-react";

import { ApiError, accessToken, refreshPermissions, request, useSession } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UISectionHeader, UISpinner } from "../ui";
import { InvitePeopleCard } from "./InvitePeopleCard";
import { JoinFamilyCard } from "./JoinFamilyCard";
import { PlatformRolesPanel } from "./PlatformRolesPanel";

import { translate } from "../../lib/i18n";
/**
 * Who is in this family, and what each of them may do.
 *
 * Built around *people*, not a permission matrix: the question anyone actually
 * arrives with is "what can Grandma do?", and a 18×4 grid answers a question
 * nobody asked. The role is the answer for almost everyone; the checkboxes are
 * for the cases a role cannot express.
 *
 * The table itself is fetched, never hard-coded — a screen that keeps its own
 * copy of the rules will one day offer something the server refuses.
 */

interface Member {
  userId: string;
  email: string;
  role: string;
  isYou: boolean;
  permissions: string[];
  extra: string[];
  denied: string[];
}

interface Members {
  familyId: string;
  familyName: string;
  members: Member[];
}

interface Matrix {
  permissions: string[];
  roles: Record<string, string[]>;
  grantOnly: string[];
  assignableRoles: string[];
}

const ROLE_BLURB: Record<string, string> = {
  owner: "Everything, including deleting the family or handing it over",
  parent: "Everything except destroying or transferring the family",
  caregiver: "Reads the children and their records — changes nothing",
  child: "A kid's device: plays, and writes only their own record",
  student: "An older learner with their own sign-in: runs their own app, nobody else's",
  learner: "A kid's device: plays, and writes only their own record",
  admin: "Runs the service — accounts, devices and content, never a child's record",
  developer: "Builds skills, art and the menu. No family, no child's record",
  support: "First line — account shape only",
};

/**
 * Permissions in the words a parent would use.
 *
 * Anything not named here is still shown, under its own name — a new permission
 * appearing in the API must not vanish from this page just because nobody has
 * written a label for it yet.
 */
const LABELS: Record<string, { area: string; label: string }> = {
  "settings:read": { area: "Skills & lessons", get label() { return translate("admin.rolesPage.seeSkillSettings"); } },
  "settings:write": { area: "Skills & lessons", get label() { return translate("admin.rolesPage.changeSkillsArtAndTheMenu"); } },
  // Split out of `settings:write`, and worded as the consequence rather than
  // the act: "change scoring" sounds like a preference, which is exactly the
  // misreading that put it in Settings in the first place.
  "scoring:write": { area: "Rewards", get label() { return translate("admin.rolesPage.rePriceXpAndStarsAnd"); } },
  // Listed so the page does not go quiet about a right it can see in the
  // matrix, and worded so nobody expects a checkbox to grant it: it is a
  // platform right, and `effective_permissions` strips it from every grant.
  "system:write": { area: "Operator", get label() { return translate("admin.rolesPage.runTheDeploymentSSwitchboardStaff"); } },
  "user:manage": { area: "Operator", get label() { return translate("admin.rolesPage.manageUserAccountsAndCredentials"); } },
  "role:manage": { area: "Operator", get label() { return translate("admin.rolesPage.createAndManagePlatformRoles"); } },
  // Koda Trace: make trace items and publish collections everyone can practise.
  // A platform grant — give it to a custom platform role, not a family role.
  "trace:create": { area: "Operator", get label() { return translate("admin.rolesPage.makeAndPublishTraceCollections"); } },
  "menu:manage": { area: "Operator", get label() { return translate("admin.rolesPage.manageThePlatformSidebarMenu"); } },
  "learner:create": { area: "Children", get label() { return translate("admin.rolesPage.addAChild"); } },
  "learner:read": { area: "Children", get label() { return translate("admin.rolesPage.seeTheChildren"); } },
  "learner:update": { area: "Children", get label() { return translate("admin.rolesPage.renameOrEditAChild"); } },
  "learner:delete": { area: "Children", get label() { return translate("admin.rolesPage.deleteAChild"); } },
  "learner_data:read": { area: "Children", get label() { return translate("admin.rolesPage.seeWhatAChildHasPractised"); } },
  "learner_data:append": { area: "Children", get label() { return translate("admin.rolesPage.recordARoundPlayedHere"); } },
  "learner_data:write": { area: "Children", get label() { return translate("admin.rolesPage.rewriteAChildSRecord"); } },
  "family:read": { area: "Family", get label() { return translate("admin.rolesPage.seeTheFamily"); } },
  "family:update": { area: "Family", get label() { return translate("admin.rolesPage.renameTheFamilyAndSetThe"); } },
  "member:list": { area: "People", get label() { return translate("admin.rolesPage.seeWhoIsInTheFamily"); } },
  "member:invite": { area: "People", get label() { return translate("admin.rolesPage.inviteASecondAdult"); } },
  "member:role": { area: "People", get label() { return translate("admin.rolesPage.changeRolesAndRights"); } },
  "member:remove": { area: "People", get label() { return translate("admin.rolesPage.removeSomeone"); } },
  "device:list": { area: "Devices", get label() { return translate("admin.rolesPage.seeSignedInDevices"); } },
  "device:revoke": { area: "Devices", get label() { return translate("admin.rolesPage.signADeviceOut"); } },
};

/* `area` is also the grouping key, so only the heading is worded. */
const AREA_KEY: Record<string, string> = {
  "Skills & lessons": "skills",
  Rewards: "rewards",
  Children: "children",
  Family: "family",
  People: "people",
  Devices: "devices",
  Operator: "operator",
  Other: "other",
};

const AREA_ORDER = [
  "Skills & lessons",
  "Rewards",
  "Children",
  "People",
  "Devices",
  "Family",
  "Operator",
];

const describe = (permission: string) =>
  LABELS[permission] ?? { area: "Other", label: permission };

export const RolesPage: React.FC = () => {
  const session = useSession();
  const [members, setMembers] = useState<Members | null>(null);
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await accessToken();
        const [m, x] = await Promise.all([
          request<Members>("/family/members", { token }).catch(() => null),
          request<Matrix>("/family/permissions", { token }),
        ]);
        if (cancelled) return;
        setMembers(m);
        setMatrix(x);
      } catch (err) {
        if (cancelled) return;
        const problem = err as ApiError;
        setError(
          problem.isOffline
            ? translate("admin.rolesPage.offlineThisPageReadsTheRules")
            : problem.message,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canManage = Boolean(matrix && session?.permissions?.includes("member:role"));
  /*
   * Whether this account already has children of its own.
   *
   * An account can only be in one family, so somebody already looking after a
   * child cannot be absorbed into another — the server refuses it, and the
   * "Join a family" card is not offered rather than offered and then refused.
   */
  const [hasChildren, setHasChildren] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await accessToken();
        const rows = await request<{ learners: unknown[] }>("/learners", { token });
        if (!cancelled) setHasChildren(rows.learners.length > 0);
      } catch {
        // Unknown means "assume they have some" — hiding an offer is safer than
        // making one the server will turn down.
        if (!cancelled) setHasChildren(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchMember = (userId: string, patch: Partial<Member>) =>
    setMembers((prev) =>
      prev
        ? {
            ...prev,
            members: prev.members.map((m) => (m.userId === userId ? { ...m, ...patch } : m)),
          }
        : prev,
    );

  const changeRole = async (member: Member, role: string) => {
    setBusy(true);
    setError(null);
    try {
      const token = await accessToken();
      const updated = await request<Member>(`/family/members/${member.userId}`, {
        method: "PATCH",
        token,
        body: { role },
      });
      patchMember(member.userId, updated);
      if (member.isYou) void refreshPermissions();
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRight = async (member: Member, permission: string, allow: boolean) => {
    const fromRole = matrix?.roles[member.role]?.includes(permission) ?? false;

    // Only the *difference* from the role is stored, so a role change later
    // still moves everything it should.
    const extra = new Set(member.extra);
    const denied = new Set(member.denied);
    extra.delete(permission);
    denied.delete(permission);
    if (allow && !fromRole) extra.add(permission);
    if (!allow && fromRole) denied.add(permission);

    setBusy(true);
    setError(null);
    try {
      const token = await accessToken();
      const updated = await request<Member>(`/family/members/${member.userId}/rights`, {
        method: "PUT",
        token,
        body: { extra: [...extra], denied: [...denied] },
      });
      patchMember(member.userId, updated);
      if (member.isYou) void refreshPermissions();
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const resetRights = async (member: Member) => {
    setBusy(true);
    try {
      const token = await accessToken();
      const updated = await request<Member>(`/family/members/${member.userId}/rights`, {
        method: "PUT",
        token,
        body: { extra: [], denied: [] },
      });
      patchMember(member.userId, updated);
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  if (!matrix) {
    return error ? (
      <div className={"max-w-3xl mx-auto"}>
        <p className={themeSystem.flash("warning")}>{error}</p>
      </div>
    ) : (
      <div className="flex justify-center py-20">
        <UISpinner />
      </div>
    );
  }

  const areas = [...new Set(matrix.permissions.map((p) => describe(p).area))].sort(
    (a, b) => AREA_ORDER.indexOf(a) - AREA_ORDER.indexOf(b),
  );

  return (
    <div className={"max-w-6xl mx-auto space-y-6"}>
      <div>
        <h2 className={themeSystem.typography("h2")}>{translate("admin.rolesPage.rolesAmpAccess")}</h2>
        <p className={themeSystem.typography("body-sm", "mt-1")}>
          {translate("admin.rolesPage.aRoleCoversAlmostEveryoneAdjust")}
        </p>
      </div>

      {error && <p className={themeSystem.flash("warning")}>{error}</p>}

      {/* Who is in the family, before what each of them may do. Inviting and
          joining are two ends of the same act, and only one of them is ever
          offered to the same person. */}
      <InvitePeopleCard />
      <JoinFamilyCard
        hasChildren={hasChildren}
        onJoined={() => window.location.reload()}
      />

      <PlatformRolesPanel />

      {members && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-3`)}>
          <UISectionHeader
            title={translate("admin.rolesPage.people")}
            subtitle={translate("admin.rolesPage.lengthInFamilyname", { length: members.members.length, familyName: members.familyName })}
            icon={<Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          />

          <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
            {members.members.map((member) => {
            const open = openUser === member.userId;
            const adjusted = member.extra.length + member.denied.length;

            return (
              <div key={member.userId} className="py-3 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {member.email}
                      </span>
                      {member.isYou && <UIBadge variant="neutral">{translate("admin.rolesPage.you")}</UIBadge>}
                      {adjusted > 0 && (
                        <UIBadge variant="warning">{translate("admin.rolesPage.adjustedAdjusted", { adjusted: adjusted })}</UIBadge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {ROLE_BLURB[member.role] ?? member.role}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage && member.role !== "owner" ? (
                      <select
                        value={member.role}
                        disabled={busy}
                        onChange={(e) => void changeRole(member, e.target.value)}
                        aria-label={translate("admin.rolesPage.roleForEmail", { email: member.email })}
                        className={themeSystem.field("lg", "font-mono")}
                      >
                        {matrix.assignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <UIBadge variant={member.role === "owner" ? "primary" : "neutral"}>
                        {member.role}
                      </UIBadge>
                    )}

                    {canManage && member.role !== "owner" && (
                      <button
                        onClick={() => {
                          playSound("pop");
                          setOpenUser(open ? null : member.userId);
                        }}
                        aria-expanded={open}
                        className={themeSystem.button("secondary", "sm")}
                      >
                        {translate("admin.rolesPage.rights")}
                        <ChevronDown className={open ? "rotate-180 transition" : "transition"} />
                      </button>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                        {translate("admin.rolesPage.tickedIsWhatThisPersonCan")}{" "}
                        <strong>{member.role}</strong>{" "}{translate("admin.rolesPage.roleIsStoredAsAnException")}
                      </p>
                      {adjusted > 0 && (
                        <button
                          onClick={() => void resetRights(member)}
                          disabled={busy}
                          className={themeSystem.button("ghost", "sm")}
                        >
                          <RotateCcw />
                          {translate("admin.rolesPage.backToTheRole")}
                        </button>
                      )}
                    </div>

                    {areas.map((area) => (
                      <div key={area} className="space-y-1.5">
                        <div className="text-[11px] font-mono font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {translate(`admin.rolesPage.area.${AREA_KEY[area] ?? "other"}`)}
                        </div>
                        {matrix.permissions
                          .filter((permission) => describe(permission).area === area)
                          .map((permission) => {
                            const held = member.permissions.includes(permission);
                            const fromRole =
                              matrix.roles[member.role]?.includes(permission) ?? false;
                            const grantable = permission !== "learner_data:write";

                            return (
                              <label
                                key={permission}
                                className={`flex items-center gap-3 py-1.5 text-sm ${
                                  grantable ? "cursor-pointer" : "opacity-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={held}
                                  disabled={busy || !grantable}
                                  onChange={(e) =>
                                    void toggleRight(member, permission, e.target.checked)
                                  }
                                  className="w-4 h-4 accent-indigo-600"
                                />
                                <span className="text-slate-700 dark:text-slate-200">
                                  {describe(permission).label}
                                </span>
                                {held !== fromRole && (
                                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                    {held ? translate("admin.rolesPage.added") : translate("admin.rolesPage.removed")}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
            })}
          </div>

          {members.members.length === 1 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {translate("admin.rolesPage.invitingASecondParentOrA")}
            </p>
          )}
        </section>
      )}

    </div>
  );
};
