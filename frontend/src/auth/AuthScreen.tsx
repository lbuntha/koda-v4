/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-screen login / sign-up. Two audiences:
 *   • Grown-ups (parent / teacher) — email + password, sign in or create account.
 *   • Kids — family code + name + PIN (accounts are created by a parent).
 *
 * On success the AuthContext flips to "authenticated" and RoleRouter swaps this
 * screen for the right console, so there's no navigation to manage here.
 */

import React, { useState } from "react";
import { Crown, Mail, Lock, User, KeyRound, Hash, Loader2, ArrowRight } from "lucide-react";
import { Button, Input, Label } from "../components/ui";
import { useAuth } from "./AuthContext";

type Audience = "adult" | "kid";
type AdultMode = "signin" | "signup";
type AdultRole = "parent" | "teacher";

const Segmented = <T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) => (
  <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
          value === o.value
            ? "bg-white text-indigo-600 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const Field = ({
  icon: Icon,
  label,
  ...props
}: { icon: React.ElementType; label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <div className="relative">
      <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <Input className="pl-10" {...props} />
    </div>
  </div>
);

export const AuthScreen: React.FC = () => {
  const { login, registerAdult, studentLogin } = useAuth();

  const [audience, setAudience] = useState<Audience>("adult");
  const [mode, setMode] = useState<AdultMode>("signin");
  const [role, setRole] = useState<AdultRole>("parent");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [kidName, setKidName] = useState("");
  const [pin, setPin] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");
      setBusy(false); // stay on screen; on success this component unmounts
    }
  }

  const onAdultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") run(() => login(email.trim(), password));
    else run(() => registerAdult({ role, name: name.trim(), email: email.trim(), password }));
  };

  const onKidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => studentLogin(familyCode.trim().toUpperCase(), kidName.trim(), pin.trim()));
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 mb-3">
            <Crown size={26} />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Learn with Koda</h1>
          <p className="text-sm text-slate-500 mt-0.5">Counting Skills Studio</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-7">
          <Segmented<Audience>
            value={audience}
            onChange={(v) => {
              setAudience(v);
              setError(null);
            }}
            options={[
              { value: "adult", label: "I'm a grown-up" },
              { value: "kid", label: "I'm a kid" },
            ]}
          />

          {audience === "adult" ? (
            <form onSubmit={onAdultSubmit} className="mt-5 space-y-4">
              <Segmented<AdultMode>
                value={mode}
                onChange={(v) => {
                  setMode(v);
                  setError(null);
                }}
                options={[
                  { value: "signin", label: "Sign in" },
                  { value: "signup", label: "Create account" },
                ]}
              />

              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label>I am a…</Label>
                    <Segmented<AdultRole>
                      value={role}
                      onChange={setRole}
                      options={[
                        { value: "parent", label: "Parent" },
                        { value: "teacher", label: "Teacher" },
                      ]}
                    />
                  </div>
                  <Field
                    icon={User}
                    label="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    required
                  />
                </>
              )}

              <Field
                icon={Mail}
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <Field
                icon={Lock}
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />

              {error && <ErrorNote message={error} />}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <>
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight size={16} />
                </>}
              </Button>
            </form>
          ) : (
            <form onSubmit={onKidSubmit} className="mt-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Ask a grown-up for your <b>family code</b>, then type your name and secret PIN.
              </p>
              <Field
                icon={Hash}
                label="Family code"
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                maxLength={6}
                required
              />
              <Field
                icon={User}
                label="Your name"
                value={kidName}
                onChange={(e) => setKidName(e.target.value)}
                placeholder="Ada"
                required
              />
              <Field
                icon={KeyRound}
                label="Secret PIN"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                maxLength={8}
                required
              />

              {error && <ErrorNote message={error} />}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <>Let's go!<ArrowRight size={16} /></>}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          Early-math counting practice · signed in accounts keep your progress
        </p>
      </div>
    </div>
  );
};

const ErrorNote = ({ message }: { message: string }) => (
  <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
    {message}
  </div>
);
