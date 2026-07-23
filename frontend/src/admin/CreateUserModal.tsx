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

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setEmail("");
    setPassword("");
    menusApi.listRoles().then((r) => {
      setRoles(r);
      const first = r.find((x) => x.key !== "student") ?? r[0];
      if (first) setRole(first.key);
    });
  }, [isOpen]);

  const submit = async () => {
    await adminApi.createUser({ role, name: name.trim(), email: email.trim(), password });
    onCreated();
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title="New account" submitLabel="Create" onSubmit={submit}>
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
    </FormModal>
  );
};
