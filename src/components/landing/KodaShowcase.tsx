/**
 * "See how Koda works": six short moments on a phone, playing by themselves.
 *
 * Coded, not a video. A video is a 5–10 MB download that goes soft when it is
 * scaled and stutters at 30 frames a second; this is a few kilobytes of the
 * app's own cards and type, drawn by the browser at the screen's own rate, in
 * whichever language the page is in, and it keeps working offline.
 *
 * It plays only when someone can see it: muted by nature, paused off screen and
 * in a hidden tab, and still for anyone who asked their device for less motion
 * (they step through it by hand). One line of words per moment; the phone is
 * the picture.
 */

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, Check, Flame, Lightbulb, PenLine, Play, Star } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";

const STEPS = ["plan", "read", "stuck", "trace", "play", "report"] as const;
type Step = (typeof STEPS)[number];

/** How long each moment stays, in ms: long enough to read one line and watch it happen. */
const DWELL = 4800;

const EASE = [0.22, 1, 0.36, 1] as const;

/** Things that arrive on the phone: a soft rise, one after another. */
const arrive = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: EASE },
});

const km = "font-['Kantumruy_Pro',_'Noto_Sans_Khmer',_sans-serif]";

/* ---------- the six screens ---------- */

const PlanScreen: React.FC = () => {
  const { t } = useT();
  const rows: { icon: React.ReactNode; tone: string; kind: string; title: React.ReactNode }[] = [
    { icon: <PenLine className="h-4 w-4" />, tone: "bg-indigo-50 text-indigo-600", kind: t("landing.showcase.ui.letters"), title: <span lang="km" className={km}>ក ខ គ</span> },
    { icon: <BookOpen className="h-4 w-4" />, tone: "bg-sky-50 text-sky-600", kind: t("landing.showcase.ui.read"), title: t("landing.showcase.ui.book") },
    { icon: <Lightbulb className="h-4 w-4" />, tone: "bg-purple-50 text-purple-600", kind: t("landing.showcase.ui.math"), title: "7 + ? = 10" },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <motion.div {...arrive(0.05)} className="flex items-center justify-between">
        <span className="text-base font-black text-slate-900">{t("landing.showcase.ui.hi")}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-black text-rose-600">
          <Flame className="h-3 w-3 fill-current" />5
        </span>
      </motion.div>
      <motion.span {...arrive(0.15)} className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {t("landing.showcase.ui.today")}
      </motion.span>
      {rows.map((row, i) => (
        <motion.div
          key={i}
          {...arrive(0.3 + i * 0.25)}
          className={`flex items-center gap-2.5 rounded-2xl border-2 p-2.5 ${i === 0 ? "border-indigo-500 bg-indigo-50/60" : "border-slate-200 bg-white"}`}
        >
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${row.tone}`}>{row.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold text-slate-500">{row.kind}</span>
            <span className="block truncate text-sm font-black text-slate-900">{row.title}</span>
          </span>
          {i === 0 && (
            <motion.span
              className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-white"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.4, delay: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </motion.span>
          )}
        </motion.div>
      ))}
    </div>
  );
};

const ReadScreen: React.FC = () => {
  const options = ["គ្រាប់ពូជ", "ថ្ម", "ស្បែកជើង"];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <motion.div {...arrive(0.05)} className="relative h-28 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 from-60% to-emerald-100 to-60%">
        <span className="absolute right-4 top-3 h-7 w-7 rounded-full bg-pink-200" />
        <svg className="absolute bottom-5 left-7" width="46" height="52" viewBox="0 0 56 62" aria-hidden="true">
          <rect x="10" y="20" width="36" height="34" rx="9" fill="#818CF8" />
          <rect x="16" y="28" width="24" height="12" rx="6" fill="#E0E7FF" />
          <circle cx="23" cy="34" r="3" fill="#312E81" />
          <circle cx="33" cy="34" r="3" fill="#312E81" />
          <line x1="28" y1="20" x2="28" y2="10" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
          <circle cx="28" cy="8" r="4" fill="#F472B6" />
        </svg>
        <motion.svg
          className="absolute bottom-6 left-32 origin-bottom"
          width="34"
          height="38"
          viewBox="0 0 40 44"
          aria-hidden="true"
          initial={{ scaleY: 0.2, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
        >
          <path d="M20 44V22" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 26c-9 0-14-6-14-13 8 0 14 5 14 13z" fill="#34D399" />
          <path d="M20 22c0-9 6-14 14-14 0 8-6 14-14 14z" fill="#10B981" />
        </motion.svg>
      </motion.div>
      <motion.p {...arrive(0.3)} lang="km" className={`${km} text-[13px] leading-relaxed text-slate-700`}>
        បូតជីករណ្ដៅតូចមួយ។ គាត់ដាក់គ្រាប់ពូជ ហើយស្រោចទឹក។
      </motion.p>
      <motion.div {...arrive(0.8)} className="flex flex-col gap-1.5 border-t border-slate-200 pt-2.5">
        <span lang="km" className={`${km} text-sm font-bold text-slate-900`}>តើបូតដាំអ្វី?</span>
        {options.map((option, i) => (
          <motion.span
            key={option}
            lang="km"
            className={`${km} flex items-center justify-between rounded-xl border-2 px-3 py-1.5 text-[13px] font-bold`}
            initial={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", color: "#475569" }}
            animate={i === 0 ? { borderColor: "#10B981", backgroundColor: "#ECFDF5", color: "#047857" } : {}}
            transition={{ duration: 0.35, delay: 2.1 }}
          >
            {option}
            {i === 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.2, duration: 0.3, ease: EASE }}>
                <Check className="h-4 w-4" strokeWidth={3} />
              </motion.span>
            )}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
};

const StuckScreen: React.FC = () => {
  const { t } = useT();
  const tiles = ["្រ", "ី", "ា", "ុ"];
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <motion.span {...arrive(0.05)} className="text-center text-sm font-black text-slate-900">{t("landing.showcase.ui.buildWord")}</motion.span>
      <motion.div {...arrive(0.15)} className="flex items-center justify-center gap-3">
        <svg width="56" height="36" viewBox="0 0 54 34" aria-hidden="true">
          <path d="M6 17c8-12 26-14 36 0-10 14-28 12-36 0z" fill="#38BDF8" />
          <path d="M40 17l12-9v18z" fill="#0EA5E9" />
          <circle cx="16" cy="15" r="2.4" fill="#0F172A" />
        </svg>
        {/* The word as it grows, whole: ត, then ត្រ — Khmer marks never stand alone. */}
        <span className="flex items-center gap-1.5">
          <span lang="km" className={`${km} relative grid h-14 w-16 place-items-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white`}>
            <motion.span className="absolute" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.3, delay: 2.9 }}>
              ត
            </motion.span>
            <motion.span className="absolute" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 2.9, ease: EASE }}>
              ត្រ
            </motion.span>
          </span>
          <span className="h-14 w-10 rounded-2xl border-2 border-dashed border-slate-300" />
        </span>
      </motion.div>
      <motion.div
        className="flex gap-2.5 rounded-2xl border-2 border-violet-300 bg-violet-50 p-2.5"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 1.1, ease: EASE }}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-700 text-white">
          <Lightbulb className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-violet-700">{t("landing.showcase.ui.idea")}</span>
          <span className="block text-xs font-bold leading-snug text-indigo-950">{t("landing.showcase.ui.ideaText", { word: "ត្រី", first: "ត" })}</span>
        </span>
      </motion.div>
      <div className="grid grid-cols-4 gap-1.5">
        {tiles.map((tile, i) => (
          <motion.span
            key={tile}
            lang="km"
            className={`${km} rounded-xl border-2 py-2 text-center text-lg font-bold`}
            initial={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF", color: "#0F172A", opacity: 1 }}
            animate={i === 0 ? { borderColor: "#4F46E5", backgroundColor: "#EEF2FF", color: "#4338CA", opacity: [1, 1, 0.35] } : {}}
            transition={{ duration: 0.9, delay: 2.2, times: [0, 0.6, 1] }}
          >
            {tile}
          </motion.span>
        ))}
      </div>
    </div>
  );
};

const TraceScreen: React.FC = () => {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col gap-2.5">
      <motion.div {...arrive(0.05)} className="flex items-center justify-between">
        <span className="text-sm font-black text-slate-900">{t("landing.showcase.ui.trace")}</span>
        <span className="text-[11px] font-black text-slate-500">3/5</span>
      </motion.div>
      <motion.div {...arrive(0.15)} className="relative grid flex-1 place-items-center overflow-hidden rounded-2xl border-2 border-indigo-100 bg-indigo-50/60">
        <span className="absolute inset-x-4 top-[34%] border-t border-dashed border-indigo-200" />
        <span className="absolute inset-x-4 top-[72%] border-t border-dashed border-indigo-200" />
        {/* The letter as a guide, then the child's ink wiping across it. */}
        <span lang="km" className={`${km} relative text-[168px] font-medium leading-none text-indigo-100`}>
          ក
          <motion.span
            className="absolute inset-0 text-violet-700"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 2, delay: 0.7, ease: "easeInOut" }}
          >
            ក
          </motion.span>
        </span>
      </motion.div>
      <motion.div
        className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 2.9, ease: EASE }}
      >
        <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
        <span className="text-xs font-black text-emerald-700">{t("landing.showcase.ui.niceWork")}</span>
      </motion.div>
    </div>
  );
};

const PlayScreen: React.FC = () => {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <motion.div
        className="flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br from-violet-400 via-violet-600 to-violet-800 px-3 py-4 text-white"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <span className="text-sm font-black">{t("landing.showcase.ui.complete")}</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.45, delay: 0.6 + i * 0.25, ease: EASE }}>
              <Star className="h-7 w-7 fill-white text-white" />
            </motion.span>
          ))}
        </span>
        <motion.span {...arrive(1.5)} className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-black">
          {t("landing.showcase.ui.points", { count: 30 })}
        </motion.span>
      </motion.div>
      <div className="grid grid-cols-2 gap-2">
        <motion.span {...arrive(1.9)} className="rounded-2xl border-2 border-rose-100 bg-rose-50 px-2.5 py-2">
          <span className="block text-base font-black text-rose-600">{t("landing.showcase.ui.days", { count: 6 })}</span>
          <span className="block text-[10px] font-bold text-slate-500">{t("landing.showcase.ui.streak")}</span>
        </motion.span>
        <motion.span {...arrive(2.1)} className="rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-2.5 py-2">
          <span className="block text-base font-black text-indigo-700">372</span>
          <span className="block text-[10px] font-bold text-slate-500">{t("landing.showcase.ui.weekPoints")}</span>
        </motion.span>
      </div>
      <motion.div {...arrive(2.5)} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-[11px] font-black text-white">1</span>
        <span className="text-xs font-black text-emerald-800">{t("landing.showcase.ui.first")}</span>
      </motion.div>
    </div>
  );
};

const ReportScreen: React.FC = () => {
  const { t } = useT();
  const bars = [60, 85, 40, 100, 70, 8, 8];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <motion.div
        className="flex gap-2 rounded-2xl bg-white p-2.5 shadow-md shadow-slate-900/10"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
      >
        <img src="/favicon.svg" alt="" width={26} height={26} className="h-[26px] w-[26px] shrink-0 rounded-md" />
        <span className="min-w-0">
          <span className="block text-[10px] font-bold text-slate-500">{t("landing.showcase.ui.reminderMeta")}</span>
          <span className="block text-xs font-black leading-snug text-slate-900">{t("landing.showcase.ui.reminder")}</span>
        </span>
      </motion.div>
      <motion.div {...arrive(0.9)} className="flex flex-col gap-2.5 rounded-2xl border-2 border-slate-100 bg-white p-3">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-violet-700">{t("landing.showcase.ui.week")}</span>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            ["5", t("landing.showcase.ui.daysLabel")],
            ["78", t("landing.showcase.ui.minutes")],
            ["12/33", t("landing.showcase.ui.letters")],
          ].map(([value, label]) => (
            <span key={label} className="flex flex-col items-center rounded-lg bg-indigo-50/70 py-1.5">
              <span className="text-sm font-black text-slate-900">{value}</span>
              <span className="text-[9px] font-bold text-slate-500">{label}</span>
            </span>
          ))}
        </div>
        <div className="flex h-16 items-end gap-1 px-0.5">
          {bars.map((h, i) => (
            <motion.span
              key={i}
              className={`flex-1 origin-bottom rounded ${i === 3 ? "bg-indigo-600" : h < 10 ? "bg-slate-200" : "bg-indigo-300"}`}
              style={{ height: `${h}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.6, delay: 1.3 + i * 0.08, ease: EASE }}
            />
          ))}
        </div>
        <motion.div {...arrive(2.2)} className="flex items-center justify-between text-[11px] font-bold text-slate-900">
          <span>{t("landing.showcase.ui.practise")}</span>
          <span lang="km" className={`${km} text-pink-700`}>ខ គ</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

