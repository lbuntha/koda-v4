import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { Button, Card, Input, Label } from "../components/ui";
import { useThemeMode } from "../theme/appTheme";
import { useAuth } from "./AuthContext";

type Audience = "adult" | "kid";
export type AdultMode = "signin" | "signup";
type AdultRole = "parent" | "teacher";

interface AuthScreenProps {
  onBack?: () => void;
  /** Opens password recovery. Only meaningful on the sign-in tab. */
  onForgotPassword?: () => void;
  initialMode?: AdultMode;
}

const Segment = <T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) => (
  <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">
    {options.map((option) => (
      <Button
        key={option.value}
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(option.value)}
        className={`flex-1 ${value === option.value ? "bg-white text-indigo-600 shadow-sm hover:bg-white dark:bg-white/10 dark:text-indigo-200 dark:hover:bg-white/10" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"}`}
      >
        {option.label}
      </Button>
    ))}
  </div>
);

const Field = ({ icon: Icon, label, trailing, className = "", ...props }: {
  icon: React.ElementType;
  label: string;
  trailing?: React.ReactNode;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <div className="relative">
      <Icon size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input className={`h-11 pl-11 pr-11 ${className}`} {...props} />
      {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
    </div>
  </div>
);

const BENEFITS = [
  { icon: Sparkles, label: "Personalized activities for every child", tone: "bg-violet-500" },
  { icon: BarChart3, label: "Clear progress for parents", tone: "bg-emerald-500" },
  { icon: ShieldCheck, label: "Protected family and learner access", tone: "bg-rose-500" },
] as const;

export const AuthScreen: React.FC<AuthScreenProps> = ({ onBack, onForgotPassword, initialMode = "signin" }) => {
  const { login, registerAdult, studentLogin } = useAuth();
  const [theme, toggleTheme] = useThemeMode();
  const [audience, setAudience] = useState<Audience>("adult");
  const [mode, setMode] = useState<AdultMode>(initialMode);
  const [role, setRole] = useState<AdultRole>("parent");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const switchAdultMode = (nextMode: AdultMode) => {
    setAudience("adult");
    setMode(nextMode);
    setError(null);
  };

  const onAdultSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "signin") void run(() => login(email.trim(), password));
    else void run(() => registerAdult({ role, name: name.trim(), email: email.trim(), password }));
  };

  const onKidSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(() => studentLogin(familyCode.trim().toUpperCase(), kidName.trim(), pin.trim()));
  };

  const adultTitle = mode === "signup" ? "Create your family account" : "Welcome back";
  const adultSubtitle = mode === "signup" ? "Add a learner profile after you sign up." : "Sign in to continue learning with Koda.";

  return (
    <div className={`min-h-screen bg-[#FCFBFF] px-4 py-3 font-sans text-slate-900 transition-colors dark:bg-[#080B18] dark:text-white sm:px-6 ${theme === "dark" ? "dark" : ""}`}>
      <header className="mx-auto flex max-w-6xl items-center justify-between py-1.5 sm:py-2">
        <button type="button" onClick={onBack} className="flex items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30">
          <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-black tracking-tight text-slate-950 dark:text-white">Koda</span>
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"} className="h-9 w-9 text-slate-500 dark:text-slate-300 dark:hover:bg-white/10">
            {theme === "dark" ? <Sun size={17} className="text-amber-300" /> : <Moon size={17} />}
          </Button>
          <span className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">{mode === "signup" ? "Already have an account?" : "New to Koda?"}</span>
          <Button variant="outline" size="sm" onClick={() => switchAdultMode(mode === "signup" ? "signin" : "signup")} className="border-indigo-200 text-indigo-600 dark:border-indigo-400/30 dark:bg-white/5 dark:text-indigo-200">
            {mode === "signup" ? "Sign in" : "Create account"}
          </Button>
        </div>
      </header>

      <main className="mx-auto mt-2 grid min-h-[calc(100vh-72px)] max-w-6xl items-start gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <section className="relative hidden h-[540px] overflow-hidden rounded-[1.5rem] bg-violet-100 p-7 dark:bg-[#11172B] lg:block">
          <img
            src={theme === "dark" ? "/assets/koda-auth-learning-dark.png" : "/assets/koda-auth-learning-light.png"}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-transparent dark:from-black/10" />
          <div className="relative z-10 max-w-md">
            <h1 className="text-3xl font-black leading-[1.08] tracking-tight text-[#0E0B55] dark:text-white">Start their<br />learning adventure.</h1>
            <p className="mt-2.5 max-w-sm text-xs font-medium leading-relaxed text-[#6551A3] dark:text-slate-300">Create one account, add your learners, and help every child grow through purposeful play.</p>
            <div className="mt-5 space-y-2.5">
              {BENEFITS.map(({ icon: Icon, label, tone }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${tone}`}><Icon size={17} /></span>
                  <span className="max-w-[210px] text-xs font-semibold text-[#17143D] dark:text-slate-100">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Card className="flex w-full max-w-[520px] justify-self-center flex-col border-0 bg-white shadow-[0_12px_42px_rgba(62,49,126,0.08)] dark:border-0 dark:bg-[#11172B] lg:min-h-[540px]">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start px-5 py-5 sm:px-7 lg:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-violet-100 dark:bg-violet-400/10">
                <img src="/assets/koda-bear-face.png" alt="" className="h-full w-full object-cover" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-[#0E0B55] dark:text-white">{audience === "kid" ? "Sign in with your family code" : adultTitle}</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{audience === "kid" ? "Ask your grown-up for the code, your profile name, and PIN." : adultSubtitle}</p>
              </div>
            </div>

            {audience === "adult" ? (
              <form onSubmit={onAdultSubmit} className="space-y-3">
                {mode === "signup" && (
                  <>
                    <Segment<AdultRole> value={role} onChange={setRole} options={[{ value: "parent", label: "Parent" }, { value: "teacher", label: "Teacher" }]} />
                    <Field icon={User} label="Your name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Parent or guardian name" autoComplete="name" required />
                  </>
                )}
                <Field icon={Mail} label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required />
                <Field
                  icon={Lock}
                  label={mode === "signup" ? "Create password" : "Password"}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  trailing={<Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((current) => !current)} className="h-8 w-8 text-slate-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</Button>}
                  required
                />
                {mode === "signup" && <p className="text-[10px] font-medium text-slate-400">Use 8 or more characters.</p>}
                {mode === "signin" && onForgotPassword && (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="-mt-1 self-start text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300"
                  >
                    Forgot password?
                  </button>
                )}
                {error && <ErrorNote message={error} />}
                <Button type="submit" size="lg" className="w-full" loading={busy} loadingText={mode === "signin" ? "Signing in..." : "Creating account..."}>
                  {mode === "signin" ? "Sign in" : "Create account"}<ArrowRight size={16} />
                </Button>
                <div className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /><span className="text-xs text-slate-400">or</span><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
                <Button type="button" variant="outline" size="lg" onClick={() => { setAudience("kid"); setError(null); }} className="w-full border-indigo-200 text-indigo-600 dark:border-indigo-400/30 dark:bg-white/5 dark:text-indigo-200">
                  <ShieldCheck size={17} /> My child has a family code
                </Button>
                <p className="text-center text-[10px] font-medium text-slate-400">Children can sign in without an email address.</p>
              </form>
            ) : (
              <form onSubmit={onKidSubmit} className="space-y-3">
                <Field icon={Hash} label="Family code" value={familyCode} onChange={(event) => setFamilyCode(event.target.value.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" maxLength={6} required />
                <Field icon={User} label="Profile name" value={kidName} onChange={(event) => setKidName(event.target.value)} placeholder="Your profile name" required />
                <Field icon={KeyRound} label="Secret PIN" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Enter your PIN" maxLength={8} required />
                {error && <ErrorNote message={error} />}
                <Button type="submit" size="lg" className="w-full" loading={busy} loadingText="Signing in...">Let’s learn <ArrowRight size={16} /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAudience("adult"); setError(null); }} className="mx-auto flex text-slate-500 dark:text-slate-300"><ArrowLeft size={14} /> Adult sign in</Button>
              </form>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            <ShieldCheck size={16} /> Family and learner access is protected by account permissions.
          </div>
        </Card>
      </main>
    </div>
  );
};

const ErrorNote: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
    {message}
  </div>
);
