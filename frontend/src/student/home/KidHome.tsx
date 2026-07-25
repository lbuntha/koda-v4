import React from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Home,
  ListChecks,
  LogOut,
  Play,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "../../components/ui";
import { resolveTechniqueThumbnail } from "../../techniques";
import { ActivityStatusBadge } from "./ActivityStatusBadge";
import type { CompletedCourseItem, CourseQueueItem } from "../../api/course";
import { FreePlaySwitch } from "./FreePlaySwitch";
import { LevelUpDialog } from "./LevelUpDialog";
import { StudentFooter } from "./StudentFooter";
import { ThemeToggle } from "../../theme/ThemeToggle";
import { useThemeMode } from "../../theme/appTheme";
import type { StudentHomeProps } from "./types";

const ACCENT = {
  purple: "from-[#7663F4] to-[#5844DE] shadow-indigo-300/40",
  blue: "from-sky-500 to-blue-600 shadow-sky-300/40",
  green: "from-emerald-500 to-green-600 shadow-emerald-300/40",
  amber: "from-amber-400 to-orange-500 shadow-amber-300/40",
  pink: "from-pink-500 to-rose-500 shadow-pink-300/40",
} as const;

/**
 * Soft tint per accent for the hero card header — keeps the stage colourful without
 * shouting. The dark pair is the same hue taken deep, so night mode still reads playful
 * rather than grey.
 */
const ACCENT_SOFT = {
  purple: "from-[#EFEBFF] to-[#E6F7FF] dark:from-[#2A2159] dark:to-[#1D2A4A]",
  blue: "from-[#E6F2FF] to-[#E9FBFF] dark:from-[#1B2F55] dark:to-[#173447]",
  green: "from-[#E7FBEF] to-[#EFFBE4] dark:from-[#13372A] dark:to-[#1B3A2A]",
  amber: "from-[#FFF4E0] to-[#FFF9E6] dark:from-[#412413] dark:to-[#3A2418]",
  pink: "from-[#FFECF6] to-[#FFF1EC] dark:from-[#421A33] dark:to-[#3F2124]",
} as const;

const activityThumbnail = (item: CourseQueueItem): string =>
  resolveTechniqueThumbnail(
    item.thumbnailUrl,
    item.questions[0]?.technique,
  ).url;

/**
 * Band A — Kid (grades 1–6). A centered, playful stage with one dominant
 * activity, small up-next bubbles, gentle catch-up, and replayable trophies.
 * Every progress signal is derived from the real course/progress contracts.
 */
