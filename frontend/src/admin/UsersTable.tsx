/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  Ban,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  KeyRound,
  RotateCcw,
  Smile,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmModal,
  DataTable,
  type DataTableColumn,
  FormModal,
  Select,
} from "../components/ui";
import { adminApi, AdminStudent, AdminUser } from "../api/admin";
import { analyticsApi } from "../api/analytics";
import { ChildAnalyticsDrawer } from "../analytics/ChildAnalyticsDrawer";
import { KidAvatar } from "../components/KidAvatar";
import { AvatarPicker } from "../components/AvatarPicker";
import { KODA_KID_AVATARS } from "../components/LearnerPortrait";
import { inlineRemoteAvatar } from "../lib/avatar";

const roleBadge: Record<string, "default" | "secondary" | "success" | "warning"> = {
  admin: "warning",
  teacher: "default",
  parent: "success",
};

export const UsersTable: React.FC<{
  users: AdminUser[];
  students?: AdminStudent[];
  selfId?: string;
  onChanged: () => void;
}> = ({ users, students = [], selfId, onChanged }) => {
  // Search, Role filter, and Pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Track expanded parent rows
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<AdminStudent | null>(null);
  const [clearingLogsStudent, setClearingLogsStudent] = useState<AdminStudent | null>(null);

  // Avatar editing: which account is open in the picker, and the not-yet-saved choice.
  const [avatarUser, setAvatarUser] = useState<AdminUser | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<string>(KODA_KID_AVATARS[0]);

  const toggleExpand = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: prev[parentId] === undefined ? false : !prev[parentId],
    }));
  };

  const toggleDisabled = async (u: AdminUser) => {
    try {
      await adminApi.setDisabled(u.id, !u.disabled);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    }
  };

  const openAvatarPicker = (u: AdminUser) => {
    setPendingAvatar(u.avatar || KODA_KID_AVATARS[0]);
    setAvatarUser(u);
  };

  const saveAvatar = async () => {
    if (!avatarUser) return;
    await adminApi.setAvatar(avatarUser.id, await inlineRemoteAvatar(pendingAvatar));
    onChanged();
  };

  const removeUser = async (u: AdminUser) => {
    try {
      await adminApi.deleteUser(u.id);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
      throw e;
    }
  };

  const resetStudentPin = async (s: AdminStudent) => {
    const pin = window.prompt(`New PIN for ${s.name} (4–8 digits)`);
    if (!pin) return;
    if (!/^\d{4,8}$/.test(pin)) {
      alert("PIN must be 4–8 digits.");
      return;
    }
    try {
      await adminApi.resetPin(s.id, pin);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reset failed");
    }
  };

  const filteredUsers = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    return list.filter((u) => {
      if (!u) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = u.name?.toLowerCase().includes(q) ?? false;
        const matchesEmail = u.email?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesEmail) return false;
      }
      return true;
    });
  }, [users, roleFilter, searchQuery]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: "name",
      header: "Account / Child Name",
      cell: (u) => {
        const parentKids = students.filter(
          (s) => s.guardian_parent_ids?.includes(u.id) || s.guardians.includes(u.name)
        );
        const isExpanded = expandedParents[u.id] ?? true;

        return (
          <div className="flex items-center gap-2">
            {u.role === "parent" && parentKids.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(u.id);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}

            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-xs font-black text-violet-700 dark:text-violet-300 shrink-0 overflow-hidden p-0.5 shadow-2xs">
              {u.avatar ? (
                <KidAvatar avatar={u.avatar} className="h-full w-full object-contain flex items-center justify-center" />
              ) : (
                <span>{u.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="font-bold text-slate-800 dark:text-white">{u.name}</span>
            {u.disabled && <span className="text-[10px] font-extrabold text-rose-500 uppercase">disabled</span>}
          </div>
        );
      },
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => <Badge variant={roleBadge[u.role] ?? "secondary"}>{u.role}</Badge>,
    },
    {
      key: "email",
      header: "Email / Guardian",
      className: "hidden sm:table-cell",
      cell: (u) => <span className="text-slate-500 dark:text-slate-400 font-medium">{u.email}</span>,
    },
    {
      key: "kids",
      header: "Kids / PIN",
      cell: (u) => {
        const parentKids = students.filter(
          (s) => s.guardian_parent_ids?.includes(u.id) || s.guardians.includes(u.name)
        );
        return u.role === "parent" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            {parentKids.length} {parentKids.length === 1 ? "child" : "children"}
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (u) => {
        const isSelf = u.id === selfId;
        return (
          <div className="flex items-center justify-end gap-1">
            {/* Avatar is editable on every row, including your own account. */}
            <Button variant="ghost" size="xs" onClick={() => openAvatarPicker(u)}>
              <Smile size={12} /> Avatar
            </Button>
            {isSelf ? (
              <span className="text-[10px] text-slate-400 font-mono">you</span>
            ) : (
              <>
                <Button variant="ghost" size="xs" onClick={() => toggleDisabled(u)}>
                  {u.disabled ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                  {u.disabled ? "Enable" : "Disable"}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setDeletingUser(u)}
                  className="text-slate-400 hover:text-rose-600"
                  aria-label={`Delete ${u.name}`}
                  title={`Delete ${u.name}`}
                >
                  <Trash2 size={12} />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        data={paginatedUsers}
        columns={columns}
        getRowKey={(u) => u.id}
        searchable
        searchPlaceholder="Search accounts by name or email..."
        searchValue={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setPage(1);
        }}
        filterControls={
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 text-xs font-bold border-2 border-slate-200 dark:border-white/15"
          >
            <option value="all">All Roles</option>
            <option value="parent">Parents</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Admins</option>
          </Select>
        }
        pagination
        page={page}
        pageSize={pageSize}
        totalItems={filteredUsers.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        emptyText="No matching accounts found."
        renderExpandedRow={(u) => {
          const parentKids = students.filter(
            (s) => s.guardian_parent_ids?.includes(u.id) || s.guardians.includes(u.name)
          );
          const isExpanded = expandedParents[u.id] ?? true;

          if (u.role !== "parent" || !isExpanded || parentKids.length === 0) return null;

          return parentKids.map((kid) => (
            <tr
              key={`kid-${kid.id}`}
              className="border-b border-slate-50 bg-[#FBFAFF] dark:bg-white/[0.02] hover:bg-[#F3F0FF]/60 dark:hover:bg-white/5 transition-colors"
            >
              <td className="px-4 py-2.5 align-middle">
                <div className="pl-7 flex items-center gap-2">
                  <CornerDownRight size={13} className="text-indigo-400 shrink-0" />
                  <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center p-0.5 shrink-0 overflow-hidden shadow-2xs">
                    <KidAvatar avatar={kid.avatar ?? undefined} className="h-full w-full object-contain flex items-center justify-center" />
                  </div>
                  <span className="font-extrabold text-slate-700 dark:text-slate-200 text-xs">{kid.name}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 align-middle">
                <span className="inline-flex items-center rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                  Student
                </span>
              </td>
              <td className="px-4 py-2.5 align-middle text-slate-400 dark:text-slate-400 hidden sm:table-cell text-xs italic font-medium">
                Child of {u.name}
              </td>
              <td className="px-4 py-2.5 align-middle text-xs font-bold text-slate-500 dark:text-slate-400">
                {kid.has_pin ? (
                  <span className="text-emerald-600 dark:text-emerald-400">PIN Set</span>
                ) : (
                  <span className="text-slate-400">No PIN</span>
                )}
              </td>
              <td className="px-4 py-2.5 align-middle text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="xs" onClick={() => setSelectedStudent(kid)} className="text-xs">
                    <BarChart3 size={12} /> Progress
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => resetStudentPin(kid)} className="text-xs">
                    <KeyRound size={12} /> Reset PIN
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setClearingLogsStudent(kid)}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-xs"
                  >
                    <RotateCcw size={12} /> Clear logs
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setDeletingStudent(kid)}
                    className="text-slate-400 hover:text-rose-600 text-xs"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </td>
            </tr>
          ));
        }}
      />

      <ChildAnalyticsDrawer student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      <FormModal
        isOpen={Boolean(avatarUser)}
        onClose={() => setAvatarUser(null)}
        title={`Avatar for ${avatarUser?.name ?? ""}`}
        description="Pick the profile artwork shown in this listing and across the app."
        submitLabel="Save avatar"
        onSubmit={saveAvatar}
        maxWidthClassName="max-w-lg"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-200 bg-violet-100 p-1.5 dark:border-violet-500/30 dark:bg-violet-500/20">
            <KidAvatar avatar={pendingAvatar} className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-800 dark:text-white">{avatarUser?.name}</p>
            <p className="truncate text-[11px] font-bold text-slate-400">{avatarUser?.email}</p>
          </div>
        </div>
        <AvatarPicker value={pendingAvatar} onChange={setPendingAvatar} />
      </FormModal>
      <ConfirmModal
        isOpen={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        onConfirm={() => (deletingUser ? removeUser(deletingUser) : Promise.resolve())}
        title={`Delete ${deletingUser?.name ?? "this account"}?`}
        description={
          deletingUser
            ? deletingUser.role === "parent" && deletingUser.child_count > 0
              ? `This permanently deletes the account for ${deletingUser.email}. Its ${deletingUser.child_count} linked learner ${deletingUser.child_count === 1 ? "profile" : "profiles"} will also be deleted unless another guardian is linked. This action cannot be undone.`
              : `This permanently deletes the account for ${deletingUser.email}. This action cannot be undone.`
            : undefined
        }
        confirmText="Delete account"
        cancelText="Cancel"
        variant="danger"
      />
      <ConfirmModal
        isOpen={Boolean(clearingLogsStudent)}
        onClose={() => setClearingLogsStudent(null)}
        onConfirm={async () => {
          if (clearingLogsStudent) {
            try {
              await analyticsApi.purgeData(clearingLogsStudent.id, "Admin log reset for testing");
              onChanged();
            } catch (e) {
              alert(e instanceof Error ? e.message : "Clear logs failed");
            }
          }
        }}
        title={`Clear logs for ${clearingLogsStudent?.name}?`}
        description="This will reset all learning events, attempts, XP, and mastery data so you can test fresh."
        confirmText="Clear logs"
        cancelText="Cancel"
        variant="warning"
      />
      <ConfirmModal
        isOpen={Boolean(deletingStudent)}
        onClose={() => setDeletingStudent(null)}
        onConfirm={async () => {
          if (deletingStudent) {
            try {
              await adminApi.deleteStudent(deletingStudent.id);
              onChanged();
            } catch (e) {
              alert(e instanceof Error ? e.message : "Delete failed");
            }
          }
        }}
        title={`Delete ${deletingStudent?.name}?`}
        description="This deletes their profile and learning progress."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
};
