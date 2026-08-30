import React, { useEffect, useState } from "react";
import { ChevronDown, RotateCcw, Users } from "lucide-react";

import { ApiError, accessToken, refreshPermissions, request, useSession } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UISectionHeader, UISpinner } from "../ui";
import { InvitePeopleCard } from "./InvitePeopleCard";
import { JoinFamilyCard } from "./JoinFamilyCard";
import { PlatformRolesPanel } from "./PlatformRolesPanel";

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
  "settings:read": { area: "Skills & lessons", label: "See skill settings" },
  "settings:write": { area: "Skills & lessons", label: "Change skills, art and the menu" },
  // Split out of `settings:write`, and worded as the consequence rather than
  // the act: "change scoring" sounds like a preference, which is exactly the
  // misreading that put it in Settings in the first place.
  "scoring:write": { area: "Rewards", label: "Re-price XP and stars, and set the badges, for everyone" },
  // Listed so the page does not go quiet about a right it can see in the
  // matrix, and worded so nobody expects a checkbox to grant it: it is a
  // platform right, and `effective_permissions` strips it from every grant.
  "system:write": { area: "Operator", label: "Run the deployment's switchboard (staff only)" },
  "user:manage": { area: "Operator", label: "Manage user accounts and credentials" },
  "role:manage": { area: "Operator", label: "Create and manage platform roles" },
  "menu:manage": { area: "Operator", label: "Manage the platform sidebar menu" },
  "learner:create": { area: "Children", label: "Add a child" },
  "learner:read": { area: "Children", label: "See the children" },
  "learner:update": { area: "Children", label: "Rename or edit a child" },
  "learner:delete": { area: "Children", label: "Delete a child" },
  "learner_data:read": { area: "Children", label: "See what a child has practised" },
  "learner_data:append": { area: "Children", label: "Record a round played here" },
  "learner_data:write": { area: "Children", label: "Rewrite a child's record" },
  "family:read": { area: "Family", label: "See the family" },
  "family:update": { area: "Family", label: "Rename the family, and set the PIN" },
  "member:list": { area: "People", label: "See who is in the family" },
  "member:invite": { area: "People", label: "Invite a second adult" },
  "member:role": { area: "People", label: "Change roles and rights" },
  "member:remove": { area: "People", label: "Remove someone" },
  "device:list": { area: "Devices", label: "See signed-in devices" },
  "device:revoke": { area: "Devices", label: "Sign a device out" },
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
            ? "Offline — this page reads the rules from the server, so it needs a connection."
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
        <h2 className={themeSystem.typography("h2")}>Roles &amp; access</h2>
        <p className={themeSystem.typography("body-sm", "mt-1")}>
          A role covers almost everyone. Adjust a single person only when their role does not fit.
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
            title="People"
            subtitle={`${members.members.length} in ${members.familyName}`}
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
                      {member.isYou && <UIBadge variant="neutral">you</UIBadge>}
                      {adjusted > 0 && (
                        <UIBadge variant="warning">{adjusted} adjusted</UIBadge>
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
                        aria-label={`Role for ${member.email}`}
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
                        Rights
                        <ChevronDown className={open ? "rotate-180 transition" : "transition"} />
                      </button>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                        Ticked is what this person can do. A tick that differs from the{" "}
                        <strong>{member.role}</strong> role is stored as an exception, so changing
                        their role later still moves everything else.
                      </p>
                      {adjusted > 0 && (
                        <button
                          onClick={() => void resetRights(member)}
                          disabled={busy}
                          className={themeSystem.button("ghost", "sm")}
                        >
                          <RotateCcw />
                          Back to the role
                        </button>
                      )}
                    </div>

                    {areas.map((area) => (
                      <div key={area} className="space-y-1.5">
                        <div className="text-[11px] font-mono font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {area}
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
                                    {held ? "added" : "removed"}
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
              Inviting a second parent or a caregiver is not built yet. When it is, they appear here
              and their role and rights are set from this row.
            </p>
          )}
        </section>
      )}

    </div>
  );
};
