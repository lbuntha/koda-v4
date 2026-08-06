import React, { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import type { ChildInput } from "../api/family";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useThemeMode } from "../theme/appTheme";
import { ChildFormModal } from "./ChildFormModal";
import { useFamily } from "./useFamily";

/** First-parent gate: learner setup is completed before the family dashboard mounts. */
export const ParentFirstRunScreen: React.FC = () => {
  const [theme, toggleTheme] = useThemeMode();
  const { account, completeParentOnboarding, logout } = useAuth();
  const { children, loading, addChild } = useFamily();
  const [wizardOpen, setWizardOpen] = useState(true);

  useEffect(() => {
    if (!loading && children.length > 0) completeParentOnboarding();
  }, [children.length, completeParentOnboarding, loading]);

  const createFirstLearner = async (data: ChildInput) => {
    await addChild(data);
    completeParentOnboarding();
  };

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="min-h-dvh bg-[#FBFAFF] px-4 py-4 font-sans text-[#0E0B55] dark:bg-[#0E1020] dark:text-white sm:px-6">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="Koda" className="h-9 w-9 rounded-xl" />
            <div>
              <p className="text-base font-black leading-tight">Koda Parent</p>
              <p className="text-[11px] font-medium text-[#6D6997] dark:text-[#9A94B8]">Your family home is ready</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle theme={theme} onToggle={toggleTheme} variant="round" />
            <Button variant="ghost" size="sm" onClick={logout} className="text-[#6D6997] dark:text-slate-300">
              Sign out
            </Button>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-3xl items-center justify-center py-8">
          <section className="relative w-full overflow-hidden rounded-[2rem] border border-[#E3DDF8] bg-white px-6 py-10 text-center shadow-[0_18px_50px_rgba(83,74,183,0.10)] sm:px-12 sm:py-14 dark:border-white/10 dark:bg-[#15182A]">
            <div className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-violet-200/40 blur-3xl dark:bg-violet-500/10" />
            <div className="pointer-events-none absolute -bottom-24 -right-12 h-56 w-56 rounded-full bg-cyan-100/60 blur-3xl dark:bg-cyan-500/10" />
            <div className="relative">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#EEE9FF] text-[#534AB7] shadow-sm dark:bg-violet-400/15 dark:text-[#CDBEFF]">
                <UserPlus size={38} strokeWidth={2.2} />
              </span>
              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Sparkles size={12} /> Account created
              </div>
              <h1 className="mx-auto mt-3 max-w-xl text-2xl font-black leading-tight sm:text-3xl">
                Welcome, {account?.name?.split(" ")[0] || "Parent"}! Let&rsquo;s add your first learner.
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm font-medium leading-relaxed text-[#6D6997] dark:text-[#9A94B8]">
                Create a kid profile so Koda can personalize their grade, subjects, learning path, and secure sign-in.
              </p>
              <div className="mx-auto mt-6 grid max-w-lg gap-2 text-left sm:grid-cols-3">
                {["Choose their grade", "Pick learning goals", "Create a kid sign-in"].map(label => (
                  <div key={label} className="flex items-center gap-2 rounded-xl bg-[#F8F6FF] px-3 py-2.5 text-xs font-semibold text-[#4F4A75] dark:bg-white/5 dark:text-slate-200">
                    <ShieldCheck size={14} className="shrink-0 text-[#7C6DD8]" /> {label}
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={() => setWizardOpen(true)} className="mt-7 bg-[#534AB7] hover:bg-[#453DA0]">
                Create kid account <ArrowRight size={17} />
              </Button>
              <p className="mt-3 text-[11px] font-medium text-[#8D89AE]">You&rsquo;ll enter the family dashboard after setup.</p>
            </div>
          </section>
        </main>
      </div>

      <ChildFormModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSubmit={createFirstLearner}
        firstRun
      />
    </div>
  );
};
