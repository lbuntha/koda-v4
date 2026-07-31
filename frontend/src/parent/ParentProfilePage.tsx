import React, { useState } from "react";
import { Check, CheckCircle2, Copy, KeyRound, Lock, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { authApi } from "../api/auth";
import { Button, Card, FormField, Input } from "../components/ui";
import { AvatarPicker } from "./AvatarPicker";
import { KidAvatar } from "../components/KidAvatar";
import { inlineRemoteAvatar } from "../lib/avatar";

export const ParentProfilePage: React.FC = () => {
  const { account, refreshSession } = useAuth();

  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [avatar, setAvatar] = useState(account?.avatar ?? "koda-kid:boy-sky");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (account?.family_code) {
      void navigator.clipboard.writeText(account.family_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await authApi.updateProfile({
        name: name !== account?.name ? name : undefined,
        email: email !== account?.email ? email : undefined,
        avatar: await inlineRemoteAvatar(avatar),
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });
      await refreshSession();
      setSuccess("Profile updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-black text-[#27334A] dark:text-white">Parent Profile</h1>
        <p className="mt-0.5 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">
          Update your profile details, avatar, and security settings.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-extrabold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-xs font-extrabold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Avatar Selection Card */}
        <Card className="rounded-3xl border-0 bg-white p-5 shadow-[0_12px_34px_-24px_rgba(39,51,74,0.5)] dark:bg-white/[0.045]">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F0EBFF] p-1.5 ring-4 ring-[#EEE9FF] dark:bg-violet-500/20 dark:ring-violet-500/20">
              <KidAvatar avatar={avatar} className="h-full w-full object-contain" />
            </span>
            <div>
              <h2 className="text-sm font-black text-[#27334A] dark:text-white">Choose your avatar</h2>
              <p className="mt-0.5 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">
                Select a profile avatar from the complete collection.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
        </Card>

        {/* Account Details Card */}
        <Card className="rounded-3xl border-0 bg-white p-5 shadow-[0_12px_34px_-24px_rgba(39,51,74,0.5)] dark:bg-white/[0.045]">
          <h2 className="text-sm font-black text-[#27334A] dark:text-white">Account Details</h2>
          <p className="mt-0.5 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">Update your name and email address.</p>

          <div className="mt-4 space-y-4">
            <FormField label="Full Name">
              <Input
                required
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Your name"
                className="h-11 rounded-xl text-sm font-bold"
              />
            </FormField>

            <FormField label="Email Address">
              <Input
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="h-11 rounded-xl text-sm font-bold"
              />
            </FormField>

            {account?.family_code && (
              <div className="rounded-2xl bg-[#F6F4FF] p-4 dark:bg-violet-500/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-black text-[#6844EA] dark:text-[#CDBEFF]">
                      <ShieldCheck size={14} /> Family Sign-In Code
                    </span>
                    <p className="mt-0.5 text-[11px] font-bold text-[#8792A5] dark:text-[#8F99AD]">
                      Kids use this code along with their name & PIN to log in.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleCopyCode}
                    className="font-mono text-xs font-black"
                  >
                    {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{account.family_code}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Change Password Card */}
        <Card className="rounded-3xl border-0 bg-white p-5 shadow-[0_12px_34px_-24px_rgba(39,51,74,0.5)] dark:bg-white/[0.045]">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-[#6844EA] dark:text-[#CDBEFF]" />
            <h2 className="text-sm font-black text-[#27334A] dark:text-white">Security & Password</h2>
          </div>
          <p className="mt-0.5 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">
            Leave blank if you don’t want to change your password.
          </p>

          <div className="mt-4 space-y-4">
            <FormField label="Current Password">
              <Input
                type="password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                placeholder="Enter current password"
                className="h-11 rounded-xl text-sm font-bold"
              />
            </FormField>

            <FormField label="New Password" hint="Minimum 8 characters">
              <Input
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                placeholder="Enter new password"
                className="h-11 rounded-xl text-sm font-bold"
              />
            </FormField>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            loading={saving}
            loadingText="Saving profile..."
            className="h-11 rounded-2xl bg-[#6844EA] px-6 text-xs font-black text-white hover:bg-[#5736DC] shadow-md shadow-indigo-500/20"
          >
            Save Profile Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
