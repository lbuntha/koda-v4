import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  Flame,
  Target,
} from "lucide-react";
import type { CourseQueueItem } from "../../api/course";
import { Button } from "../../components/ui";
import {
  estimateFocusMinutes,
  focusBarHeight,
  focusDueCount,
  focusItemIsDue,
  focusProficiency,
} from "./focusHomeModel";
import { FreePlaySwitch } from "./FreePlaySwitch";
import { HomeHeader } from "./HomeHeader";
import { NotificationBell } from "../../notifications/NotificationBell";
import { KIND, cardsLabel } from "./kinds";
import { LevelUpDialog } from "./LevelUpDialog";
import { ActivityStatusBadge } from "./ActivityStatusBadge";
import { useThemeMode } from "../../theme/appTheme";
import type { StudentHomeProps } from "./types";

/**
 * Band C — Focus (grades 10–12). A restrained, responsive study dashboard:
 * the full plan stays central, every row is selectable, and the desktop rail
 * carries concise progress plus a real seven-day activity signal.
 */
export const FocusHome: React.FC<StudentHomeProps> = ({
  course,
  progress,
  activitySignal,
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
  const hero = course.queue[0];
  const canSkip = course.mode === "scheduled" && Boolean(course.recommendationRunId);
  const dueCount = focusDueCount(course.queue, progress);
  const minutes = estimateFocusMinutes(course.queue);
  const proficiency = focusProficiency(progress);
  const streak = activitySignal?.currentStreakDays ?? 0;

  const sessionMeta = course.queue.length > 0 ? (
    <span className="hidden items-center gap-1.5 rounded-full border border-[#DBE0EC] bg-white px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-[#4C5568] sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-[#AAB2C8]">
      {course.queue.length} skill{course.queue.length === 1 ? "" : "s"} · ~{minutes} min
    </span>
  ) : null;

  return (
    <div
      className={`min-h-screen bg-[#F4F5FA] text-[#1B2130] dark:bg-[#0F1320] dark:text-[#D7DCEB] ${
        theme === "dark" ? "dark" : ""
      }`}
      data-band="focus"
    >
      <HomeHeader
        studentName={studentName}
        studentAvatar={studentAvatar}
        onExit={onExit}
        right={<><NotificationBell recipientType="student" />{sessionMeta}</>}
        variant="focus"
        wide
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6C7488] dark:text-[#8891AC]">
              {course.mode === "free" ? "Free practice" : "Today’s plan"}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {course.mode === "free" ? "Choose a skill" : "Focus session"}
            </h2>
          </div>
          <p className="font-mono text-xs tabular-nums text-[#7A8296] dark:text-[#8891AC]">
            {course.queue.length} skill{course.queue.length === 1 ? "" : "s"} · ~{minutes} min
          </p>
        </div>

        <div className="mt-5 min-[841px]:hidden">
          <FocusStats streak={streak} proficiency={proficiency} dueCount={dueCount} />
        </div>

        <div className="mt-5 grid gap-6 min-[841px]:grid-cols-[minmax(0,1fr)_18rem] min-[841px]:items-start">
          <section className="min-w-0" aria-labelledby="focus-plan-title">
            <h3 id="focus-plan-title" className="sr-only">Session plan</h3>
            {hero ? (
              <>
                <ol className="space-y-2.5">
                  {course.queue.map((item, index) => (
                    <PlanRow
                      key={`${item.assignmentId}:${item.skillId}`}
                      item={item}
                      lead={index === 0}
                      due={focusItemIsDue(item, progress)}
                      onStart={onStart}
                    />
                  ))}
                </ol>

                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <Button size="lg" className="min-w-48" onClick={() => onStart(hero)}>
                    Start session <ArrowRight size={16} />
                  </Button>
                  <span className="text-sm text-[#7A8296] dark:text-[#8891AC]">
                    or select any skill above
                  </span>
                  {canSkip && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={skippingSkillId === hero.skillId}
                      loadingText="Skipping…"
                      onClick={() => onSkip(hero)}
                      className="min-[841px]:ml-auto dark:text-[#8891AC] dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      Skip top item
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-[#DBE0EC] bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-white/5">
                <h3 className="text-lg font-bold">You’re all caught up</h3>
                <p className="mt-1 text-sm text-[#7A8296] dark:text-[#8891AC]">
                  {course.mode === "free"
                    ? "Return later for a fresh plan."
                    : "Open Free practice or return for your next session."}
                </p>
              </div>
            )}

            <div className="mt-7 flex justify-center min-[841px]:hidden">
              <FreePlaySwitch
                mode={course.mode}
                loading={loadingMode !== null}
                onModeChange={onModeChange}
              />
            </div>
          </section>

          <aside className="hidden space-y-4 min-[841px]:block" aria-label="Study progress">
            <FocusStats streak={streak} proficiency={proficiency} dueCount={dueCount} stacked />
            <WeeklyActivity days={activitySignal?.weeklyActivity ?? []} />
            <div className="flex justify-center rounded-2xl border border-[#DBE0EC] bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <FreePlaySwitch
                mode={course.mode}
                loading={loadingMode !== null}
                onModeChange={onModeChange}
              />
            </div>
          </aside>
        </div>
      </main>

      <LevelUpDialog levelUp={levelUp} onDismiss={onDismissLevelUp} />
    </div>
  );
};

const FocusStats: React.FC<{
  streak: number;
  proficiency: number;
  dueCount: number;
  stacked?: boolean;
}> = ({ streak, proficiency, dueCount, stacked = false }) => (
  <div className={stacked ? "space-y-2.5" : "grid grid-cols-3 gap-2.5"}>
    <StatTile icon={Flame} value={String(streak)} label="Day streak" />
    <StatTile icon={Target} value={`${proficiency}%`} label="Proficient" />
    <StatTile
      icon={AlertTriangle}
      value={String(dueCount)}
      label="Due / missed"
      accent={dueCount > 0}
    />
  </div>
);

const StatTile: React.FC<{
  icon: typeof Clock;
  value: string;
  label: string;
  accent?: boolean;
}> = ({ icon: Icon, value, label, accent = false }) => (
  <div className={`rounded-xl border px-3.5 py-3 ${
    accent
      ? "border-amber-300/70 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10"
      : "border-[#DBE0EC] bg-white dark:border-white/10 dark:bg-white/5"
  }`}>
    <div className="flex items-center justify-between gap-2">
      <Icon size={15} className={accent ? "text-amber-600 dark:text-[#F0A94E]" : "text-[#7A8296] dark:text-[#77819D]"} />
      <span className={`text-xl font-extrabold tabular-nums leading-none ${
        accent ? "text-amber-700 dark:text-[#F0A94E]" : ""
      }`}>
        {value}
      </span>
    </div>
    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A8296] dark:text-[#77819D]">
      {label}
    </p>
  </div>
);

const WeeklyActivity: React.FC<{
  days: Array<{ date: string; day: string; count: number }>;
}> = ({ days }) => {
  const maximum = Math.max(...days.map(day => day.count), 0);
  return (
    <section className="rounded-2xl border border-[#DBE0EC] bg-white p-4 dark:border-white/10 dark:bg-white/5" aria-labelledby="weekly-activity-title">
      <div className="flex items-center justify-between">
        <div>
          <h3 id="weekly-activity-title" className="text-sm font-bold">Weekly activity</h3>
          <p className="mt-0.5 text-[11px] text-[#7A8296] dark:text-[#77819D]">Last seven days</p>
        </div>
        <BarChart3 size={16} className="text-[#5B48D6] dark:text-[#7C8CFF]" />
      </div>
      {days.length > 0 ? (
        <div className="mt-5 flex h-24 items-end justify-between gap-2" aria-label="Activity by day">
          {days.map(day => (
            <div key={day.date} className="flex flex-1 flex-col items-center justify-end gap-1.5">
              <span
                className={`w-full max-w-5 rounded-t bg-[#6B57D8] dark:bg-[#6B7BFF] ${focusBarHeight(day.count, maximum)}`}
                title={`${day.count} activities`}
              />
              <span className="font-mono text-[9px] text-[#7A8296] dark:text-[#77819D]">{day.day}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-[#F4F5FA] px-3 py-5 text-center text-xs text-[#7A8296] dark:bg-black/10 dark:text-[#77819D]">
          Activity appears after your first session.
        </div>
      )}
    </section>
  );
};

const PlanRow: React.FC<{
  item: CourseQueueItem;
  lead: boolean;
  due: boolean;
  onStart: (item: CourseQueueItem) => void;
}> = ({ item, lead, due, onStart }) => {
  const meta = KIND[item.kind];
  const Icon = meta.icon;
  return (
    <li>
      <Button
        type="button"
        variant="outline"
        onClick={() => onStart(item)}
        className={`group h-auto min-h-16 w-full justify-start gap-3 rounded-xl px-4 py-3.5 text-left ${
          lead
            ? "border-[#6B57D8] bg-[#F3F0FF] shadow-[0_10px_24px_-14px_rgba(91,72,214,0.6)] hover:bg-[#EEE9FF] dark:border-[#5367F0] dark:bg-[#4457E0]/10 dark:text-[#E2E6F1] dark:hover:bg-[#4457E0]/15"
            : "border-[#DBE0EC] bg-white hover:border-[#B9AEEC] hover:bg-[#F8F6FF] dark:border-white/10 dark:bg-white/5 dark:text-[#D7DCEB] dark:hover:border-white/20 dark:hover:bg-white/[0.07]"
        }`}
      >
        <span className={`h-9 w-1 shrink-0 rounded-full ${
          lead ? "bg-[#5B48D6] dark:bg-[#6B7BFF]" : due ? "bg-amber-400" : "bg-transparent"
        }`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={lead ? "font-bold" : "font-semibold"}>{item.skillLabel}</span>
            {due && (
              <span className="rounded border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-[#F0A94E]">
                Overdue
              </span>
            )}
            <ActivityStatusBadge status={item.status} />
          </span>
        </span>
        <span className="hidden items-center gap-1.5 text-xs font-semibold text-[#6C7488] sm:inline-flex dark:text-[#8891AC]">
          <Icon size={13} /> {meta.label}
        </span>
        <span className="hidden w-16 shrink-0 text-right font-mono text-xs tabular-nums text-[#7A8296] min-[480px]:inline dark:text-[#77819D]">
          {cardsLabel(item.questions.length).replace(" worksheet", "")}
        </span>
        <ArrowRight
          size={15}
          className="shrink-0 text-[#B4BAC9] transition group-hover:translate-x-0.5 group-hover:text-[#5B48D6] dark:group-hover:text-[#8D9AFF]"
        />
      </Button>
    </li>
  );
};
