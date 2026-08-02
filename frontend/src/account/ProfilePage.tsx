import React, { useState } from "react";
import { Check, CheckCircle2, Copy, KeyRound, Lock, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { authApi } from "../api/auth";
import { Button, FormField, Input, SectionCard, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui";
import { AvatarPicker } from "../components/AvatarPicker";
import { KidAvatar } from "../components/KidAvatar";
import { inlineRemoteAvatar } from "../lib/avatar";

/**
 * Self-service profile for any adult account. Admins, teachers, and parents are all
 * the same User document, edited through the same PATCH /auth/profile, so one screen
 * serves every role — the family code block simply hides for accounts without one.
 */
export const ProfilePage: React.FC = () => {
  const { account, refreshSession } = useAuth();

  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [avatar, setAvatar] = useState(account?.avatar ?? "koda-kid:boy-sky");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Panels unmount when inactive, but every field is controlled from this component's
  // state, so switching tabs keeps edits and one Save submits both panels together.
  const [tab, setTab] = useState<"profile" | "security">("profile");

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
    <div className="flex w-full flex-col gap-5">
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <Tabs value={tab} onValueChange={value => setTab(value as "profile" | "security")} variant="underline">
          <TabsList aria-label="Profile sections">
            <TabsTrigger value="profile"><UserIcon size={14} /> My Profile</TabsTrigger>
            <TabsTrigger value="security"><Lock size={14} /> Security & password</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="grid gap-4 pt-4 lg:grid-cols-2">
            <SectionCard title="Profile avatar" className="h-full min-w-0" bodyClassName="p-5">
              <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-indigo-50 p-1.5 dark:bg-violet-500/20">
                <KidAvatar avatar={avatar} className="h-full w-full object-contain" />
              </span>

              <div className="mt-4">
                <AvatarPicker value={avatar} onChange={setAvatar} />
              </div>
            </SectionCard>

            <SectionCard title="Account details" className="h-full min-w-0" bodyClassName="space-y-4 p-5">
              <FormField label="Full name">
                <Input
                  required
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Your name"
                />
              </FormField>

              <FormField label="Email address">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </FormField>

              {account?.family_code && (
                <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-[#E2E0F2]">
                        <ShieldCheck size={14} className="text-indigo-500 dark:text-[#BDA9FF]" /> Family sign-in code
                      </span>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-[#9A94B8]">
                        Kids use this code along with their name &amp; PIN to log in.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="xs" onClick={handleCopyCode} className="font-mono">
                      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{account.family_code}</span>
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="security" className="pt-4">
            <SectionCard
              title={
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-[#E2E0F2]">
                  <KeyRound size={14} className="text-indigo-500 dark:text-[#BDA9FF]" /> Security &amp; password
                </h3>
              }
              bodyClassName="space-y-4 p-5"
            >
              <p className="text-xs text-slate-500 dark:text-[#9A94B8]">
                Leave blank if you don’t want to change your password.
              </p>

              <FormField label="Current password">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                  placeholder="Enter current password"
                />
              </FormField>

              <FormField label="New password" hint="Minimum 8 characters">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                />
              </FormField>
            </SectionCard>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} loadingText="Saving…">
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
