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
  Search,
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
} from "../ui";
import { NoAccess } from "./NoAccess";

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
  <div className={themeSystem.table.wrapper} aria-label="Loading users" aria-busy="true">
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
          note: `Granted from user management for ${planFor.user.email}`,
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
      render: (user) => <div className="flex min-w-[12rem] items-center gap-3"><UserAvatar user={user} /><div className="min-w-0"><div className="koda-admin-card-title flex items-center gap-2">{user.displayName || user.email.split("@")[0]}{user.isYou && <UIBadge variant="info">You</UIBadge>}</div><div className="koda-admin-label break-all">{user.email}</div></div></div>,
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
      render: (user) => user.memberships.length ? <div className="min-w-[8rem]">{user.memberships.slice(0, 2).map((item) => <div key={item.familyId}><span className="text-sm text-ink">{item.familyName || item.familyId}</span><span className="koda-admin-chip ml-1 text-muted">· {item.role}</span></div>)}</div> : <span className="text-muted">Staff account</span>,
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
              Change
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
          <span className="text-muted">Off</span>
        ) : (
          <span className="text-ink font-bold">
            {user.notifiedBrowserCount === 1 ? "1 browser" : `${user.notifiedBrowserCount} browsers`}
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
      render: (user) => <div className="flex min-w-[19rem] items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}><UIButton variant="ghost" size="sm" icon={<Pencil />} onClick={() => setEditing({ ...user, memberships: user.memberships.map((membership) => ({ ...membership })) })}>Edit</UIButton><UIButton variant="ghost" size="sm" icon={<KeyRound />} onClick={() => setPasswordUser(user)}>Password</UIButton>{user.status === "active" ? <UIButton variant="warning" size="sm" icon={<Ban />} disabled={user.isYou} isLoading={busy === `status:${user.id}`} onClick={() => void setAccountStatus(user, "suspended")}>Suspend</UIButton> : <UIButton variant="success" size="sm" icon={<UserCheck />} isLoading={busy === `status:${user.id}`} onClick={() => void setAccountStatus(user, "active")}>Activate</UIButton>}<UIButton variant="danger" size="sm" icon={<Trash2 />} disabled={user.isYou || user.memberships.length > 0} onClick={() => setDeleting(user)}>Delete</UIButton></div>,
      align: "right",
      nowrap: true,
    },
  ], [busy, platformRoles]);

  const onboardingColumns = useMemo<UIDataTableColumn<UserRecord>[]>(() => [
    {
      key: "user",
      header: "User",
      sortValue: (user) => user.displayName || user.email,
      render: (user) => <div className="flex min-w-[13rem] items-center gap-3"><UserAvatar user={user} /><div className="min-w-0"><div className="koda-admin-card-title flex items-center gap-2">{user.displayName || user.email.split("@")[0]}{user.isYou && <UIBadge variant="info">You</UIBadge>}</div><div className="koda-admin-label break-all">{user.email}</div></div></div>,
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
      render: (user) => <div className="min-w-[11rem]"><UIBadge variant={onboardingBadge(user.onboardingStatus)} className="gap-1">{user.onboardingStatus === "completed" ? <CheckCircle2 className="h-3 w-3" /> : user.onboardingStatus === "blocked" ? <Ban className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{onboardingLabel(user.onboardingStatus)}</UIBadge>{user.onboardingStatus === "pending" && <div className="koda-admin-chip mt-1 text-muted">Waiting {daysSince(user.createdAt)} days</div>}</div>,
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
      render: (user) => <div className="flex min-w-[17rem] items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}><UIButton variant="ghost" size="sm" icon={<Pencil />} onClick={() => setEditing({ ...user, memberships: user.memberships.map((membership) => ({ ...membership })) })}>Edit</UIButton><UIButton variant="ghost" size="sm" icon={<KeyRound />} onClick={() => setPasswordUser(user)}>{user.onboardingStatus === "pending" ? "Credentials" : "Password"}</UIButton>{user.status === "active" ? <UIButton variant="warning" size="sm" icon={<Ban />} disabled={user.isYou} isLoading={busy === `status:${user.id}`} onClick={() => void setAccountStatus(user, "suspended")}>Block</UIButton> : <UIButton variant="success" size="sm" icon={<UserCheck />} isLoading={busy === `status:${user.id}`} onClick={() => void setAccountStatus(user, "active")}>Reopen</UIButton>}</div>,
      align: "right",
      nowrap: true,
    },
  ], [busy, platformRoles]);

  if (!allowed) return <NoAccess title="User Management" permission="user:manage" what="Only platform administrators can manage sign-in accounts." />;

  const stats = result?.stats ?? { total: 0, active: 0, suspended: 0, staff: 0, pendingOnboarding: 0, completedOnboarding: 0, blockedOnboarding: 0 };
  const statCards = view === "onboarding" ? [
    { label: "Awaiting sign-in", value: stats.pendingOnboarding, icon: Clock3, tone: "text-amber-600", ground: "bg-amber-50" },
    { label: "Onboarded", value: stats.completedOnboarding, icon: ClipboardCheck, tone: "text-emerald-600", ground: "bg-emerald-50" },
    { label: "Blocked", value: stats.blockedOnboarding, icon: Ban, tone: "text-rose-600", ground: "bg-rose-50" },
    { label: "All accounts", value: stats.total, icon: Users, tone: "text-indigo-600", ground: "bg-indigo-50" },
  ] : [
    { label: "Total users", value: stats.total, icon: Users, tone: "text-indigo-600", ground: "bg-indigo-50" },
    { label: "Active", value: stats.active, icon: UserCheck, tone: "text-emerald-600", ground: "bg-emerald-50" },
    { label: "Suspended", value: stats.suspended, icon: Ban, tone: "text-rose-600", ground: "bg-rose-50" },
    { label: "Staff", value: stats.staff, icon: ShieldCheck, tone: "text-amber-600", ground: "bg-amber-50" },
  ];

  return (
    <div className="min-h-full bg-[#FBFAFF] p-4 dark:bg-canvas md:p-8">
      <div className="mx-auto max-w-[100rem] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="koda-admin-page-title">User Management</h1><p className="mt-1 text-sm text-[#6D6997] dark:text-muted">Manage accounts from initial access through active use.</p></div>
          <UIButton variant="primary" icon={<UserPlus />} onClick={() => setCreateOpen(true)}>Onboard user</UIButton>
        </header>

        <UITabs<UserView>
          items={[
            { id: "directory", label: "All users", count: stats.total },
            { id: "onboarding", label: "Onboarding", count: stats.pendingOnboarding },
          ]}
          value={view}
          onChange={setView}
          label="User management views"
        />

        {view === "onboarding" && (
          <section className="grid gap-3 rounded-2xl border border-[#E8E4F6] bg-white p-4 shadow-sm dark:border-line dark:bg-surface md:grid-cols-3" aria-label="Onboarding workflow">
            {[
              { icon: UserPlus, title: "1. Add account", text: "Set their name, sign-in email, temporary password, and platform role." },
              { icon: KeyRound, title: "2. Share access", text: "Send credentials through your approved secure channel." },
              { icon: ClipboardCheck, title: "3. Confirm activity", text: "Koda marks onboarding complete after their first successful sign-in." },
            ].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-xl bg-[#FBFAFF] p-3 dark:bg-surface-muted"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#534AB7] dark:bg-surface"><Icon className="h-4 w-4" /></div><div><h2 className="koda-admin-card-title">{title}</h2><p className="koda-admin-label mt-0.5 leading-relaxed">{text}</p></div></div>)}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="User totals">
          {statCards.map(({ label, value, icon: Icon, tone, ground }) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#E8E4F6] bg-white p-4 shadow-sm dark:border-line dark:bg-surface"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ground} dark:bg-surface-muted`}><Icon className={`h-5 w-5 ${tone}`} /></div><div><div className="koda-admin-metric">{value}</div><div className="koda-admin-label">{label}</div></div></div>)}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#E8E4F6] bg-white shadow-sm dark:border-line dark:bg-surface">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><span className="sr-only">Search users</span><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-9`} placeholder="Search by name or email" /></label>
            <select value={role} onChange={(event) => setRole(event.target.value)} className={`${inputClass} lg:w-44`} aria-label="Filter by role"><option value="">All roles</option><optgroup label="Platform roles">{platformRoles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup><optgroup label="Family roles"><option value="owner">Owner</option><option value="parent">Parent</option><option value="caregiver">Caregiver</option><option value="student">Student</option><option value="child">Child</option></optgroup></select>
            {view === "directory" ? <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputClass} lg:w-40`} aria-label="Filter by status"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select> : <select value={onboarding} onChange={(event) => setOnboarding(event.target.value as "" | OnboardingStatus)} className={`${inputClass} lg:w-52`} aria-label="Filter by onboarding stage"><option value="">All onboarding</option><option value="pending">Awaiting sign-in</option><option value="completed">Onboarded</option><option value="blocked">Blocked</option></select>}
            <UIButton variant="secondary" size="icon" icon={<RefreshCw />} onClick={() => void load()} isLoading={loading} aria-label="Refresh users" />
          </div>

          {error && <div className="m-4 mb-0"><p className={themeSystem.flash("error")}>{error}</p></div>}
          {notice && <div className="m-4 mb-0"><p className={themeSystem.flash("success")}>{notice}</p></div>}
          <div className="p-4 pb-0">{loading ? <LoadingTable /> : <UIDataTable columns={view === "onboarding" ? onboardingColumns : columns} rows={result?.users ?? []} rowKey={(user) => user.id} defaultSort={{ key: "user", direction: "asc" }} emptyMessage={view === "onboarding" ? "No accounts match this onboarding stage." : "No users match these filters."} caption={view === "onboarding" ? "Koda user onboarding" : "Koda user accounts"} />}</div>
          <div className="flex flex-col gap-2 px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between"><span>{result?.total ?? 0} users · page {result?.page ?? page} of {result?.pages ?? 1}</span><div className="flex items-center gap-2"><UIButton variant="secondary" size="sm" icon={<ChevronLeft />} disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</UIButton><UIButton variant="secondary" size="sm" iconRight={<ChevronRight />} disabled={page >= (result?.pages ?? 1) || loading} onClick={() => setPage((value) => value + 1)}>Next</UIButton></div></div>
        </section>
      </div>

      <UIModal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Onboard a user" footer={<><UIButton variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</UIButton><UIButton variant="primary" isLoading={busy === "create"} disabled={!form.email || form.password.length < 8} onClick={() => void createUser()}>Add to onboarding</UIButton></>}>
        <div className="space-y-4"><div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-sm text-[#534AB7] dark:border-line dark:bg-surface-muted dark:text-indigo-300">This creates an active staff account in <strong>Awaiting sign-in</strong>. Koda marks it onboarded after the first successful login.</div><Field label="Display name"><input className={inputClass} value={form.displayName} onChange={(event) => setForm((value) => ({ ...value, displayName: event.target.value }))} placeholder="Person's full name" /></Field><Field label="Sign-in email"><input type="email" autoComplete="off" className={inputClass} value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} placeholder="name@example.com" /></Field><Field label="Temporary password" hint="At least 8 characters. Share it through an approved secure channel."><input type="password" autoComplete="new-password" className={inputClass} value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} /></Field><Field label="Platform role" hint="This controls what the user can access immediately after sign-in."><select className={inputClass} value={form.platformRole} onChange={(event) => setForm((value) => ({ ...value, platformRole: event.target.value }))}>{platformRoles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>
      </UIModal>

      <UIModal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit user" footer={<><UIButton variant="secondary" onClick={() => setEditing(null)}>Cancel</UIButton><UIButton variant="primary" isLoading={Boolean(editing && busy === editing.id)} onClick={() => void saveUser()}>Save changes</UIButton></>}>
        {editing && <div className="space-y-4"><Field label="Display name"><input className={inputClass} value={editing.displayName ?? ""} onChange={(event) => setEditing({ ...editing, displayName: event.target.value })} /></Field><Field label="Email"><input type="email" className={inputClass} value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} /></Field><Field label="Platform role" hint={editing.isYou ? "You may change your own role while another active admin remains." : "Platform access is independent from the user's role inside a family."}><select className={inputClass} value={editing.platformRole} onChange={(event) => setEditing({ ...editing, platformRole: event.target.value })}><option value="none">None</option>{platformRoles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Account status"><select className={inputClass} value={editing.status} disabled={editing.isYou} onChange={(event) => setEditing({ ...editing, status: event.target.value as AccountStatus })}><option value="active">Active</option><option value="suspended">Suspended</option></select></Field>{editing.memberships.length > 0 && <div className="space-y-3 border-t border-line pt-4"><div><h3 className="koda-admin-section-title">Family roles</h3><p className="koda-admin-label mt-0.5">Change this user's access inside each family. Ownership must be transferred separately.</p></div>{editing.memberships.map((membership, index) => <Field key={membership.familyId} label={membership.familyName || membership.familyId} hint={membership.role === "owner" ? "The family owner cannot be demoted here." : undefined}><select className={inputClass} value={membership.role} disabled={membership.role === "owner"} onChange={(event) => setEditing({ ...editing, memberships: editing.memberships.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) })}><option value="owner" disabled>Owner</option><option value="parent">Parent</option><option value="caregiver">Caregiver</option><option value="student">Student</option><option value="child">Child</option></select></Field>)}</div>}</div>}
      </UIModal>

      <UIModal isOpen={Boolean(passwordUser)} onClose={() => { setPasswordUser(null); setPassword(""); }} title="Reset password" footer={<><UIButton variant="secondary" onClick={() => setPasswordUser(null)}>Cancel</UIButton><UIButton variant="warning" isLoading={Boolean(passwordUser && busy === `password:${passwordUser.id}`)} disabled={password.length < 8} onClick={() => void resetPassword()}>Reset password</UIButton></>}><p className="mb-4 text-sm text-body">Set a new password for <strong>{passwordUser?.email}</strong>. All of their current sessions will end.</p><Field label="New password" hint="At least 8 characters."><input type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></Field></UIModal>

      <UIModal
        isOpen={Boolean(planFor)}
        onClose={() => setPlanFor(null)}
        title={`Plan for ${planFor?.family.familyName || "this family"}`}
        footer={
          <>
            <UIButton variant="secondary" onClick={() => setPlanFor(null)}>
              Cancel
            </UIButton>
            <UIButton
              variant="primary"
              isLoading={Boolean(planFor && busy === `plan:${planFor.family.familyId}`)}
              onClick={() => void grantPlan()}
            >
              Apply plan
            </UIButton>
          </>
        }
      >
        {planFor && (
          <div className="space-y-4">
            <p className="text-sm text-body">
              {planFor.user.displayName ? `${planFor.user.displayName} · ` : ""}
              <span className="font-mono">{planFor.user.email}</span>
              {" — currently on "}
              <strong>{planFor.family.planName}</strong>.
            </p>
            <Field label="Plan">
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
              label="For how long"
              hint="Zero months never expires — for a test account or a school. Anything else lapses on its own; nothing has to run at midnight."
            >
              <select
                className={inputClass}
                value={planMonths}
                onChange={(event) => setPlanMonths(Number(event.target.value))}
              >
                <option value={0}>No end date</option>
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={12}>12 months</option>
              </select>
            </Field>
            <p className="text-xs text-muted">
              There is no payment here — a grant is a date, and it lapses when the date passes.
            </p>
          </div>
        )}
      </UIModal>

      <UIDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete user account?" description={`${deleting?.email ?? "This account"} will be permanently removed. This is only available for accounts that do not belong to a family.`} confirmText="Delete account" variant="danger" onConfirm={() => { if (deleting) void deleteUser(deleting); }} />
    </div>
  );
};

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => <label className="block space-y-1.5"><span className="koda-admin-label text-ink">{label}</span>{children}{hint && <span className="block text-xs text-muted">{hint}</span>}</label>;
