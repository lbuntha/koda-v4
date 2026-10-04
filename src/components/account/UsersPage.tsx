import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  CreditCard,
  KeyRound,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { ApiError, accessToken, request, usePermissions } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import {
  UIBadge,
  UIAvatar,
  UIButton,
  UIDataTable,
  type UIDataTableColumn,
  UIDialog,
  UIModal,
  UITabs,
  UISearchInput,
} from "../ui";
import { NoAccess } from "./NoAccess";

import { translate } from "../../lib/i18n";
type AccountStatus = "active" | "suspended";
type OnboardingStatus = "pending" | "completed" | "blocked";
type UserView = "directory" | "onboarding";
type PlatformRole = string;

interface PlatformRoleOption {
  id: string;
  name: string;
  builtIn: boolean;
}

interface Membership {
  familyId: string;
  familyName: string;
  role: string;
  planId: string;
  planName: string;
  /** Whether a paid plan is being honoured. An expired grant is not. */
  live: boolean;
}

interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  avatarSeed: string;
  platformRole: PlatformRole;
  status: AccountStatus;
  memberships: Membership[];
  activeSessionCount: number;
  /** Browsers this person has turned notifications on in. */
  notifiedBrowserCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
  isYou: boolean;
  onboardingStatus: OnboardingStatus;
}

interface UserStats {
  total: number;
  active: number;
  suspended: number;
  staff: number;
  pendingOnboarding: number;
  completedOnboarding: number;
  blockedOnboarding: number;
}