export const KidHome: React.FC<StudentHomeProps> = ({
  course,
  levelUp,
  studentName,
  studentAvatar,
  loadingMode,
  skippingSkillId,
  onModeChange,
  onStart,
  onSkip,
  onDismissLevelUp,
  onExit,
}) => {
  const [theme, toggleTheme] = useThemeMode();
  const [hero, ...rest] = course.queue;
  const canSkip = course.mode === "scheduled" && Boolean(course.recommendationRunId);
  const missedItems = rest.filter(item => item.kind === "reinforce" || item.kind === "review");
  const recommendedItems = rest.filter(item => item.kind === "new" || item.kind === "stretch" || item.kind === "free");
  const completedItems = course.completedItems ?? [];

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden bg-[#F7F4FF] bg-[image:radial-gradient(circle_at_20%_10%,#D9FBFF_0%,transparent_34%),radial-gradient(circle_at_85%_70%,#FFE1F2_0%,transparent_35%)] text-[#21183D] dark:bg-[#0E0A20] dark:bg-[image:radial-gradient(circle_at_20%_10%,#1D2A52_0%,transparent_38%),radial-gradient(circle_at_85%_70%,#3A1B44_0%,transparent_38%)] dark:text-[#EDE9FF] ${
        theme === "dark" ? "dark" : ""
      }`}
      data-band="kid"
    >
      <div className="pointer-events-none absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-sky-300/35 blur-3xl dark:bg-sky-500/10" />
      <div className="pointer-events-none absolute -right-48 top-52 h-[32rem] w-[32rem] rounded-full bg-pink-300/35 blur-3xl dark:bg-pink-500/10" />
      <div className="pointer-events-none absolute left-1/3 top-16 h-60 w-60 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-500/8" />

      <div className="relative z-10 min-h-screen w-full bg-white/75 backdrop-blur-sm dark:bg-transparent">
        <header className="fixed inset-x-0 top-0 z-40 w-full border-b border-white/80 bg-[image:linear-gradient(90deg,rgba(226,255,251,0.96),rgba(255,255,255,0.94),rgba(252,244,255,0.96))] backdrop-blur-md dark:border-white/10 dark:bg-[#120E28]/85 dark:bg-[image:linear-gradient(90deg,rgba(28,36,66,0.92),rgba(24,18,48,0.92),rgba(44,26,64,0.92))]">
          <div className="mx-auto flex min-h-20 w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-2xl dark:bg-white/10">
                {studentAvatar || "🦉"}
              </span>
              <div className="min-w-0">
                <p className="text-xl font-black leading-none">
                  <span className="text-pink-500">K</span>
                  <span className="text-amber-500">o</span>
                  <span className="text-emerald-500">d</span>
                  <span className="text-violet-600">a</span>
                </p>
                <h1 className="mt-1 max-w-32 truncate text-sm font-extrabold text-[#21183D] sm:max-w-none dark:text-[#EDE9FF]">
                  Hi, {studentName}!
                </h1>
              </div>
            </div>
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Kid dashboard">
              {[
                { label: "Home", icon: Home, target: "kid-home" },
                { label: "Lessons", icon: BookOpen, target: "kid-lessons" },
              ].map((item, index) => (
                <Button
                  key={item.target}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth" })}
                  className={`rounded-full px-4 ${
                    index === 0
                      ? "bg-[#F0EBFF] text-[#5C46DF] hover:bg-[#E8E0FF] dark:bg-white/10 dark:text-[#CDBEFF] dark:hover:bg-white/15"
                      : "text-[#716680] hover:bg-[#F0EBFF] hover:text-[#5C46DF] dark:text-[#A79FC4] dark:hover:bg-white/10 dark:hover:text-[#CDBEFF]"
                  }`}
                >
                  <item.icon size={14} /> {item.label}
                </Button>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle theme={theme} onToggle={toggleTheme} variant="kid" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onExit}
                className="shrink-0 rounded-full border-[#E7E0F2] bg-white/70 px-3 font-extrabold text-[#6551BD] sm:px-4 dark:border-white/10 dark:bg-white/5 dark:text-[#CDBEFF] dark:hover:bg-white/10"
              >
                <LogOut size={14} /> <span className="hidden sm:inline">Exit</span>
              </Button>
            </div>
          </div>
        </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-7 pt-28 sm:px-7 sm:pb-9 sm:pt-32">
        {hero ? (
          <section
            id="kid-home"
            className="mx-auto max-w-4xl scroll-mt-5"
            aria-labelledby="kid-hero-title"
          >
            {/* Borderless card: a clean white surface is the only frame. */}
            <div className="overflow-hidden rounded-[1.6rem] bg-white/92 backdrop-blur-sm sm:rounded-[1.85rem] dark:bg-[#191338]/92">
              <div
                className={`flex items-center justify-between gap-3 bg-gradient-to-r px-4 py-2 sm:px-5 ${
                  ACCENT_SOFT[hero.accent || "purple"]
                }`}
              >
                <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#6F5CC4] dark:text-[#C3B4FF]">
                  {course.mode === "free" ? "Pick and play" : (course.quest?.label || "Today’s quest")}
                </p>
                {course.mode === "scheduled" && course.quest && course.quest.target > 0 && (
                  <QuestDots completed={course.quest.completed} target={course.quest.target} />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:flex-nowrap sm:gap-6 sm:px-6 sm:py-5">
                {/* No frame: the artwork stands on the card. `mix-blend-multiply` drops the
                    opaque light background most thumbnails ship with, so the ground shadow
                    reads through and the hop has weight. */}
                <div className="relative flex h-24 w-24 shrink-0 items-end justify-center sm:h-28 sm:w-28">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full dark:bg-[image:radial-gradient(circle,rgba(255,255,255,0.13)_0%,transparent_68%)]"
                  />
                  <span
                    aria-hidden
                    className="animate-mascot-shadow absolute bottom-[7%] h-2 w-3/5 rounded-[50%] bg-[#2A1B4A] opacity-25 blur-[3px] dark:bg-[#A48BFF] dark:opacity-30"
                  />
                  <img
                    src={activityThumbnail(hero)}
                    alt={`${hero.skillLabel} activity`}
                    className="animate-mascot-hop relative h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-[#806DD2] dark:text-[#B6A6FF]">
                    {course.mode === "free" ? "You choose!" : "Ready for this?"}
                  </p>
                  <h2
                    id="kid-hero-title"
                    className="mt-0.5 text-xl font-black leading-tight tracking-tight text-[#21183D] sm:text-2xl dark:text-[#F2EEFF]"
                  >
                    {hero.skillLabel}
                  </h2>
                  {hero.description && (
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[#6B6280] dark:text-[#A79FC4]">
                      {hero.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {hero.questions.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F1EDFF] px-2.5 py-0.5 text-[11px] font-black text-[#5C46DF] dark:bg-violet-400/15 dark:text-[#C3B4FF]">
                        <ListChecks size={12} /> {hero.questions.length}{" "}
                        {hero.questions.length === 1 ? "question" : "questions"}
                      </span>
                    )}
                    {typeof hero.xpAvailable === "number" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                        <Zap size={12} className="fill-current" /> {hero.xpAvailable} XP
                      </span>
                    )}
                    {hero.status && hero.status !== "not_completed" && (
                      <ActivityStatusBadge status={hero.status} />
                    )}
                  </div>
                </div>

                {/* Actions ride at the right end of the row on tablet/desktop, and wrap
                    under the content (full-width Play) on phones. */}
                <div className="flex w-full shrink-0 items-center gap-3 border-t border-[#F2EEFB] pt-3.5 sm:w-auto sm:flex-col sm:items-stretch sm:gap-2 sm:border-0 sm:pt-0 dark:border-white/10">
                  <Button
                    type="button"
                    onClick={() => onStart(hero)}
                    className={`h-12 flex-1 rounded-full border-transparent bg-gradient-to-r text-base font-black uppercase tracking-wide shadow-md ring-1 ring-inset ring-white/40 transition-transform hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 sm:w-44 sm:flex-none ${
                      ACCENT[hero.accent || "purple"]
                    }`}
                  >
                    <Play size={19} className="fill-current" />{" "}
                    {hero.status === "in_progress" ? "Keep going" : "Play"}
                  </Button>
                  {canSkip && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={skippingSkillId === hero.skillId}
                      loadingText="Finding another…"
                      onClick={() => onSkip(hero)}
                      className="shrink-0 rounded-full px-3 text-xs font-extrabold text-[#6C6480] hover:bg-[#F0EBFF] hover:text-[#4F3FA8] focus-visible:ring-[#8A73F7] dark:text-[#A79FC4] dark:hover:bg-white/10 dark:hover:text-[#CDBEFF]"
                    >
                      Save for later
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section
            id="kid-home"
            className="mx-auto max-w-4xl scroll-mt-5 rounded-[1.85rem] bg-white/92 px-6 py-12 text-center dark:bg-[#191338]/92"
          >
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-4xl dark:bg-amber-400/15">🎉</span>
            <h2 className="mt-5 text-3xl font-black text-[#21183D] dark:text-[#F2EEFF]">You’re all caught up!</h2>
            <p className="mt-2 font-bold text-[#766D88] dark:text-[#A79FC4]">Amazing work. You can still choose something fun to replay.</p>
          </section>
        )}

        <div id="kid-lessons" className="scroll-mt-5">
          <PracticeRows
            items={missedItems}
            title="Missed skills"
            subtitle="Keep practicing to get stronger!"
            tone="retry"
            onStart={onStart}
          />

          <CompletedActivities items={completedItems} />

          <PracticeRows
            items={recommendedItems}
            title="Recommended for you"
            subtitle="New challenges picked from your curriculum."
            tone="recommended"
            onStart={onStart}
          />
        </div>

        <div className="mt-8 flex justify-center">
          <FreePlaySwitch
            mode={course.mode}
            loading={loadingMode !== null}
            onModeChange={onModeChange}
          />
        </div>
      </main>

      <StudentFooter
        links={[
          { label: "Home", targetId: "kid-home" },
          { label: "Lessons", targetId: "kid-lessons" },
        ]}
        tagline="Making math fun through meaningful practice."
      />
      </div>
      <LevelUpDialog levelUp={levelUp} onDismiss={onDismissLevelUp} />
    </div>
  );
};

const PracticeRows: React.FC<{
  items: CourseQueueItem[];
  title: string;
  subtitle: string;
  tone: "retry" | "recommended";
  onStart: (item: CourseQueueItem) => void;
}> = ({ items, title, subtitle, tone, onStart }) => {
  const retry = tone === "retry";
  return (
    <section className="mx-auto mt-7 max-w-4xl" aria-label={title}>
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          retry
            ? "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300"
            : "bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300"
        }`}>
          {retry ? <AlertTriangle size={15} /> : <Sparkles size={15} />}
        </span>
        <div>
          <h2 className="text-sm font-black capitalize text-[#332750] dark:text-[#E4DEFF]">{title}</h2>
          <p className="text-[11px] font-bold text-[#817795] dark:text-[#8F87AC]">{subtitle}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <div
          className={
            retry
              ? "mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
              : "mt-3 grid gap-3 sm:grid-cols-2"
          }
        >
          {items.map(item => (
          <Button
            key={`${tone}:${item.assignmentId}:${item.skillId}`}
            type="button"
            variant="outline"
            onClick={() => onStart(item)}
            className={`h-auto min-h-16 justify-between rounded-3xl px-4 py-3 text-left shadow-sm hover:-translate-y-0.5 ${
              retry
                ? "w-[17rem] shrink-0 snap-start border-rose-100 bg-rose-50/75 hover:bg-rose-50 sm:w-[19rem] dark:border-rose-400/20 dark:bg-rose-400/10 dark:hover:bg-rose-400/15"
                : "border-violet-100 bg-violet-50/75 hover:bg-violet-50 dark:border-violet-400/20 dark:bg-violet-400/10 dark:hover:bg-violet-400/15"
            }`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white ${
                retry ? "text-rose-500" : "text-violet-600"
              }`}>
                <img
                  src={activityThumbnail(item)}
                  alt=""
                  className="h-9 w-9 rounded-xl object-contain"
                />
              </span>
              <span className="min-w-0 truncate text-sm font-extrabold text-[#403451] dark:text-[#E4DEFF]">
                {item.skillLabel}
              </span>
            </span>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase text-white shadow-sm ${
              retry ? "bg-rose-600 dark:bg-rose-500" : "bg-violet-600 dark:bg-violet-500"
            }`}>
              {retry ? "Retry" : "Start"}
            </span>
          </Button>
          ))}
        </div>
      ) : (
        <div className={`mt-3 flex min-h-20 items-center gap-3 rounded-3xl border-2 border-dashed px-5 py-4 ${
          retry
            ? "border-rose-100 bg-rose-50/35 text-rose-500 dark:border-rose-400/20 dark:bg-rose-400/5 dark:text-rose-300"
            : "border-violet-100 bg-violet-50/35 text-violet-500 dark:border-violet-400/20 dark:bg-violet-400/5 dark:text-violet-300"
        }`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/90 dark:bg-white/10">
            {retry ? <CheckCircle2 size={19} /> : <Sparkles size={19} />}
          </span>
          <div>
            <p className="text-sm font-extrabold text-[#51455F] dark:text-[#E4DEFF]">
              {retry ? "No missed skills" : "No new recommendations"}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-[#9187A3] dark:text-[#8F87AC]">
              {retry
                ? "Great work—nothing needs another try right now."
                : "New curriculum activities will appear here when they are ready."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

const CompletedActivities: React.FC<{
  items: CompletedCourseItem[];
}> = ({ items }) => {
  return (
    <section
      className="mx-auto mt-8 max-w-4xl text-left"
      aria-labelledby="kid-completed-title"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm dark:bg-emerald-500">
          <CheckCircle2 size={16} />
        </span>
        <div>
          <h2 id="kid-completed-title" className="text-sm font-black text-[#332750] dark:text-[#E4DEFF]">
            Completed
          </h2>
          <p className="text-[11px] font-bold text-[#817795] dark:text-[#8F87AC]">
            Finished during this learning session
          </p>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="mt-3 space-y-3">
          {items.map(item => (
          <div
            key={`${item.assignmentId}:${item.skillId}`}
            className="flex min-h-20 flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/90 bg-white/80 px-4 py-3 shadow-[0_8px_22px_-18px_rgba(47,36,78,0.7)] sm:flex-nowrap sm:px-5 dark:border-white/10 dark:bg-white/5 dark:shadow-none"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                <CheckCircle2 size={20} />
              </span>
              <span className="min-w-0 truncate text-sm font-extrabold text-[#4B405C] dark:text-[#E4DEFF]">
                {item.skillLabel}
              </span>
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-3">
              <ActivityStatusBadge status="completed" />
              {typeof item.xpEarned === "number" && (
                <span className="text-xs font-black text-amber-700 dark:text-amber-300">
                  +{item.xpEarned} XP
                </span>
              )}
            </span>
          </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex min-h-20 items-center gap-3 rounded-3xl border-2 border-dashed border-emerald-200 bg-white/55 px-5 py-4 dark:border-emerald-400/20 dark:bg-emerald-400/5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-500 dark:bg-white/10 dark:text-emerald-300">
            <CheckCircle2 size={19} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-emerald-950 dark:text-emerald-200">No completed skills yet</p>
            <p className="mt-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300/80">
              Finish a practice activity and it will appear here.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

/** Today's quest progress as dots — a countable "how much is left" signal for young readers. */
const QuestDots: React.FC<{ completed: number; target: number }> = ({ completed, target }) => {
  const total = Math.min(target, 8);
  const done = Math.max(0, Math.min(completed, total));
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${
              index < done
                ? "bg-[#5C46DF] dark:bg-[#A48BFF]"
                : "bg-white/90 ring-1 ring-inset ring-[#D6CEF2] dark:bg-white/10 dark:ring-white/20"
            }`}
          />
        ))}
      </span>
      <span className="text-xs font-black text-[#5C46DF] dark:text-[#C3B4FF]">
        {done} / {total} done
      </span>
    </div>
  );
};
