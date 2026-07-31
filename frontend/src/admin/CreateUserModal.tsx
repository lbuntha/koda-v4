/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin-only: create a user with any defined role (built-in or custom).
 */

import React, { useEffect, useState } from "react";
import { Input, Select, FormModal, FormField } from "../components/ui";
import { adminApi } from "../api/admin";
import { menusApi, RoleDef } from "../api/menus";
import { AvatarPicker } from "../parent/AvatarPicker";
import { KidAvatar } from "../components/KidAvatar";
import { KODA_KID_AVATARS } from "../parent/onboarding/LearnerPortrait";
import { inlineRemoteAvatar } from "../lib/avatar";

export const CreateUserModal: React.FC<{ isOpen: boolean; onClose: () => void; onCreated: () => void }> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [role, setRole] = useState("teacher");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<string>(KODA_KID_AVATARS[0]);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setEmail("");
    setPassword("");
    setAvatar(KODA_KID_AVATARS[0]);
    menusApi.listRoles().then((r) => {
      setRoles(r);
      const first = r.find((x) => x.key !== "student") ?? r[0];
      if (first) setRole(first.key);
    });
  }, [isOpen]);

  const submit = async () => {
    await adminApi.createUser({
      role,
      name: name.trim(),
      email: email.trim(),
      password,
      avatar: await inlineRemoteAvatar(avatar),
    });
    onCreated();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="New account"
      submitLabel="Create"
      onSubmit={submit}
      maxWidthClassName="max-w-lg"
    >
      <FormField label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="capitalize">
          {roles
            .filter((r) => r.key !== "student")
            .map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
        </Select>
      </FormField>
      <FormField label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </FormField>
      <FormField label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </FormField>
      <FormField label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      </FormField>
      <FormField label="Avatar">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-200 bg-violet-100 p-1 dark:border-violet-500/30 dark:bg-violet-500/20">
            <KidAvatar avatar={avatar} className="h-full w-full object-contain" />
          </span>
          <AvatarPicker value={avatar} onChange={setAvatar} className="min-w-0 flex-1" />
        </div>
      </FormField>
    </FormModal>
  );
};