interface UsersResponse {
  users: UserRecord[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  stats: UserStats;
}

interface UserForm {
  email: string;
  displayName: string;
  password: string;
  platformRole: PlatformRole;
}

const EMPTY_FORM: UserForm = {
  email: "",
  displayName: "",
  password: "",
  platformRole: "support",
};

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-60";

const formatDate = (value: string | null): string => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const daysSince = (value: string | null): number => {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
};

const onboardingLabel = (status: OnboardingStatus): string => {
  if (status === "completed") return "Onboarded";
  if (status === "blocked") return "Blocked";
  return "Awaiting sign-in";
};

const onboardingBadge = (status: OnboardingStatus) => {
  if (status === "completed") return "success" as const;
  if (status === "blocked") return "danger" as const;
  return "warning" as const;
};

const roleLabel = (user: UserRecord): string => {
  if (user.platformRole !== "none") return user.platformRole;
  const roles = [...new Set(user.memberships.map((item) => item.role))];
  return roles.join(", ") || "Unassigned";
};

const roleBadge = (role: string) => {
  if (role === "admin") return "primary" as const;
  if (role === "developer") return "info" as const;
  if (role === "support") return "warning" as const;
  return "neutral" as const;
};

const UserAvatar: React.FC<{ user: UserRecord }> = ({ user }) => {
  const name = user.displayName || user.email.split("@")[0];
  return <UIAvatar name={name} seed={user.avatarSeed} size="sm" />;
};

const LoadingTable: React.FC = () => (
  <div className={themeSystem.table.wrapper} aria-label={translate("admin.usersPage.loadingUsers")} aria-busy="true">
    <table className={themeSystem.table.table}>
      <thead><tr>{["User", "Access", "Status", "Family", "Sessions", "Last login", "Actions"].map((label) => <th key={label} className={themeSystem.table.header}>{label}</th>)}</tr></thead>
      <tbody>
        {[0, 1, 2, 3, 4].map((row) => (
          <tr key={row} className={themeSystem.table.row}>
            {["w-44", "w-20", "w-20", "w-28", "w-12", "w-32", "w-40"].map((width, cell) => (
              <td key={cell} className={themeSystem.table.cell}><div className={`h-4 ${width} max-w-full animate-pulse rounded bg-surface-muted`} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const UsersPage: React.FC = () => {
  const { can } = usePermissions();
  const allowed = can("user:manage");
  const [result, setResult] = useState<UsersResponse | null>(null);
  const [platformRoles, setPlatformRoles] = useState<PlatformRoleOption[]>([
    { id: "admin", name: "Admin", builtIn: true },
    { id: "developer", name: "Developer", builtIn: true },
    { id: "support", name: "Support", builtIn: true },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<UserView>("directory");
  const [onboarding, setOnboarding] = useState<"" | OnboardingStatus>("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRecord | null>(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState<UserRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /*
   * Granting a plan from here.
   *
   * Billing can already do it, but it lists families by name — and an operator
   * holding somebody's email has no way to know which "Smith Family" is theirs.
   * This is the same route (`PUT /billing/subscriptions/{familyId}`) reached
   * from the row where the person is, which is where the question is asked.
   */
  const [planFor, setPlanFor] = useState<{ user: UserRecord; family: Membership } | null>(null);
  const [planChoice, setPlanChoice] = useState<string>("family");
  const [planMonths, setPlanMonths] = useState<number>(1);
  const [plans, setPlans] = useState<{ planId: string; name: string; priceCents: number }[]>([]);

  // The plan catalogue, for the grant dialog. Read once: plans change when an
  // operator edits one, not while a page is open.
  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      try {
        const token = await accessToken();
        const body = await request<{ plans: typeof plans }>("/billing/plans", { token });
        setPlans(body.plans);
      } catch {
        // A missing catalogue costs this page its dialog and nothing else; the
        // rest of user management does not depend on billing being reachable.
      }
    })();
  }, [allowed]);

  const grantPlan = async () => {
    if (!planFor) return;
    const familyId = planFor.family.familyId;
    setBusy(`plan:${familyId}`);
    setError(null);
    try {
      const token = await accessToken();
      await request(`/billing/subscriptions/${familyId}`, {
        method: "PUT",
        token,
        body: {
          planId: planChoice,
          status: "active",
          // Zero is open-ended — what the deployment's own test account wants,
          // and what a school gets. Anything else lapses on its own.
          months: planMonths || 0,
          note: translate("admin.usersPage.grantedFromUserManagementForEmail", { email: planFor.user.email }),
        },
      });
      setPlanFor(null);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const token = await accessToken();
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (query.trim()) params.set("q", query.trim());
      if (role) params.set("role", role);
      if (view === "directory" && status) params.set("status", status);
      if (view === "onboarding" && onboarding) params.set("onboarding", onboarding);
      setResult(await request<UsersResponse>(`/admin/users?${params}`, { token, signal }));
    } catch (err) {
      if (!signal?.aborted) setError((err as ApiError).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [allowed, onboarding, page, query, role, status, view]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 300 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  useEffect(() => setPage(1), [onboarding, query, role, status, view]);

  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      try {
        const token = await accessToken();
        const response = await request<{ roles: PlatformRoleOption[] }>("/admin/roles", { token });
        setPlatformRoles(response.roles);
      } catch {
        // Built-ins remain available if the role catalog cannot be refreshed.
      }
    })();
  }, [allowed]);

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const createUser = async () => {
    await run("create", async () => {
      const token = await accessToken();
      await request("/admin/users", { method: "POST", token, body: form });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
    }, "Account added to onboarding. Share the temporary credentials securely.");
  };

  const saveUser = async () => {
    if (!editing) return;
    await run(editing.id, async () => {
      const token = await accessToken();
      await request(`/admin/users/${editing.id}`, {
        method: "PATCH",
        token,
        body: {
          email: editing.email,
          displayName: editing.displayName ?? "",
          platformRole: editing.platformRole,
          status: editing.status,
        },
      });
      const original = result?.users.find((user) => user.id === editing.id);
      const changedMemberships = editing.memberships.filter((membership) =>
        original?.memberships.some(
          (saved) => saved.familyId === membership.familyId && saved.role !== membership.role,
        ),
      );
      for (const membership of changedMemberships) {
        await request(
          `/admin/users/${editing.id}/memberships/${membership.familyId}`,
          { method: "PATCH", token, body: { role: membership.role } },
        );
      }
      setEditing(null);
    }, "User account updated.");
  };

  const resetPassword = async () => {
    if (!passwordUser) return;
    await run(`password:${passwordUser.id}`, async () => {
      const token = await accessToken();
      await request(`/admin/users/${passwordUser.id}/password`, {
        method: "POST",
        token,
        body: { password },
      });
      setPasswordUser(null);
      setPassword("");
    }, "Password changed and existing sessions ended.");
  };

  const setAccountStatus = async (user: UserRecord, next: AccountStatus) => {
    await run(`status:${user.id}`, async () => {
      const token = await accessToken();
      await request(`/admin/users/${user.id}`, {
        method: "PATCH",
        token,
        body: { status: next },
      });
    }, next === "active" ? "Account activated." : "Account suspended and sessions ended.");
  };

  const deleteUser = async (user: UserRecord) => {
    await run(`delete:${user.id}`, async () => {
      const token = await accessToken();
      await request(`/admin/users/${user.id}`, { method: "DELETE", token });
      setDeleting(null);
    }, "User account deleted.");
  };

  const columns = useMemo<UIDataTableColumn<UserRecord>[]>(() => [
    {
      key: "user",
      header: "User",
      sortValue: (user) => user.displayName || user.email,
      render: (user) => <div className="flex min-w-[12rem] items-center gap-3"><UserAvatar user={user} /><div className="min-w-0"><div className="koda-admin-card-title flex items-center gap-2">{user.displayName || user.email.split("@")[0]}{user.isYou && <UIBadge variant="info">{translate("admin.usersPage.you")}</UIBadge>}</div><div className="koda-admin-label break-all">{user.email}</div></div></div>,
    },
    {
      key: "access",
      header: "Access",
      sortValue: roleLabel,
      render: (user) => <UIBadge variant={roleBadge(roleLabel(user))} className="capitalize">{user.platformRole === "none" ? roleLabel(user) : (platformRoles.find((item) => item.id === user.platformRole)?.name ?? user.platformRole)}</UIBadge>,
      nowrap: true,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (user) => user.status,
      render: (user) => <UIBadge variant={user.status === "active" ? "success" : "danger"} className="gap-1 capitalize">{user.status === "active" ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}{user.status}</UIBadge>,
      nowrap: true,
    },
    {
      key: "family",
      header: "Family",
      sortValue: (user) => user.memberships[0]?.familyName ?? "",
      render: (user) => user.memberships.length ? <div className="min-w-[8rem]">{user.memberships.slice(0, 2).map((item) => <div key={item.familyId}><span className="text-sm text-ink">{item.familyName || item.familyId}</span><span className="koda-admin-chip ml-1 text-muted">· {item.role}</span></div>)}</div> : <span className="text-muted">{translate("admin.usersPage.staffAccount")}</span>,
    },
    {
      key: "plan",
      header: "Plan",
      sortValue: (user) => user.memberships[0]?.planName ?? "",
      /*
       * The plan, and the way to change it, on the row where the email is.
       *
       * Billing can already grant one, but it lists families by name — and an
       * operator with somebody's email in front of them has no way to know
       * which "Smith Family" is theirs. Here the two facts are on one line.
       *
       * Staff have no family and so no plan: they hold every feature by virtue
       * of running the deployment (see `entitlements`), which is why testing
       * Koda does not need a grant at all.
       */
      render: (user) => {
        const family = user.memberships[0];
        if (!family) return <span className="text-muted">—</span>;
        return (
          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <UIBadge variant={family.live ? "success" : "neutral"}>{family.planName}</UIBadge>
            <UIButton
              variant="ghost"
              size="sm"
              icon={<CreditCard />}
              isLoading={busy === `plan:${family.familyId}`}
              onClick={() => {
                setPlanFor({ user, family });
                // Preselect the first paid plan: upgrading is what this is for,
                // and "Free" is one option down for the rarer case.
                setPlanChoice(
                  plans.find((plan) => plan.priceCents > 0)?.planId ?? family.planId,
                );
                setPlanMonths(1);
              }}
            >
              {translate("admin.usersPage.change")}
            </UIButton>
          </div>
        );
      },
      nowrap: true,
    },
    {
      key: "sessions",
      header: "Sessions",
      sortValue: (user) => user.activeSessionCount,
      render: (user) => user.activeSessionCount,
      numeric: true,
      align: "right",
    },
    {
      /*
       * Whether notifications reach this person, and on how many browsers.
       *
       * A count rather than a tick, because one account may hold three — a
       * phone that is registered, a laptop where the prompt was dismissed, and
       * a machine since signed out of — and a single yes/no would be wrong
       * about at least one of them. Zero is drawn as "Off" rather than as 0:
       * this column is read to answer "can I reach them?", and a nought in a
       * numeric column reads as a measurement rather than an answer.
       */
      key: "notifications",
      header: "Notifications",
      sortValue: (user) => user.notifiedBrowserCount,
      render: (user) =>
        user.notifiedBrowserCount === 0 ? (
          <span className="text-muted">{translate("admin.usersPage.off")}</span>
        ) : (
          <span className="text-ink font-bold">
            {user.notifiedBrowserCount === 1 ? translate("admin.usersPage.1Browser") : translate("admin.usersPage.notifiedbrowsercountBrowsers", { notifiedBrowserCount: user.notifiedBrowserCount })}
          </span>
        ),
      nowrap: true,
      align: "right",
    },
    {
      key: "lastLogin",
      header: "Last login",
      sortValue: (user) => user.lastLoginAt ?? "",
      render: (user) => formatDate(user.lastLoginAt),
      muted: true,
      nowrap: true,
    },
    {
      key: "actions",
      header: "Actions",
      render: (user) => <div className="flex min-w-[19rem] items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}><UIButton variant="ghost" size="sm" icon={<Pencil />} onClick={() => setEditing({ ...user, memberships: user.memberships.map((membership) => ({ ...membership })) })}>{translate("admin.usersPage.edit")}</UIButton><UIButton variant="ghost" size="sm" icon={<KeyRound />} onClick={() => setPasswordUser(user)}>{translate("admin.usersPage.password")}</UIButton>{user.status === "active" ? <UIButton variant="warning" size="sm" icon={<Ban />} disabled={user.isYou} isLoading={busy === `status:${user.id}`} onClick={() => void setAccountStatus(user, "suspended")}>{translate("admin.usersPage.suspend")}</UIButton> : <UIButton variant="success" size="sm" icon={<UserCheck />} isLoading={busy === `status:${user.id}`} onClick={() => void setAccountStatus(user, "active")}>{translate("admin.usersPage.activate")}</UIButton>}<UIButton variant="danger" size="sm" icon={<Trash2 />} disabled={user.isYou || user.memberships.length > 0} onClick={() => setDeleting(user)}>{translate("admin.usersPage.delete")}</UIButton></div>,
      align: "right",
      nowrap: true,
    },
  ], [busy, platformRoles]);

  const onboardingColumns = useMemo<UIDataTableColumn<UserRecord>[]>(() => [
    {
      key: "user",
      header: "User",
      sortValue: (user) => user.displayName || user.email,
      render: (user) => <div className="flex min-w-[13rem] items-center gap-3"><UserAvatar user={user} /><div className="min-w-0"><div className="koda-admin-card-title flex items-center gap-2">{user.displayName || user.email.split("@")[0]}{user.isYou && <UIBadge variant="info">{translate("admin.usersPage.you")}</UIBadge>}</div><div className="koda-admin-label break-all">{user.email}</div></div></div>,
    },
    {
      key: "access",
      header: "Role",
      sortValue: roleLabel,
      render: (user) => <UIBadge variant={roleBadge(roleLabel(user))} className="capitalize">{user.platformRole === "none" ? roleLabel(user) : (platformRoles.find((item) => item.id === user.platformRole)?.name ?? user.platformRole)}</UIBadge>,
      nowrap: true,
    },
    {
      key: "onboarding",
      header: "Onboarding",
      sortValue: (user) => user.onboardingStatus,
      render: (user) => <div className="min-w-[11rem]"><UIBadge variant={onboardingBadge(user.onboardingStatus)} className="gap-1">{user.onboardingStatus === "completed" ? <CheckCircle2 className="h-3 w-3" /> : user.onboardingStatus === "blocked" ? <Ban className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{onboardingLabel(user.onboardingStatus)}</UIBadge>{user.onboardingStatus === "pending" && <div className="koda-admin-chip mt-1 text-muted">{translate("admin.usersPage.waitingValueDays", { value: daysSince(user.createdAt) })}</div>}</div>,
    },
    {
      key: "created",
      header: "Added",
      sortValue: (user) => user.createdAt ?? "",
      render: (user) => formatDate(user.createdAt),
      muted: true,
      nowrap: true,
    },
    {
      key: "lastLogin",
      header: "First activity",
      sortValue: (user) => user.lastLoginAt ?? "",
      render: (user) => user.lastLoginAt ? formatDate(user.lastLoginAt) : "Not started",
      muted: true,
      nowrap: true,
    },
    {
      key: "actions",
      header: "Actions",
      render: (user) => <div className="flex min-w-[17rem] items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}><UIButton variant="ghost" size="sm" icon={<Pencil />} onClick={() => setEditing({ ...user, memberships: user.memberships.map((membership) => ({ ...membership })) })}>{translate("admin.usersPage.edit")}</UIButton><UIButton variant="ghost" size="sm" icon={<KeyRound />} onClick={() => setPasswordUser(user)}>{user.onboardingStatus === "pending" ? translate("admin.usersPage.credentials") : translate("admin.usersPage.password")}</UIButton>{user.status === "active" ? <UIButton variant="warning" size="sm" icon={<Ban />} disabled={user.isYou} isLoading={busy === `status:${user.id}`} onClick={() => void setAccountStatus(user, "suspended")}>{translate("admin.usersPage.block")}</UIButton> : <UIButton variant="success" size="sm" icon={<UserCheck />} isLoading={busy === `status:${user.id}`} onClick={() => void setAccountStatus(user, "active")}>{translate("admin.usersPage.reopen")}</UIButton>}</div>,
      align: "right",
      nowrap: true,
    },
  ], [busy, platformRoles]);

  if (!allowed) return <NoAccess title={translate("admin.usersPage.userManagement")} permission="user:manage" what={translate("admin.usersPage.onlyPlatformAdministratorsCanManageSign")} />;

  const stats = result?.stats ?? { total: 0, active: 0, suspended: 0, staff: 0, pendingOnboarding: 0, completedOnboarding: 0, blockedOnboarding: 0 };
  const statCards = view === "onboarding" ? [
    { label: translate("admin.usersPage.awaitingSignIn"), value: stats.pendingOnboarding, icon: Clock3, tone: "text-amber-600", ground: "bg-amber-50" },
    { label: translate("admin.usersPage.onboarded"), value: stats.completedOnboarding, icon: ClipboardCheck, tone: "text-emerald-600", ground: "bg-emerald-50" },
    { label: translate("admin.usersPage.blocked"), value: stats.blockedOnboarding, icon: Ban, tone: "text-rose-600", ground: "bg-rose-50" },
    { label: translate("admin.usersPage.allAccounts"), value: stats.total, icon: Users, tone: "text-indigo-600", ground: "bg-indigo-50" },
  ] : [
    { label: translate("admin.usersPage.totalUsers"), value: stats.total, icon: Users, tone: "text-indigo-600", ground: "bg-indigo-50" },
    { label: translate("admin.usersPage.active"), value: stats.active, icon: UserCheck, tone: "text-emerald-600", ground: "bg-emerald-50" },
    { label: translate("admin.usersPage.suspended"), value: stats.suspended, icon: Ban, tone: "text-rose-600", ground: "bg-rose-50" },
    { label: translate("admin.usersPage.staff"), value: stats.staff, icon: ShieldCheck, tone: "text-amber-600", ground: "bg-amber-50" },
  ];

  return (
    <div className="min-h-full bg-white p-4 dark:bg-canvas md:p-8">
      <div className="mx-auto max-w-[100rem] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="koda-admin-page-title">{translate("admin.usersPage.userManagement")}</h1><p className="mt-1 text-sm text-[#6D6997] dark:text-muted">{translate("admin.usersPage.manageAccountsFromInitialAccessThrough")}</p></div>
          <UIButton variant="primary" icon={<UserPlus />} onClick={() => setCreateOpen(true)}>{translate("admin.usersPage.onboardUser")}</UIButton>
        </header>

        <UITabs<UserView>
          items={[
            { id: "directory", label: translate("admin.usersPage.allUsers"), count: stats.total },
            { id: "onboarding", label: translate("admin.usersPage.onboarding"), count: stats.pendingOnboarding },
          ]}
          value={view}
          onChange={setView}
          label={translate("admin.usersPage.userManagementViews")}
        />

        {view === "onboarding" && (
          <section className="grid gap-3 rounded-2xl border border-[#E8E4F6] bg-white p-4 shadow-sm dark:border-line dark:bg-surface md:grid-cols-3" aria-label={translate("admin.usersPage.onboardingWorkflow")}>
            {[
              { icon: UserPlus, title: translate("admin.usersPage.1AddAccount"), text: "Set their name, sign-in email, temporary password, and platform role." },
              { icon: KeyRound, title: translate("admin.usersPage.2ShareAccess"), text: "Send credentials through your approved secure channel." },
              { icon: ClipboardCheck, title: translate("admin.usersPage.3ConfirmActivity"), text: "Koda marks onboarding complete after their first successful sign-in." },
            ].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-xl bg-[#FBFAFF] p-3 dark:bg-surface-muted"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#534AB7] dark:bg-surface"><Icon className="h-4 w-4" /></div><div><h2 className="koda-admin-card-title">{title}</h2><p className="koda-admin-label mt-0.5 leading-relaxed">{text}</p></div></div>)}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={translate("admin.usersPage.userTotals")}>
          {statCards.map(({ label, value, icon: Icon, tone, ground }) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#E8E4F6] bg-white p-4 shadow-sm dark:border-line dark:bg-surface"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ground} dark:bg-surface-muted`}><Icon className={`h-5 w-5 ${tone}`} /></div><div><div className="koda-admin-metric">{value}</div><div className="koda-admin-label">{label}</div></div></div>)}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#E8E4F6] bg-white shadow-sm dark:border-line dark:bg-surface">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
            <UISearchInput className="flex-1" label={translate("admin.usersPage.searchUsers")} placeholder={translate("admin.usersPage.searchByNameOrEmail")} value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={role} onChange={(event) => setRole(event.target.value)} className={`${inputClass} lg:w-44`} aria-label={translate("admin.usersPage.filterByRole")}><option value="">{translate("admin.usersPage.allRoles")}</option><optgroup label={translate("admin.usersPage.platformRoles")}>{platformRoles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup><optgroup label={translate("admin.usersPage.familyRoles")}><option value="owner">{translate("admin.usersPage.owner")}</option><option value="parent">{translate("admin.usersPage.parent")}</option><option value="caregiver">{translate("admin.usersPage.caregiver")}</option><option value="student">{translate("admin.usersPage.student")}</option><option value="child">{translate("admin.usersPage.child")}</option></optgroup></select>
            {view === "directory" ? <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputClass} lg:w-40`} aria-label={translate("admin.usersPage.filterByStatus")}><option value="">{translate("admin.usersPage.allStatuses")}</option><option value="active">{translate("admin.usersPage.active")}</option><option value="suspended">{translate("admin.usersPage.suspended")}</option></select> : <select value={onboarding} onChange={(event) => setOnboarding(event.target.value as "" | OnboardingStatus)} className={`${inputClass} lg:w-52`} aria-label={translate("admin.usersPage.filterByOnboardingStage")}><option value="">{translate("admin.usersPage.allOnboarding")}</option><option value="pending">{translate("admin.usersPage.awaitingSignIn")}</option><option value="completed">{translate("admin.usersPage.onboarded")}</option><option value="blocked">{translate("admin.usersPage.blocked")}</option></select>}
            <UIButton variant="secondary" size="icon" icon={<RefreshCw />} onClick={() => void load()} isLoading={loading} aria-label={translate("admin.usersPage.refreshUsers")} />
          </div>

          {error && <div className="m-4 mb-0"><p className={themeSystem.flash("error")}>{error}</p></div>}
          {notice && <div className="m-4 mb-0"><p className={themeSystem.flash("success")}>{notice}</p></div>}
          <div className="p-4 pb-0">{loading ? <LoadingTable /> : <UIDataTable columns={view === "onboarding" ? onboardingColumns : columns} rows={result?.users ?? []} rowKey={(user) => user.id} defaultSort={{ key: "user", direction: "asc" }} emptyMessage={view === "onboarding" ? translate("admin.usersPage.noAccountsMatchThisOnboardingStage") : translate("admin.usersPage.noUsersMatchTheseFilters")} caption={view === "onboarding" ? translate("admin.usersPage.kodaUserOnboarding") : translate("admin.usersPage.kodaUserAccounts")} />}</div>
          <div className="flex flex-col gap-2 px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between"><span>{translate("admin.usersPage.valueUsersPageValue2OfValue3", { value: result?.total ?? 0, value2: result?.page ?? page, value3: result?.pages ?? 1 })}</span><div className="flex items-center gap-2"><UIButton variant="secondary" size="sm" icon={<ChevronLeft />} disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>{translate("admin.usersPage.previous")}</UIButton><UIButton variant="secondary" size="sm" iconRight={<ChevronRight />} disabled={page >= (result?.pages ?? 1) || loading} onClick={() => setPage((value) => value + 1)}>{translate("admin.usersPage.next")}</UIButton></div></div>
        </section>
      </div>

      <UIModal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={translate("admin.usersPage.onboardAUser")} footer={<><UIButton variant="secondary" onClick={() => setCreateOpen(false)}>{translate("admin.usersPage.cancel")}</UIButton><UIButton variant="primary" isLoading={busy === "create"} disabled={!form.email || form.password.length < 8} onClick={() => void createUser()}>{translate("admin.usersPage.addToOnboarding")}</UIButton></>}>
        <div className="space-y-4"><div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-[#534AB7] dark:border-line dark:bg-surface-muted dark:text-indigo-300">{translate("admin.usersPage.thisCreatesAnActiveStaffAccount")}{" "}<strong>{translate("admin.usersPage.awaitingSignIn")}</strong>{translate("admin.usersPage.kodaMarksItOnboardedAfterThe")}</div><Field label={translate("admin.usersPage.displayName")}><input className={inputClass} value={form.displayName} onChange={(event) => setForm((value) => ({ ...value, displayName: event.target.value }))} placeholder={translate("admin.usersPage.personSFullName")} /></Field><Field label={translate("admin.usersPage.signInEmail")}><input type="email" autoComplete="off" className={inputClass} value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} placeholder={translate("admin.usersPage.nameExampleCom")} /></Field><Field label={translate("admin.usersPage.temporaryPassword")} hint={translate("admin.usersPage.atLeast8CharactersShareIt")}><input type="password" autoComplete="new-password" className={inputClass} value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} /></Field><Field label={translate("admin.usersPage.platformRole")} hint={translate("admin.usersPage.thisControlsWhatTheUserCan")}><select className={inputClass} value={form.platformRole} onChange={(event) => setForm((value) => ({ ...value, platformRole: event.target.value }))}>{platformRoles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>
      </UIModal>

      <UIModal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={translate("admin.usersPage.editUser")} footer={<><UIButton variant="secondary" onClick={() => setEditing(null)}>{translate("admin.usersPage.cancel")}</UIButton><UIButton variant="primary" isLoading={Boolean(editing && busy === editing.id)} onClick={() => void saveUser()}>{translate("admin.usersPage.saveChanges")}</UIButton></>}>
        {editing && <div className="space-y-4"><Field label={translate("admin.usersPage.displayName")}><input className={inputClass} value={editing.displayName ?? ""} onChange={(event) => setEditing({ ...editing, displayName: event.target.value })} /></Field><Field label={translate("admin.usersPage.email")}><input type="email" className={inputClass} value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} /></Field><Field label={translate("admin.usersPage.platformRole")} hint={editing.isYou ? translate("admin.usersPage.youMayChangeYourOwnRole") : translate("admin.usersPage.platformAccessIsIndependentFromThe")}><select className={inputClass} value={editing.platformRole} onChange={(event) => setEditing({ ...editing, platformRole: event.target.value })}><option value="none">{translate("admin.usersPage.none")}</option>{platformRoles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label={translate("admin.usersPage.accountStatus")}><select className={inputClass} value={editing.status} disabled={editing.isYou} onChange={(event) => setEditing({ ...editing, status: event.target.value as AccountStatus })}><option value="active">{translate("admin.usersPage.active")}</option><option value="suspended">{translate("admin.usersPage.suspended")}</option></select></Field>{editing.memberships.length > 0 && <div className="space-y-3 border-t border-line pt-4"><div><h3 className="koda-admin-section-title">{translate("admin.usersPage.familyRoles")}</h3><p className="koda-admin-label mt-0.5">{translate("admin.usersPage.changeThisUserSAccessInside")}</p></div>{editing.memberships.map((membership, index) => <Field key={membership.familyId} label={membership.familyName || membership.familyId} hint={membership.role === "owner" ? translate("admin.usersPage.theFamilyOwnerCannotBeDemoted") : undefined}><select className={inputClass} value={membership.role} disabled={membership.role === "owner"} onChange={(event) => setEditing({ ...editing, memberships: editing.memberships.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) })}><option value="owner" disabled>{translate("admin.usersPage.owner")}</option><option value="parent">{translate("admin.usersPage.parent")}</option><option value="caregiver">{translate("admin.usersPage.caregiver")}</option><option value="student">{translate("admin.usersPage.student")}</option><option value="child">{translate("admin.usersPage.child")}</option></select></Field>)}</div>}</div>}
      </UIModal>

      <UIModal isOpen={Boolean(passwordUser)} onClose={() => { setPasswordUser(null); setPassword(""); }} title={translate("admin.usersPage.resetPassword")} footer={<><UIButton variant="secondary" onClick={() => setPasswordUser(null)}>{translate("admin.usersPage.cancel")}</UIButton><UIButton variant="warning" isLoading={Boolean(passwordUser && busy === `password:${passwordUser.id}`)} disabled={password.length < 8} onClick={() => void resetPassword()}>{translate("admin.usersPage.resetPassword")}</UIButton></>}><p className="mb-4 text-sm text-body">{translate("admin.usersPage.setANewPasswordFor")}{" "}<strong>{passwordUser?.email}</strong>{translate("admin.usersPage.allOfTheirCurrentSessionsWill")}</p><Field label={translate("admin.usersPage.newPassword")} hint={translate("admin.usersPage.atLeast8Characters")}><input type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></Field></UIModal>

      <UIModal
        isOpen={Boolean(planFor)}
        onClose={() => setPlanFor(null)}
        title={translate("admin.usersPage.planForValue", { value: planFor?.family.familyName || translate("admin.usersPage.thisFamily") })}
        footer={
          <>
            <UIButton variant="secondary" onClick={() => setPlanFor(null)}>
              {translate("admin.usersPage.cancel")}
            </UIButton>
            <UIButton
              variant="primary"
              isLoading={Boolean(planFor && busy === `plan:${planFor.family.familyId}`)}
              onClick={() => void grantPlan()}
            >
              {translate("admin.usersPage.applyPlan")}
            </UIButton>
          </>
        }
      >
        {planFor && (
          <div className="space-y-4">
            <p className="text-sm text-body">
              {planFor.user.displayName ? `${planFor.user.displayName} · ` : ""}
              <span className="font-mono">{planFor.user.email}</span>
              {translate("admin.usersPage.currentlyOn")}
              <strong>{planFor.family.planName}</strong>.
            </p>
            <Field label={translate("admin.usersPage.plan")}>
              <select
                className={inputClass}
                value={planChoice}
                onChange={(event) => setPlanChoice(event.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.planId} value={plan.planId}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={translate("admin.usersPage.forHowLong")}
              hint={translate("admin.usersPage.zeroMonthsNeverExpiresForA")}
            >
              <select
                className={inputClass}
                value={planMonths}
                onChange={(event) => setPlanMonths(Number(event.target.value))}
              >
                <option value={0}>{translate("admin.usersPage.noEndDate")}</option>
                <option value={1}>{translate("admin.usersPage.1Month")}</option>
                <option value={3}>{translate("admin.usersPage.3Months")}</option>
                <option value={12}>{translate("admin.usersPage.12Months")}</option>
              </select>
            </Field>
            <p className="text-xs text-muted">
              {translate("admin.usersPage.thereIsNoPaymentHereA")}
            </p>
          </div>
        )}
      </UIModal>

      <UIDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} title={translate("admin.usersPage.deleteUserAccount")} description={translate("admin.usersPage.valueWillBePermanentlyRemovedThis", { value: deleting?.email ?? translate("admin.usersPage.thisAccount") })} confirmText={translate("admin.usersPage.deleteAccount")} variant="danger" onConfirm={() => { if (deleting) void deleteUser(deleting); }} />
    </div>
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => <label className="block space-y-1.5"><span className="koda-admin-label text-ink">{label}</span>{children}{hint && <span className="block text-xs text-muted">{hint}</span>}</label>;
