/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Add or edit a kid: name, avatar, and an optional PIN. On edit, leaving the PIN
 * blank keeps the existing one.
 */

import React, { useEffect, useState } from "react";
import { Input, FormModal, FormField } from "../components/ui";
import { AvatarPicker, AVATARS } from "./AvatarPicker";
import { Child, ChildInput } from "../api/family";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ChildInput) => Promise<void>;
  initial?: Child | null;
}

export const ChildFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, initial }) => {
  const editing = !!initial;
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName(initial?.name ?? "");
    setAvatar(initial?.avatar ?? AVATARS[0]);
    setPin("");
  }, [isOpen, initial]);

  const submit = async () => {
    if (pin && !/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits.");
    const data: ChildInput = { name: name.trim(), avatar };
    if (pin.trim()) data.pin = pin.trim();
    await onSubmit(data);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit child" : "Add a child"}
      submitLabel={editing ? "Save" : "Add child"}
      onSubmit={submit}
    >
      <FormField label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada" required autoFocus />
      </FormField>
      <FormField label="Avatar">
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </FormField>
      <FormField
        label={editing ? "New PIN (optional)" : "PIN (optional)"}
        hint="A PIN lets your child sign in on their own device."
      >
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={editing ? "Leave blank to keep current" : "4–8 digits"}
          maxLength={8}
        />
      </FormField>
    </FormModal>
  );
};
