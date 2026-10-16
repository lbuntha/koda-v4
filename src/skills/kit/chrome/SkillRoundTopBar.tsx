import React, { Suspense, lazy, useEffect, useState, useSyncExternalStore } from "react";
import {
  Flame,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  ScrollText,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { UILessonIcon, UIMenu, UIMenuItem, UIProgressBar, UISpinner } from "../../../components/ui";
import { KodaFace } from "../../../components/KodaFace";
import { KodaAskModal } from "../../../components/KodaAskModal";
import { LiveVoiceCoachModal } from "../../../components/LiveVoiceCoachModal";
import { useKoda } from "../../../lib/useKoda";
import { playChrome } from "../round/answerSound";
import { SvgAsset } from "../../../assets/svg";
import { PreferencesAPI } from "../../../lib/preferences";
import type { KodaSDK } from "../../types";
import { useT } from "../../../lib/i18n";

/**
 * This skill's activity log, opened from inside its round.
 *
 * The trail alone, not the whole skill page: mid-round the question is "what
 * did this skill just do?", and features, settings and lessons all live on the
 * Skills page where there is room for them.
 *
 * Loaded lazily because that module imports the skill registry — which imports
 * the skills, which import this bar. Deferring keeps the cycle off the
 * module-eval path instead of relying on hoisting order.
 */
const ActivityTrail = lazy(() =>
  import("../../../components/skills/SkillManagerPage").then((m) => ({
    default: m.ActivityTrail,
  })),
);

/**
 * What Koda is told about the question on screen.
 *
 * Both ways of asking use it — the written panel puts it in the prompt, the
 * voice coach opens on it — because a child who taps for help mid-round is
 * asking about *this* question, and an assistant that has to be told which one
 * is worse than no assistant.
 *
 * `SkillRound` builds one from what it already knows, so a skill gets Koda
 * without wiring anything. The two callbacks are the voice coach's alone: it
 * can celebrate an answer and move a child on, which the written panel does
 * not, so a skill that has nothing to hand over simply omits them.
 */
export interface SkillVoiceContext {
  topic: string;
  questionText: string;
  problemContext: string;
  onAwardXp?(xp: number): void;
  onNextQuestion?(): void;
}

const formatXp = (value: number): string => {
  if (value < 1000) return String(value);
  const compact = value / 1000;
  const digits = compact < 10 && compact % 1 !== 0 ? 1 : 0;
  return `${compact.toFixed(digits).replace(/\.0$/, "")}k`;
};

export interface SkillRoundTopBarProps {
  /** Bound SDK. The bar reads the learner's standing and the skill's name from it. */
  koda: KodaSDK;
  /** Lesson identity, as the learner sees it. */
  title: string;
  subtitle?: string;
  levelNumber?: number;
  /** Lesson icon name, resolved through the shared `lessonIcons` registry. */
  iconName?: string;
  iconTone?: string;
  /** 1-based. */
  questionIndex: number;
  totalQuestions: number;
  onExit(): void;
  /**
   * Replaces the identity pill. For a skill whose title is also a control —
   * counting's opens its level picker — rather than plain text.
   */
  identity?: React.ReactNode;
  /**
   * What Koda is told about the question on screen. `SkillRound` always builds
   * one; a skill supplies its own only to add the voice coach's two callbacks
   * or to word the context better than the round can.
   */
  voice?: SkillVoiceContext;
  /** Extra controls, placed before the sound toggle. Rarely needed. */
  extras?: React.ReactNode;
  /**
   * Whether the round has been scored.
   *
   * The standing is read once because the figures only move when a round ends
   * — but that is exactly when they move, and this bar stays on screen behind
   * the summary. Without this it spent the end of every round showing the
   * streak and the XP the child had *before* the round that earned them, which
   * reads as a flame that never lights.
   */
  scored?: boolean;
}

/**
 * The bar every round wears.
 *
 * Everything standard is built in — the learner's standing, Ask Koda, skill
 * settings, fullscreen and the way out — so a skill gets the whole toolbar by
 * rendering this, not by wiring the buttons itself.
 *
 * Spoken lesson audio can be muted here as well as in Settings. Both surfaces
 * edit the same synced preference, so this is a convenient second door rather
 * than a second setting. Sound effects remain separate, just as they are in
 * Settings.
 *
 * When each skill assembled its own bar, counting showed invented figures
 * and addition showed none, and the two rounds stopped looking like one
 * product.
 *
 * A skill supplies only what is genuinely its own: which lesson is running, how
 * far through it is, and — if its title is a control — the identity pill.
 */
export const SkillRoundTopBar: React.FC<SkillRoundTopBarProps> = ({
  koda,
  title,
  subtitle,
  levelNumber,
  iconName,
  iconTone,
  questionIndex,
  totalQuestions,
  onExit,
  identity,
  voice,
  extras,
  scored = false,
}) => {
  const { t } = useT();
  const percent = Math.min(100, Math.round((questionIndex / Math.max(1, totalQuestions)) * 100));

  const [standing, setStanding] = useState<{ streakDays: number; xp: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // This is the existing Settings preference, subscribed rather than copied.
  // A change here updates Settings immediately; a synced change from another
  // device updates this button while the round is still open.
  useSyncExternalStore(PreferencesAPI.subscribe, PreferencesAPI.version, PreferencesAPI.version);
  const voiceEnabled = PreferencesAPI.current().voiceEnabled;
  const toggleVoice = () => {
    if (voiceEnabled) koda.speech.stop();
    PreferencesAPI.update({ voiceEnabled: !voiceEnabled });
  };

  /*
   * Koda, mid-round.
   *
   * The bar used to carry a voice-only button that no skill ever passed the
   * prop for, so the one screen a child is actually stuck on was the one screen
   * with no help on it — and the button, where it did appear, asked neither the
   * deployment nor the plan, so it could open a session that was then refused.
   * `useKoda` answers all three at once, and `mode` decides which panel a tap
   * opens — the same answer the floating button gets, so the tap means the same
   * thing here as it does on the home screen.
   *
   * That floating button still stays out of a round on purpose: it would sit on
   * top of the thing being worked on. This is its stand-in.
   */
  const help = useKoda();
  const mode = help.mode;
  const writes = help.access("chat").offered;
  const talks = help.access("voice").offered;
  const askKoda = () =>
    mode && help.ask(mode, () => (mode === "voice" ? setShowVoice(true) : setShowAsk(true)));

  // Read as the round opens and again once it is scored: the figures move when
  // a round ends, not mid-question, and the host has recorded the practice by
  // the time this runs.
  useEffect(() => {
    void koda.progress.snapshot().then((s) => setStanding({ streakDays: s.streakDays, xp: s.xp }));
  }, [koda, scored]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  /*
   * One button shape for every control on the bar.
   *
   * The bar used to mix a filled tile, a bordered tile, a labelled pill and a
   * rose block, and on a phone it rendered a second copy of each control. Now
   * there is one set, one shape — round, quiet until hovered — and the width
   * decides only how many of them fit. 44px on a phone, where a child aims
   * with a thumb; 40px once there is a pointer.
   */
  const iconButton =
    "grid place-items-center shrink-0 rounded-full min-w-11 min-h-11 sm:min-w-10 sm:min-h-10 text-muted hover:text-ink hover:bg-surface-muted transition active:scale-90 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

  const progress = (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="shrink-0 rounded-full bg-indigo-500 px-2.5 py-1 text-xs font-black tabular-nums text-white">
        {questionIndex}
        <span className="opacity-70">/{totalQuestions}</span>
      </span>
      <UIProgressBar
        size="lg"
        className="flex-1"
        value={percent}
        max={100}
        label={t("lessonCard.questionOf", { answered: questionIndex, total: totalQuestions })}
      />
    </div>
  );

  return (
    <>
      {/*
        One bar, two rows on a phone.

        Narrow: the lesson and the controls share the top row, and the progress
        bar spans the full width beneath them, where a thumb is not covering it.
        From `sm`: one row — lesson, progress in the middle, controls. The adult
        controls (the "more" menu) appear only once there is a pointer and room;
        a five-year-old on a phone should not be one mis-tap from the activity
        log. Standing appears at `lg`, where it no longer crowds the question.

        The status bar's inset is this header's padding, because this header is
        what touches the top of the glass. Opaque `bg-surface`, matching the
        column behind it, so the strip under the OS clock never shimmers.
      */}
      <header className="sticky top-0 z-30 bg-surface px-3 sm:px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 sm:pt-[calc(0.625rem+env(safe-area-inset-top))] sm:pb-2.5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Which lesson. Takes what is left, and truncates before anything else gives. */}
            <div className="flex-1 min-w-0 sm:flex-initial sm:max-w-[34%]">
              {identity ?? (
                <div className="flex items-center gap-2 min-w-0">
                  <UILessonIcon name={iconName} tone={iconTone} variant="bare" size="sm" />
                  {/*
                   * The child's title, and the adult's underneath — the concept
                   * line, written for a grown-up, only where there is room.
                   */}
                  <div className="min-w-0">
                    <span className="flex items-baseline gap-1.5 min-w-0">
                      {levelNumber ? (
                        <span className="shrink-0 text-[10px] font-black text-muted tabular-nums">
                          {levelNumber}
                        </span>
                      ) : null}
                      <span className="block truncate text-sm font-extrabold text-ink">{title}</span>
                    </span>
                    {subtitle && (
                      <span className="hidden md:block truncate text-[11px] font-medium text-muted">
                        {subtitle}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Progress, in the middle once it fits on the same row. */}
            <div className="hidden sm:block flex-1 min-w-[140px] max-w-sm mx-auto">{progress}</div>

            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              {/*
                * Standing: one quiet pill, two figures. Two separate tinted
                * chips beside a labelled Koda pill made the right of the bar
                * louder than the question.
                */}
              <div className="hidden lg:flex items-center gap-2 mr-1 rounded-full bg-surface-muted px-3 py-1.5">
                <span
                  className="flex items-center gap-1 text-orange-700 dark:text-orange-300"
                  aria-label={t("streak.daysChip", { count: standing?.streakDays ?? 0 })}
                >
                  <SvgAsset id="streak" size={18} fallback={<Flame className="w-4 h-4 fill-orange-400" />} />
                  <span className="text-sm font-black tabular-nums">{standing?.streakDays ?? 0}</span>
                </span>
                <span className="h-4 w-px bg-line" aria-hidden="true" />
                <span
                  className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300"
                  aria-label={t("round.xpPoints", { count: standing?.xp ?? 0 })}
                >
                  <SvgAsset id="points" size={18} fallback={<Zap className="w-4 h-4" />} />
                  <span className="text-sm font-black tabular-nums">{formatXp(standing?.xp ?? 0)}</span>
                </span>
              </div>

              {mode && (
                <button
                  type="button"
                  onClick={() => {
                    playChrome(koda, "pop");
                    askKoda();
                  }}
                  /* The character is the whole button, at every width. A word
                     beside it said what the face already says, and in English
                     on a Khmer screen. The name stays for a screen reader. */
                  className={iconButton}
                  title={t("round.askKoda")}
                  aria-label={t("round.askKoda")}
                >
                  <KodaFace size={30} />
                </button>
              )}

              <button
                type="button"
                onClick={toggleVoice}
                className={iconButton}
                title={voiceEnabled ? t("round.voiceOff") : t("round.voiceOn")}
                aria-label={voiceEnabled ? t("round.voiceOff") : t("round.voiceOn")}
                aria-pressed={voiceEnabled}
              >
                {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              {extras}

              {/* Everything that is not the lesson, behind one button, for
                  whoever is supervising. */}
              <div className="hidden sm:block">
                <UIMenu
                  align="end"
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      onClick={() => {
                        playChrome(koda, "pop");
                        toggle();
                      }}
                      className={iconButton}
                      title={t("round.more")}
                      aria-label={t("round.moreOptions")}
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  )}
                >
                  <UIMenuItem icon={<ScrollText />} onSelect={() => setShowSettings(true)}>
                    {t("round.activityLog")}
                  </UIMenuItem>
                  <UIMenuItem icon={isFullscreen ? <Minimize2 /> : <Maximize2 />} onSelect={toggleFullscreen}>
                    {isFullscreen ? t("round.exitFullscreen") : t("round.fullscreen")}
                  </UIMenuItem>
                </UIMenu>
              </div>

              {/* Leaving: the same shape as the rest, told apart by colour alone. */}
              <button
                type="button"
                onClick={onExit}
                className={`${iconButton} !text-rose-600 dark:!text-rose-400 hover:!bg-rose-500/10`}
                title={t("round.leave")}
                aria-label={t("round.leave")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Phone: progress gets its own full-width row. */}
          <div className="sm:hidden mt-1.5">{progress}</div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-surface border-2 border-line rounded-3xl max-w-4xl w-full p-4 sm:p-6 max-h-[92vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h3 className="text-sm sm:text-base font-black text-ink font-mono">
                {t("round.activityLog")}
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className={iconButton}
                aria-label={t("common.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Suspense fallback={<UISpinner />}>
              <ActivityTrail skillId={koda.skillId} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Both ways of asking, on the question the child is looking at. Mounted
          whenever this deployment offers either, not when a skill remembers to
          pass a prop — help that depends on the skill author is help a child
          does not have. */}
      {writes && (
        <KodaAskModal
          isOpen={showAsk}
          onClose={() => setShowAsk(false)}
          onStartVoice={() => setShowVoice(true)}
          context={{
            topic: voice?.topic ?? title,
            question: voice?.questionText,
            where: voice?.problemContext,
          }}
        />
      )}

      {talks && (
        <LiveVoiceCoachModal
          isOpen={showVoice}
          onClose={() => setShowVoice(false)}
          currentLevel={levelNumber ?? 1}
          currentTopic={voice?.topic ?? title}
          currentQuestionText={voice?.questionText}
          currentQuestionIndex={questionIndex}
          totalQuestions={totalQuestions}
          currentProblemContext={voice?.problemContext}
          studentName="Math Explorer"
          onAwardXp={voice?.onAwardXp}
          onNextQuestion={voice?.onNextQuestion}
          onSwitchToText={
            writes
              ? () => {
                  setShowVoice(false);
                  setShowAsk(true);
                }
              : undefined
          }
        />
      )}
    </>
  );
};
