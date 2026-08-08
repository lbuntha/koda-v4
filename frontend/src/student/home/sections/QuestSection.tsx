import React from "react";
import { CalendarDays, Check, ChevronRight, Clock3, Lock, Map, Play, Sparkles, Star, Trophy, Zap } from "lucide-react";
import type { CourseQueueItem, TodayCourse } from "../../../api/course";
import { apiFileUrl } from "../../../api/client";
import { Button, Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui";

interface Props {
  quest?: TodayCourse["quest"];
  activities: CourseQueueItem[];
  subjectName: string;
  onStart: (item: CourseQueueItem) => void;
}

const percent = (completed: number, target: number): number =>
  target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

/** A real daily quest backed by /learning/today. Weekly and challenge contracts do not exist yet. */
export const QuestSection: React.FC<Props> = ({ quest, activities, subjectName, onStart }) => {
  const [tab, setTab] = React.useState("daily");
  const completed = quest?.completed ?? 0;
  const target = quest?.target ?? activities.length;
  const progress = percent(completed, target);

  return (
    <section id="kid-quests" className="mt-6 scroll-mt-24">
      <header>
        <h1 className="text-base font-black text-[#27334A] sm:text-lg dark:text-white">{subjectName} quests</h1>
        <p className="mt-0.5 text-[10px] font-bold text-[#8792A5] sm:text-[11px] dark:text-[#8F99AD]">
          Complete {subjectName} activities. Your XP, streak, and rewards stay together across every subject.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} variant="learner" className="mt-4">
        <TabsList className="rounded-2xl border-2 border-[#E7E3F6] bg-white p-1.5 shadow-[0_6px_24px_rgba(83,74,183,0.06)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-none">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">
            Weekly <span className="hidden rounded-full bg-[#EEE9FF] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#7252D8] group-aria-selected:bg-white/20 group-aria-selected:text-white sm:inline dark:bg-violet-400/15 dark:text-[#CDBEFF]">Soon</span>
          </TabsTrigger>
          <TabsTrigger value="challenges">
            Challenges <span className="hidden rounded-full bg-[#EEE9FF] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#7252D8] group-aria-selected:bg-white/20 group-aria-selected:text-white sm:inline dark:bg-violet-400/15 dark:text-[#CDBEFF]">Soon</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card variant="activity" className="grid gap-3 bg-[linear-gradient(135deg,#F3EFFF_0%,#F1F7FF_100%)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5 dark:bg-[linear-gradient(135deg,rgba(112,80,216,0.2),rgba(39,119,184,0.12))]">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#E4DDF8] bg-white text-[#6844EA] shadow-[0_5px_16px_-12px_rgba(83,74,183,0.4)] dark:border-white/10 dark:bg-white/10 dark:text-[#CDBEFF]">
                <Map size={24} strokeWidth={2.3} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7658D5] dark:text-[#BEACFF]">Today’s quest</p>
                <h2 className="mt-0.5 truncate text-sm font-black text-[#27203F] sm:text-base dark:text-white">{quest?.label ?? "Complete today’s activities"}</h2>
                <p className="mt-1 text-[10px] font-bold text-[#756B89] dark:text-[#AAA1C2]">Finish {target} activit{target === 1 ? "y" : "ies"} today</p>
              </div>
            </div>

            <div className="min-w-48">
              <div className="flex items-center justify-between gap-4 text-[10px] font-extrabold text-[#62557D] dark:text-[#C5BBDF]">
                <span className="flex items-center gap-1.5"><Trophy size={14} /> {completed}/{target} done</span>
                <span className="flex items-center gap-1"><Zap size={12} className="fill-current text-amber-400" /> {quest?.xpEarned ?? 0} XP</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/80 dark:bg-white/10">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#7A5AF0,#4C8CF5)] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-right text-[9px] font-black text-[#756B89] dark:text-[#AAA1C2]">{progress}% complete</p>
            </div>
          </Card>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-[#28334A] sm:text-base dark:text-[#F2EEFF]">Today’s activities</h2>
              <p className="mt-0.5 text-[10px] font-bold text-[#8792A5] dark:text-[#8F99AD]">Complete these activities to finish your daily quest.</p>
            </div>
            <span className="shrink-0 text-[10px] font-black text-[#7252D8] dark:text-[#CDBEFF]">{completed}/{target}</span>
          </div>

          <div className="mt-3 space-y-2.5">
            {activities.length > 0 ? activities.map((item, index) => {
              const done = item.status === "completed";
              const thumbnail = apiFileUrl(item.thumbnailUrl);
              return (
                <Card key={`${item.assignmentId}:${item.skillId}`} variant="standard" interactive className="overflow-hidden">
                  <CardContent className="flex flex-wrap items-center gap-3 p-3.5 sm:flex-nowrap sm:px-5 sm:py-4">
                    <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl ${done ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" : "bg-[#F0EBFF] text-[#6844EA] dark:bg-violet-400/15 dark:text-[#CDBEFF]"}`}>
                      {thumbnail ? <img src={thumbnail} alt="" className="h-9 w-9 object-contain" /> : done ? <Check size={19} strokeWidth={3} /> : <span className="text-sm font-black">{index + 1}</span>}
                      {done && thumbnail && <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-[#222039]"><Check size={10} strokeWidth={3} /></span>}
                    </span>
                    <div className="min-w-[10rem] flex-1">
                      <h3 className="truncate text-xs font-black text-[#28334A] sm:text-sm dark:text-[#F2EEFF]">{item.skillLabel}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-[#8792A5] dark:text-[#8F99AD]">
                        {item.estimatedMinutes != null && <span className="flex items-center gap-1"><Clock3 size={12} /> {item.estimatedMinutes} min</span>}
                        {item.xpAvailable != null && <span className="flex items-center gap-1"><Star size={12} className="fill-current text-amber-400" /> {item.xpAvailable} XP</span>}
                        {done && <span className="text-emerald-600 dark:text-emerald-300">Completed</span>}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant={done ? "outline" : "default"} onClick={() => onStart(item)} className={`w-full min-w-20 text-[11px] sm:w-auto sm:min-w-24 ${done ? "border-emerald-200 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-400/20 dark:bg-transparent dark:text-emerald-300" : ""}`}>
                      {done ? "Practice" : item.status === "in_progress" ? "Continue" : "Start"}
                      {done ? <ChevronRight size={14} /> : <Play size={13} className="fill-current" />}
                    </Button>
                  </CardContent>
                </Card>
              );
            }) : (
              <Card variant="standard" className="px-4 py-10 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0EBFF] text-[#7252D8] dark:bg-violet-400/15 dark:text-[#CDBEFF]"><Trophy size={20} /></span>
                <p className="mt-3 text-xs font-black text-[#38445A] dark:text-[#E8E4F5]">You’re all caught up</p>
                <p className="mt-1 text-[10px] font-bold text-[#8792A5] dark:text-[#8F99AD]">New daily activities will appear here.</p>
              </Card>
            )}
          </div>
        </TabsContent>

        {(["weekly", "challenges"] as const).map(value => {
          const weekly = value === "weekly";
          const label = weekly ? "Weekly quests" : "Challenges";
          const Icon = weekly ? CalendarDays : Sparkles;
          return (
            <TabsContent key={value} value={value} className="mt-4">
              <Card variant="standard" className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EBFF] text-[#7252D8] dark:bg-violet-400/15 dark:text-[#CDBEFF]">
                  <Icon size={24} />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#8A92A3] shadow-sm dark:bg-[#27233F] dark:text-[#AAA1C2]"><Lock size={10} /></span>
                </span>
                <span className="mt-4 rounded-full bg-[#EEE9FF] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#7252D8] dark:bg-violet-400/15 dark:text-[#CDBEFF]">Coming soon</span>
                <h2 className="mt-2 text-base font-black text-[#38445A] dark:text-[#E8E4F5]">{label}</h2>
                <p className="mt-1 max-w-sm text-[11px] font-semibold leading-relaxed text-[#8792A5] dark:text-[#8F99AD]">
                  {weekly ? "Build a full week of learning and unlock a bigger reward." : "Take on special learning goals and collect new achievements."}
                </p>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
};
