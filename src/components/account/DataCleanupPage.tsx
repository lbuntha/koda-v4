import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookX, Eraser, PenOff, RefreshCw, Trash2, UserX } from "lucide-react";

import { ApiError, accessToken, request, usePermissions } from "../../lib/sync";
import { refreshMaintenanceVersions } from "../../lib/maintenanceReset";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIModal, UISearchInput, UISectionHeader, UITabs } from "../ui";
import { NoAccess } from "./NoAccess";

import { translate } from "../../lib/i18n";

/**
 * The operator's bin: permanent deletes of accounts, XP and studio content.
 *
 * Everything else in the app soft-deletes so a mistake can be undone; nothing
 * here can be. That is why every action previews what it will remove, and the
 * "everything" actions ask for a typed word the server checks as well. Gated on
 * `user:manage` *and* `system:write` — only the admin role holds both — so a
 * developer who builds Trace and Library content cannot wipe it for everyone.
 */

type CleanupTab = "users" | "xp" | "trace" | "library";

const CONFIRM_WORD = "DELETE";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-60";

interface Membership {
  familyId: string;
  familyName: string;
  role: string;
}

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  platformRole: string;
  memberships: Membership[];
  isYou: boolean;
}

interface UsersPage {
  users: UserRow[];
  page: number;
  pages: number;
  total: number;
}

interface UserImpact {
  id: string;
  email: string;
  isYou: boolean;
  ownedFamilies: { familyId: string; familyName: string; learners: number; otherMembers: string[] }[];
  otherFamilies: { familyId: string; familyName: string; role: string }[];
}

interface TraceRow {
  id: string;
  title: string;
  updatedAt: string | null;
  deleted: boolean;
  published?: boolean;
  paintings?: number;
}

interface BookRow {
  id: string;
  title: string;
  updatedAt: string | null;
  deleted: boolean;
  published: boolean;
  rev: number;
  reports: number;
}

type Summary = Record<string, number>;

interface Pending {
  title: string;
  body: React.ReactNode;
  confirmText: string;
  /** Set for "everything" actions: the operator types the word to arm the button. */
  typed?: boolean;
  run: (confirm: string) => Promise<void>;
}

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