const SCREENS: Record<Step, React.FC> = {
  plan: PlanScreen,
  read: ReadScreen,
  stuck: StuckScreen,
  trace: TraceScreen,
  play: PlayScreen,
  report: ReportScreen,
};

/* ---------- the phone ---------- */

const Phone: React.FC<{ step: Step; still: boolean }> = ({ step, still }) => {
  const Screen = SCREENS[step];
  return (
    <div className="relative mx-auto h-[452px] w-[226px] shrink-0 rounded-[46px] border-[7px] border-[#0B0B0F] bg-white shadow-[0_0_0_2px_#3F3F46,0_0_0_3.5px_#A1A1AA,0_30px_60px_-20px_rgba(59,31,184,0.35)]">
      <div className="absolute left-1/2 top-2 h-5 w-[68px] -translate-x-1/2 rounded-full bg-[#0B0B0F]" />
      <div className="absolute inset-x-4 top-2.5 flex items-center justify-between pl-1 text-[11px] font-black text-slate-900">
        <span>9:41</span>
        <span className="h-2.5 w-[18px] rounded-[3px] border border-slate-900/45 p-px">
          <span className="block h-full w-4/5 rounded-[1.5px] bg-slate-900" />
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-9 overflow-hidden px-3.5 pb-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            className="h-full"
            initial={still ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={still ? undefined : { opacity: 0, x: -24 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <Screen />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="absolute bottom-1.5 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
    </div>
  );
};

/* ---------- the section ---------- */

export const KodaShowcase: React.FC = () => {
  const { t } = useT();
  const reduced = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const ref = useRef<HTMLElement>(null);

  // Play only while it is on screen and the tab is in front.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const playing = visible && !hidden && !reduced;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % STEPS.length), DWELL);
    return () => window.clearTimeout(timer);
  }, [playing, index]);

  const step = STEPS[index];

  return (
    <section ref={ref} aria-labelledby="showcase-title" className={themeSystem.card("default", "overflow-hidden p-5 sm:p-8")}>
      <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <h2 id="showcase-title" className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{t("landing.showcase.title")}</h2>
          <p className="mt-1 text-sm text-body sm:text-base">{t("landing.showcase.subtitle")}</p>

          {/* The six moments: tap any to see it; the bar shows how long until the next. */}
          <ol className="mt-5 hidden space-y-1.5 md:block">
            {STEPS.map((id, i) => {
              const active = i === index;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={active ? "step" : undefined}
                    className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-left transition-colors ${active ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-surface-muted"}`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${active ? "bg-indigo-600 text-white" : "bg-surface-muted text-muted"}`}>{i + 1}</span>
                    <span className={`text-sm font-bold sm:text-base ${active ? "text-ink" : "text-muted"}`}>{t(`landing.showcase.steps.${id}`)}</span>
                    {active && playing && (
                      <motion.span
                        key={`bar-${index}`}
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-indigo-500"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: DWELL / 1000, ease: "linear" }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <div aria-hidden="true" className="relative">
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/20 blur-3xl" />
            <Phone step={step} still={reduced} />
          </div>

          {/* On a phone the list would push the phone off screen: one line for the moment, dots to jump. */}
          <div className="mt-5 md:hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={step}
                aria-live="polite"
                className="text-center text-base font-black text-ink"
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {t(`landing.showcase.steps.${step}`)}
              </motion.p>
            </AnimatePresence>
            <div className="mt-2 flex justify-center">
              {STEPS.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t(`landing.showcase.steps.${id}`)}
                  aria-current={i === index ? "step" : undefined}
                  className="grid h-11 w-8 place-items-center"
                >
                  <span className={`block h-2 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-indigo-600" : "w-2 bg-slate-300"}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
