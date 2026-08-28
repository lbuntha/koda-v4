import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { ApiError, accessToken, request, usePermissions } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import {
  UIBadge,
  UIButton,
  UIDataTable,
  type UIDataTableColumn,
  UIDialog,
  UIModal,
  UISectionHeader,
} from "../ui";

interface PlatformRoleRecord {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  builtIn: boolean;
  usersCount: number;
}

interface RolesResponse {
  roles: PlatformRoleRecord[];
  availablePermissions: string[];
}

interface RoleDraft {
  id?: string;
  name: string;
  description: string;
  permissions: string[];
}

const emptyDraft = (): RoleDraft => ({ name: "", description: "", permissions: [] });
const fieldClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";

const permissionLabel = (permission: string): string =>
  permission
    .replaceAll("_", " ")
    .replace(":", " · ")
    .replace(/^./, (letter) => letter.toUpperCase());

export const PlatformRolesPanel: React.FC = () => {
  const { can } = usePermissions();
  const allowed = can("role:manage");
  const [data, setData] = useState<RolesResponse | null>(null);
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const [deleting, setDeleting] = useState<PlatformRoleRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const token = await accessToken();
    setData(await request<RolesResponse>("/admin/roles", { token }));
  };

  useEffect(() => {
    if (!allowed) return;
    void load().catch((reason: ApiError) => setError(reason.message));
  }, [allowed]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const token = await accessToken();
      await request(draft.id ? `/admin/roles/${draft.id}` : "/admin/roles", {
        method: draft.id ? "PATCH" : "POST",
        token,
        body: {
          name: draft.name,
          description: draft.description,
          permissions: draft.permissions,
        },
      });
      setDraft(null);
      setNotice(draft.id ? "Platform role updated." : "Platform role created.");
      await load();
    } catch (reason) {
      setError((reason as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (role: PlatformRoleRecord) => {
    setBusy(true);
    setError(null);
    try {
      const token = await accessToken();
      await request(`/admin/roles/${role.id}`, { method: "DELETE", token });
      setDeleting(null);
      setNotice("Platform role deleted.");
      await load();
    } catch (reason) {
      setError((reason as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    const permissions = data?.availablePermissions ?? [];
    return [...new Set(permissions.map((permission) => permission.split(":")[0]))].map(
      (group) => ({ group, permissions: permissions.filter((item) => item.startsWith(`${group}:`)) }),
    );
  }, [data]);

  const columns = useMemo<UIDataTableColumn<PlatformRoleRecord>[]>(() => [
    {
      key: "role",
      header: "Role",
      sortValue: (role) => role.name,
      render: (role) => <div className="min-w-[12rem]"><div className="flex items-center gap-2"><span className="koda-admin-card-title">{role.name}</span>{role.builtIn && <UIBadge variant="neutral">Built-in</UIBadge>}</div><p className="koda-admin-label mt-0.5">{role.description}</p></div>,
    },
    {
      key: "permissions",
      header: "Permissions",
      sortValue: (role) => role.permissions.length,
      render: (role) => <div className="flex max-w-md flex-wrap gap-1">{role.permissions.slice(0, 5).map((permission) => <UIBadge key={permission} variant="info" className="koda-admin-chip">{permissionLabel(permission)}</UIBadge>)}{role.permissions.length > 5 && <UIBadge variant="neutral">+{role.permissions.length - 5}</UIBadge>}{role.permissions.length === 0 && <span className="text-muted">No permissions</span>}</div>,
    },
    {
      key: "users",
      header: "Users",
      sortValue: (role) => role.usersCount,
      render: (role) => role.usersCount,
      numeric: true,
      align: "right",
    },
    {
      key: "actions",
      header: "Actions",
      render: (role) => role.builtIn ? <span className="text-xs text-muted">Protected</span> : <div className="flex justify-end gap-1.5"><UIButton variant="ghost" size="sm" icon={<Pencil />} onClick={() => setDraft({ id: role.id, name: role.name, description: role.description, permissions: [...role.permissions] })}>Edit</UIButton><UIButton variant="danger" size="sm" icon={<Trash2 />} disabled={role.usersCount > 0} onClick={() => setDeleting(role)}>Delete</UIButton></div>,
      align: "right",
      nowrap: true,
    },
  ], []);

  if (!allowed) return null;

  const togglePermission = (permission: string) => {
    if (!draft) return;
    const selected = new Set(draft.permissions);
    if (selected.has(permission)) selected.delete(permission);
    else selected.add(permission);
    setDraft({ ...draft, permissions: [...selected].sort() });
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <UISectionHeader title="Platform roles" subtitle="Admin, Developer, Support, and custom service-wide roles" icon={<ShieldCheck className="h-5 w-5 text-indigo-600" />} />
        <UIButton variant="primary" size="sm" icon={<Plus />} onClick={() => setDraft(emptyDraft())}>Add role</UIButton>
      </div>
      {error && <p className={themeSystem.flash("error")}>{error}</p>}
      {notice && <p className={themeSystem.flash("success")}>{notice}</p>}
      {!data ? <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-surface-muted" />)}</div> : <UIDataTable columns={columns} rows={data.roles} rowKey={(role) => role.id} defaultSort={{ key: "role", direction: "asc" }} emptyMessage="No platform roles yet." caption="Platform roles" />}

      <UIModal isOpen={Boolean(draft)} onClose={() => setDraft(null)} title={draft?.id ? "Edit platform role" : "Add platform role"} maxWidth="max-w-3xl" footer={<><UIButton variant="secondary" onClick={() => setDraft(null)}>Cancel</UIButton><UIButton variant="primary" isLoading={busy} disabled={!draft?.name.trim()} onClick={() => void save()}>Save role</UIButton></>}>
        {draft && <div className="space-y-5"><label className="block space-y-1.5"><span className="koda-admin-label text-ink">Role name</span><input className={fieldClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="For example: Content Manager" /></label><label className="block space-y-1.5"><span className="koda-admin-label text-ink">Description</span><textarea className={`${fieldClass} min-h-20 resize-y`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What this role is responsible for" /></label><div><div className="flex items-center justify-between gap-3"><h4 className="koda-admin-section-title">Permissions</h4><UIBadge variant="primary">{draft.permissions.length} selected</UIBadge></div><div className="mt-3 grid gap-4 md:grid-cols-2">{groups.map(({ group, permissions }) => <fieldset key={group} className="rounded-xl border border-line bg-surface-muted p-3"><legend className="koda-admin-card-title capitalize px-1">{group.replaceAll("_", " ")}</legend><div className="mt-1 space-y-1.5">{permissions.map((permission) => <label key={permission} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 hover:bg-surface"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={draft.permissions.includes(permission)} onChange={() => togglePermission(permission)} /><span className="text-sm text-body">{permissionLabel(permission)}</span></label>)}</div></fieldset>)}</div></div></div>}
      </UIModal>

      <UIDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete platform role?" description={`${deleting?.name ?? "This role"} will be removed. Assigned users must be moved first.`} confirmText="Delete role" variant="danger" onConfirm={() => { if (deleting) void remove(deleting); }} />
    </section>
  );
};