/** `{events: 12, books: 0}` → "12 events" — zero rows say nothing worth reading. */
const describeDeleted = (deleted: Record<string, number>): string => {
  const parts = Object.entries(deleted)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${n} ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`);
  return parts.length ? parts.join(", ") : translate("admin.dataCleanup.nothingToDelete");
};

const toggle = (set: Set<string>, id: string): Set<string> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

const Check: React.FC<{ checked: boolean; disabled?: boolean; onChange: () => void; label: string }> = ({
  checked,
  disabled,
  onChange,
  label,
}) => (
  <input
    type="checkbox"
    className="h-4 w-4 shrink-0 accent-rose-600"
    checked={checked}
    disabled={disabled}
    onChange={onChange}
    aria-label={label}
  />
);

/** A selectable list of rows with a select-all header. Shared by Trace and Library. */
const PickList: React.FC<{
  title: string;
  rows: { id: string; title: string; meta: React.ReactNode; badges?: React.ReactNode }[];
  selected: Set<string>;
  onSelected: (next: Set<string>) => void;
  empty: string;
}> = ({ title, rows, selected, onSelected, empty }) => {
  const all = rows.length > 0 && rows.every((row) => selected.has(row.id));
  return (
    <div className="rounded-2xl border border-line">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <Check
          checked={all}
          disabled={rows.length === 0}
          onChange={() => onSelected(all ? new Set() : new Set(rows.map((row) => row.id)))}
          label={translate("admin.dataCleanup.selectAll")}
        />
        <h3 className="koda-admin-card-title">{title}</h3>
        <span className="ml-auto text-xs text-muted">
          {translate("admin.dataCleanup.selectedOfTotal", { selected: selected.size, total: rows.length })}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="max-h-96 divide-y divide-line overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-muted">
                <Check
                  checked={selected.has(row.id)}
                  onChange={() => onSelected(toggle(selected, row.id))}
                  label={row.title}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{row.title}</span>
                  <span className="block truncate text-xs text-muted">{row.meta}</span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">{row.badges}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const DangerCard: React.FC<{ title: string; body: string; children: React.ReactNode }> = ({ title, body, children }) => (
  <article className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
    <div className="space-y-1">
      <h3 className="koda-admin-card-title flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-rose-600" />
        {title}
      </h3>
      <p className="text-xs leading-5 text-muted">{body}</p>
    </div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </article>
);

export const DataCleanupPage: React.FC = () => {
  const { can } = usePermissions();
  const allowed = can("user:manage") && can("system:write");

  const [tab, setTab] = useState<CleanupTab>("users");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  // Users
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UsersPage | null>(null);
  const [pickedUsers, setPickedUsers] = useState<Map<string, UserRow>>(new Map());

  // Trace and Library
  const [traceItems, setTraceItems] = useState<TraceRow[] | null>(null);
  const [traceCollections, setTraceCollections] = useState<TraceRow[] | null>(null);
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
  const [pickedCollections, setPickedCollections] = useState<Set<string>>(new Set());
  const [books, setBooks] = useState<BookRow[] | null>(null);
  const [pickedBooks, setPickedBooks] = useState<Set<string>>(new Set());
  const [includeUnitVoices, setIncludeUnitVoices] = useState(false);

  const call = useCallback(async <T,>(path: string, body?: unknown): Promise<T> => {
    const token = await accessToken();
    return request<T>(path, body === undefined ? { token } : { method: "POST", token, body });
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await call<Summary>("/admin/cleanup/summary"));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [call]);

  const loadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ q: query, page: String(page), pageSize: "25" });
      setUsers(await call<UsersPage>(`/admin/users?${params}`));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [call, query, page]);

  const loadTrace = useCallback(async () => {
    try {
      const body = await call<{ items: TraceRow[]; collections: TraceRow[] }>("/admin/cleanup/trace");
      setTraceItems(body.items);
      setTraceCollections(body.collections);
      setPickedItems(new Set());
      setPickedCollections(new Set());
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [call]);

  const loadLibrary = useCallback(async () => {
    try {
      setBooks((await call<{ books: BookRow[] }>("/admin/cleanup/library")).books);
      setPickedBooks(new Set());
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [call]);

  useEffect(() => {
    if (allowed) void loadSummary();
  }, [allowed, loadSummary]);

  useEffect(() => {
    if (!allowed || (tab !== "users" && tab !== "xp")) return;
    const timer = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(timer);
  }, [allowed, tab, loadUsers]);

  useEffect(() => {
    if (allowed && tab === "trace" && traceItems === null) void loadTrace();
    if (allowed && tab === "library" && books === null) void loadLibrary();
  }, [allowed, tab, traceItems, books, loadTrace, loadLibrary]);

  const ask = (next: Pending) => {
    setTyped("");
    setError(null);
    setNotice(null);
    setPending(next);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await pending.run(typed);
      setPending(null);
      playSound("pop");
      void loadSummary();
    } catch (e) {
      setError((e as ApiError).message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------ users

  const pickedIds = [...pickedUsers.keys()];

  const deleteUsers = async () => {
    setBusy(true);
    setError(null);
    try {
      const preview = await call<{ users: UserImpact[] }>("/admin/cleanup/users/preview", { userIds: pickedIds });
      ask({
        title: translate("admin.dataCleanup.deleteNUsers", { count: preview.users.length }),
        confirmText: translate("admin.dataCleanup.deletePermanently"),
        body: (
          <div className="space-y-3 text-sm text-body">
            <p>{translate("admin.dataCleanup.deleteUsersExplain")}</p>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {preview.users.map((user) => (
                <li key={user.id} className="rounded-xl border border-line p-3">
                  <div className="font-medium text-ink">
                    {user.email} {user.isYou && <UIBadge variant="warning">{translate("admin.dataCleanup.youSkipped")}</UIBadge>}
                  </div>
                  {user.ownedFamilies.map((family) => (
                    <p key={family.familyId} className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                      {translate("admin.dataCleanup.ownedFamilyGoes", {
                        family: family.familyName || family.familyId,
                        learners: family.learners,
                      })}
                      {family.otherMembers.length > 0 &&
                        " " + translate("admin.dataCleanup.othersLoseAccess", { emails: family.otherMembers.join(", ") })}
                    </p>
                  ))}
                  {user.otherFamilies.map((family) => (
                    <p key={family.familyId} className="mt-1 text-xs text-muted">
                      {translate("admin.dataCleanup.leavesFamily", { family: family.familyName || family.familyId, role: family.role })}
                    </p>
                  ))}
                  {user.ownedFamilies.length === 0 && user.otherFamilies.length === 0 && (
                    <p className="mt-1 text-xs text-muted">{translate("admin.dataCleanup.noFamily")}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ),
        run: async () => {
          const result = await call<{
            results: { id: string; email: string | null; deleted: boolean; error: string | null }[];
            deleted: Record<string, number>;
          }>("/admin/cleanup/users/delete", { userIds: pickedIds });
          const refused = result.results.filter((r) => !r.deleted);
          setNotice(
            translate("admin.dataCleanup.deletedSummary", { what: describeDeleted(result.deleted) }) +
              (refused.length ? ` ${refused.map((r) => `${r.email ?? r.id}: ${r.error}`).join(" · ")}` : ""),
          );
          setPickedUsers(new Map());
          await loadUsers();
        },
      });
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const clearXpFor = () =>
    ask({
      title: translate("admin.dataCleanup.clearXpForN", { count: pickedIds.length }),
      confirmText: translate("admin.dataCleanup.clearXp"),
      body: (
        <div className="space-y-2 text-sm text-body">
          <p>{translate("admin.dataCleanup.clearXpExplain")}</p>
          <ul className="list-disc pl-5 text-xs text-muted">
            {[...pickedUsers.values()].map((user) => (
              <li key={user.id}>
                {user.email}
                {user.memberships.length > 0 && ` — ${user.memberships.map((m) => m.familyName || m.familyId).join(", ")}`}
              </li>
            ))}
          </ul>
        </div>
      ),
      run: async () => {
        const result = await call<{ deleted: Record<string, number> }>("/admin/cleanup/xp", { scope: "users", userIds: pickedIds });
        setNotice(translate("admin.dataCleanup.deletedSummary", { what: describeDeleted(result.deleted) }));
        // If the operator cleared their own family, this device must drop its copy too.
        if (await refreshMaintenanceVersions().catch(() => false)) window.location.reload();
      },
    });

  const clearAllXp = () =>
    ask({
      title: translate("admin.dataCleanup.clearAllXp"),
      confirmText: translate("admin.dataCleanup.clearAllXp"),
      typed: true,
      body: <p className="text-sm text-body">{translate("admin.dataCleanup.clearAllXpExplain")}</p>,
      run: async (word) => {
        await call<{ deleted: Record<string, number> }>("/admin/cleanup/xp", { scope: "all", confirm: word });
        // The global generation moved; adopt it here and start React state from zero.
        await refreshMaintenanceVersions().catch(() => false);
        window.location.reload();
      },
    });

  // ------------------------------------------------------------ trace

  const deleteTrace = (mode: "selected" | "bin" | "all") => {
    const counts = { items: pickedItems.size, collections: pickedCollections.size };
    const binned = (traceItems ?? []).filter((r) => r.deleted).length + (traceCollections ?? []).filter((r) => r.deleted).length;
    ask({
      title:
        mode === "all"
          ? translate("admin.dataCleanup.deleteAllTrace")
          : mode === "bin"
            ? translate("admin.dataCleanup.emptyBin")
            : translate("admin.dataCleanup.deleteSelected"),
      confirmText: translate("admin.dataCleanup.deletePermanently"),
      typed: mode === "all",
      body: (
        <p className="text-sm text-body">
          {mode === "all"
            ? translate("admin.dataCleanup.deleteAllTraceExplain", {
                items: summary?.traceItems ?? 0,
                collections: summary?.traceCollections ?? 0,
                paintings: summary?.tracePaintings ?? 0,
              })
            : mode === "bin"
              ? translate("admin.dataCleanup.emptyBinExplain", { count: binned })
              : translate("admin.dataCleanup.deleteTraceSelectedExplain", counts)}
        </p>
      ),
      run: async (word) => {
        const result = await call<{ deleted: Record<string, number> }>(
          "/admin/cleanup/trace/delete",
          mode === "all"
            ? { all: true, confirm: word }
            : mode === "bin"
              ? { purgeDeleted: true }
              : { itemIds: [...pickedItems], collectionIds: [...pickedCollections] },
        );
        setNotice(translate("admin.dataCleanup.deletedSummary", { what: describeDeleted(result.deleted) }));
        await loadTrace();
      },
    });
  };

  // ------------------------------------------------------------ library

  const deleteLibrary = (mode: "selected" | "bin" | "all") => {
    const binned = (books ?? []).filter((r) => r.deleted).length;
    ask({
      title:
        mode === "all"
          ? translate("admin.dataCleanup.deleteAllLibrary")
          : mode === "bin"
            ? translate("admin.dataCleanup.emptyBin")
            : translate("admin.dataCleanup.deleteSelected"),
      confirmText: translate("admin.dataCleanup.deletePermanently"),
      typed: mode === "all",
      body: (
        <p className="text-sm text-body">
          {mode === "all"
            ? translate("admin.dataCleanup.deleteAllLibraryExplain", {
                books: summary?.libraryBooks ?? 0,
                images: summary?.libraryImages ?? 0,
              })
            : mode === "bin"
              ? translate("admin.dataCleanup.emptyBinExplain", { count: binned })
              : translate("admin.dataCleanup.deleteBooksSelectedExplain", { count: pickedBooks.size })}
        </p>
      ),
      run: async (word) => {
        const result = await call<{ deleted: Record<string, number> }>(
          "/admin/cleanup/library/delete",
          mode === "all"
            ? { all: true, confirm: word, includeUnitVoices }
            : mode === "bin"
              ? { purgeDeleted: true }
              : { bookIds: [...pickedBooks] },
        );
        setNotice(translate("admin.dataCleanup.deletedSummary", { what: describeDeleted(result.deleted) }));
        await loadLibrary();
      },
    });
  };

  const tabs = useMemo(
    () => [
      { id: "users", label: translate("admin.dataCleanup.tabUsers") },
      { id: "xp", label: translate("admin.dataCleanup.tabXp") },
      { id: "trace", label: translate("admin.dataCleanup.tabTrace") },
      { id: "library", label: translate("admin.dataCleanup.tabLibrary") },
    ],
    [],
  );

  if (!allowed) {
    return (
      <NoAccess
        title={translate("admin.dataCleanup.title")}
        permission="user:manage + system:write"
        what={translate("admin.dataCleanup.noAccessWhat")}
      />
    );
  }

  const userTable = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <UISearchInput
          label={translate("admin.dataCleanup.searchUsers")}
          placeholder={translate("admin.dataCleanup.searchUsers")}
          className="flex-1"
          value={query}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <UIButton variant="secondary" size="sm" icon={<RefreshCw />} onClick={() => void loadUsers()}>
          {translate("admin.dataCleanup.refresh")}
        </UIButton>
      </div>
      <div className="rounded-2xl border border-line">
        <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-xs text-muted">
          <span>{translate("admin.dataCleanup.selectedOfTotal", { selected: pickedUsers.size, total: users?.total ?? 0 })}</span>
          {pickedUsers.size > 0 && (
            <button type="button" className="ml-auto text-indigo-600 hover:underline" onClick={() => setPickedUsers(new Map())}>
              {translate("admin.dataCleanup.clearSelection")}
            </button>
          )}
        </div>
        {users === null ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{translate("admin.dataCleanup.loading")}</p>
        ) : users.users.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{translate("admin.dataCleanup.noUsers")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {users.users.map((user) => (
              <li key={user.id}>
                <label className={`flex items-center gap-3 px-4 py-2.5 ${user.isYou ? "opacity-60" : "cursor-pointer hover:bg-surface-muted"}`}>
                  <Check
                    checked={pickedUsers.has(user.id)}
                    disabled={user.isYou}
                    label={user.email}
                    onChange={() =>
                      setPickedUsers((prev) => {
                        const next = new Map(prev);
                        if (next.has(user.id)) next.delete(user.id);
                        else next.set(user.id, user);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{user.displayName || user.email}</span>
                    <span className="block truncate text-xs text-muted">
                      {user.email}
                      {user.memberships.length > 0 &&
                        ` · ${user.memberships.map((m) => `${m.familyName || m.familyId} (${m.role})`).join(", ")}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {user.isYou && <UIBadge variant="info">{translate("admin.dataCleanup.you")}</UIBadge>}
                    {user.platformRole !== "none" && <UIBadge variant="neutral">{user.platformRole}</UIBadge>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {users && users.pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
            <UIButton variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
              {translate("admin.dataCleanup.previous")}
            </UIButton>
            <span>{translate("admin.dataCleanup.pageOf", { page: users.page, pages: users.pages })}</span>
            <UIButton variant="ghost" size="sm" disabled={page >= users.pages} onClick={() => setPage((n) => n + 1)}>
              {translate("admin.dataCleanup.next")}
            </UIButton>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <UISectionHeader
        title={translate("admin.dataCleanup.title")}
        subtitle={translate("admin.dataCleanup.subtitle")}
        icon={<Trash2 className="w-5 h-5 text-rose-600" />}
      />

      {summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["users", summary.users],
            ["families", summary.families],
            ["learners", summary.learners],
            ["events", summary.events],
            ["traceItems", summary.traceItems],
            ["traceCollections", summary.traceCollections],
            ["tracePaintings", summary.tracePaintings],
            ["libraryBooks", summary.libraryBooks],
          ].map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-line bg-surface p-3">
              <div className="text-lg font-semibold text-ink">{value}</div>
              <div className="text-xs text-muted">{translate(`admin.dataCleanup.stat.${key}`)}</div>
            </div>
          ))}
        </div>
      )}

      <UITabs items={tabs} value={tab} onChange={(value) => setTab(value as CleanupTab)} label={translate("admin.dataCleanup.title")} />

      {error && <div className={themeSystem.flash("error")}>{error}</div>}
      {notice && <div className={themeSystem.flash("success")}>{notice}</div>}

      {tab === "users" && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title={translate("admin.dataCleanup.usersTitle")}
            subtitle={translate("admin.dataCleanup.usersSubtitle")}
            icon={<UserX className="w-5 h-5 text-rose-600" />}
          />
          {userTable}
          <div className="flex flex-wrap gap-2">
            <UIButton variant="danger" size="sm" icon={<UserX />} disabled={busy || pickedUsers.size === 0} isLoading={busy} onClick={() => void deleteUsers()}>
              {translate("admin.dataCleanup.deleteSelectedUsers", { count: pickedUsers.size })}
            </UIButton>
            <UIButton variant="warning" size="sm" icon={<Eraser />} disabled={busy || pickedUsers.size === 0} onClick={clearXpFor}>
              {translate("admin.dataCleanup.clearXpSelected", { count: pickedUsers.size })}
            </UIButton>
          </div>
        </section>
      )}

      {tab === "xp" && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title={translate("admin.dataCleanup.xpTitle")}
            subtitle={translate("admin.dataCleanup.xpSubtitle")}
            icon={<Eraser className="w-5 h-5 text-rose-600" />}
          />
          {userTable}
          <div className="flex flex-wrap gap-2">
            <UIButton variant="warning" size="sm" icon={<Eraser />} disabled={busy || pickedUsers.size === 0} onClick={clearXpFor}>
              {translate("admin.dataCleanup.clearXpSelected", { count: pickedUsers.size })}
            </UIButton>
          </div>
          <DangerCard title={translate("admin.dataCleanup.clearAllXp")} body={translate("admin.dataCleanup.clearAllXpExplain")}>
            <UIButton variant="danger" size="sm" icon={<Eraser />} disabled={busy} onClick={clearAllXp}>
              {translate("admin.dataCleanup.clearAllXp")}
            </UIButton>
          </DangerCard>
        </section>
      )}

      {tab === "trace" && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <div className="flex items-start gap-2">
            <UISectionHeader
              title={translate("admin.dataCleanup.traceTitle")}
              subtitle={translate("admin.dataCleanup.traceSubtitle")}
              icon={<PenOff className="w-5 h-5 text-rose-600" />}
            />
            <UIButton variant="secondary" size="sm" icon={<RefreshCw />} className="ml-auto" onClick={() => void loadTrace()}>
              {translate("admin.dataCleanup.refresh")}
            </UIButton>
          </div>
          {traceItems === null || traceCollections === null ? (
            <p className="text-sm text-muted">{translate("admin.dataCleanup.loading")}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <PickList
                title={translate("admin.dataCleanup.collections")}
                empty={translate("admin.dataCleanup.noneLeft")}
                selected={pickedCollections}
                onSelected={setPickedCollections}
                rows={traceCollections.map((row) => ({
                  id: row.id,
                  title: row.title,
                  meta: `${row.id} · ${formatDate(row.updatedAt)}`,
                  badges: (
                    <>
                      {row.published && <UIBadge variant="success">{translate("admin.dataCleanup.published")}</UIBadge>}
                      {row.deleted && <UIBadge variant="neutral">{translate("admin.dataCleanup.inBin")}</UIBadge>}
                    </>
                  ),
                }))}
              />
              <PickList
                title={translate("admin.dataCleanup.items")}
                empty={translate("admin.dataCleanup.noneLeft")}
                selected={pickedItems}
                onSelected={setPickedItems}
                rows={traceItems.map((row) => ({
                  id: row.id,
                  title: row.title,
                  meta: `${row.id} · ${formatDate(row.updatedAt)}`,
                  badges: (
                    <>
                      {(row.paintings ?? 0) > 0 && (
                        <UIBadge variant="warning">{translate("admin.dataCleanup.nPaintings", { count: row.paintings ?? 0 })}</UIBadge>
                      )}
                      {row.deleted && <UIBadge variant="neutral">{translate("admin.dataCleanup.inBin")}</UIBadge>}
                    </>
                  ),
                }))}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <UIButton
              variant="danger"
              size="sm"
              icon={<Trash2 />}
              disabled={busy || pickedItems.size + pickedCollections.size === 0}
              onClick={() => deleteTrace("selected")}
            >
              {translate("admin.dataCleanup.deleteSelectedN", { count: pickedItems.size + pickedCollections.size })}
            </UIButton>
            <UIButton variant="secondary" size="sm" icon={<Trash2 />} disabled={busy} onClick={() => deleteTrace("bin")}>
              {translate("admin.dataCleanup.emptyBin")}
            </UIButton>
          </div>
          <DangerCard title={translate("admin.dataCleanup.deleteAllTrace")} body={translate("admin.dataCleanup.deleteAllTraceCard")}>
            <UIButton variant="danger" size="sm" icon={<PenOff />} disabled={busy} onClick={() => deleteTrace("all")}>
              {translate("admin.dataCleanup.deleteAllTrace")}
            </UIButton>
          </DangerCard>
        </section>
      )}

      {tab === "library" && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <div className="flex items-start gap-2">
            <UISectionHeader
              title={translate("admin.dataCleanup.libraryTitle")}
              subtitle={translate("admin.dataCleanup.librarySubtitle")}
              icon={<BookX className="w-5 h-5 text-rose-600" />}
            />
            <UIButton variant="secondary" size="sm" icon={<RefreshCw />} className="ml-auto" onClick={() => void loadLibrary()}>
              {translate("admin.dataCleanup.refresh")}
            </UIButton>
          </div>
          {books === null ? (
            <p className="text-sm text-muted">{translate("admin.dataCleanup.loading")}</p>
          ) : (
            <PickList
              title={translate("admin.dataCleanup.books")}
              empty={translate("admin.dataCleanup.noneLeft")}
              selected={pickedBooks}
              onSelected={setPickedBooks}
              rows={books.map((row) => ({
                id: row.id,
                title: row.title,
                meta: `${row.id} · rev ${row.rev} · ${formatDate(row.updatedAt)}`,
                badges: (
                  <>
                    {row.published && <UIBadge variant="success">{translate("admin.dataCleanup.published")}</UIBadge>}
                    {row.reports > 0 && (
                      <UIBadge variant="warning">{translate("admin.dataCleanup.nReports", { count: row.reports })}</UIBadge>
                    )}
                    {row.deleted && <UIBadge variant="neutral">{translate("admin.dataCleanup.inBin")}</UIBadge>}
                  </>
                ),
              }))}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <UIButton variant="danger" size="sm" icon={<Trash2 />} disabled={busy || pickedBooks.size === 0} onClick={() => deleteLibrary("selected")}>
              {translate("admin.dataCleanup.deleteSelectedN", { count: pickedBooks.size })}
            </UIButton>
            <UIButton variant="secondary" size="sm" icon={<Trash2 />} disabled={busy} onClick={() => deleteLibrary("bin")}>
              {translate("admin.dataCleanup.emptyBin")}
            </UIButton>
          </div>
          <DangerCard title={translate("admin.dataCleanup.deleteAllLibrary")} body={translate("admin.dataCleanup.deleteAllLibraryCard")}>
            <label className="flex w-full items-center gap-2 text-xs text-body">
              <Check
                checked={includeUnitVoices}
                onChange={() => setIncludeUnitVoices((v) => !v)}
                label={translate("admin.dataCleanup.includeUnitVoices", { count: summary?.libraryUnitVoices ?? 0 })}
              />
              {translate("admin.dataCleanup.includeUnitVoices", { count: summary?.libraryUnitVoices ?? 0 })}
            </label>
            <UIButton variant="danger" size="sm" icon={<BookX />} disabled={busy} onClick={() => deleteLibrary("all")}>
              {translate("admin.dataCleanup.deleteAllLibrary")}
            </UIButton>
          </DangerCard>
        </section>
      )}

      <UIModal
        isOpen={pending !== null}
        onClose={() => !busy && setPending(null)}
        title={pending?.title ?? ""}
        footer={
          <>
            <UIButton variant="secondary" disabled={busy} onClick={() => setPending(null)}>
              {translate("admin.dataCleanup.cancel")}
            </UIButton>
            <UIButton
              variant="danger"
              isLoading={busy}
              disabled={busy || (pending?.typed === true && typed.trim() !== CONFIRM_WORD)}
              onClick={() => void confirm()}
            >
              {pending?.confirmText}
            </UIButton>
          </>
        }
      >
        <div className="space-y-4">
          {pending?.body}
          <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{translate("admin.dataCleanup.cannotBeUndone")}</p>
          {pending?.typed && (
            <label className="block space-y-1">
              <span className="text-xs text-body">{translate("admin.dataCleanup.typeToConfirm", { word: CONFIRM_WORD })}</span>
              <input className={inputClass} value={typed} autoComplete="off" onChange={(event) => setTyped(event.target.value)} />
            </label>
          )}
        </div>
      </UIModal>
    </div>
  );
};
