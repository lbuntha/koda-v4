import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  Flame,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  ScrollText,
  X,
  Zap,
} from "lucide-react";
import { UILessonIcon, UIMenu, UIMenuItem, UISpinner } from "../../../components/ui";
import { KodaFace } from "../../../components/KodaFace";
import { KodaAskModal } from "../../../components/KodaAskModal";
import { LiveVoiceCoachModal } from "../../../components/LiveVoiceCoachModal";
import { useKoda } from "../../../lib/useKoda";
import { themeSystem } from "../../../lib/themeSystem";
import { playChrome } from "../round/answerSound";
import { SvgAsset } from "../../../assets/svg";
import type { KodaSDK } from "../../types";

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
}

/**
 * The bar every round wears.
 *
 * Everything standard is built in — the learner's standing, Ask Koda, skill
 * settings, fullscreen and the way out — so a skill gets the whole toolbar by
 * rendering this, not by wiring the buttons itself.
 *
 * No mute here: every question already carries its own read-aloud button, and
 * the app-wide Sound FX switch lives in Settings, which `playSound` honours on
 * its own. A third control for the same thing was one a child could hit by
 * accident and not understand. That is the
 * point: when each skill assembled its own, counting showed invented figures
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
}) => {
  const percent = Math.min(100, Math.round((questionIndex / Math.max(1, totalQuestions)) * 100));

  const [standing, setStanding] = useState<{ streakDays: number; xp: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Read once per round: the numbers move when a round ends, not mid-question.
  useEffect(() => {
    void koda.progress.snapshot().then((s) => setStanding({ streakDays: s.streakDays, xp: s.xp }));
  }, [koda]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  const iconButton =
    "p-2 min-w-[40px] min-h-[40px] rounded-xl text-muted hover:text-ink hover:bg-surface-muted transition shrink-0 flex items-center justify-center cursor-pointer";
  /** Bigger target, because on a phone a child is aiming with a thumb. */
  const compactButton =
    "p-2 min-w-[44px] min-h-[44px] rounded-xl bg-surface border border-line text-muted flex items-center justify-center shrink-0 cursor-pointer";

  return (
    <>
      {/*
        Two shapes, one bar.

        Narrow: identity on top with only the controls a child needs mid-round
        (sound, leave), and the progress bar spanning the full width below it,
        where a thumb is not covering it. Wide: everything on one row, with the
        adult controls — settings, fullscreen — appearing only once there is
        room for them. A five-year-old on a phone should not be one mis-tap from
        the Skill Manager.
      */}
      {/* The status bar's inset is this header's padding, because this header is
          what touches the top of the glass. A `sticky top-0` bar sticks to the
          viewport, not to the body's padding box, so on an installed app the
          lesson title and the leave button were drawn straight through the
          clock and the battery. Opaque rather than translucent for the same
          reason the tab bar is: at this width the strip behind the OS clock is
          the one part of the page that must not shimmer. `bg-surface` and not
          `bg-canvas` for the same reason the feedback bar below uses it — the
          column paints the page `bg-surface`, and a bar a shade off it reads as
          a second background rather than as the top of this one. */}
      <header className="px-2.5 sm:px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2 sm:pb-2.5 bg-surface sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex flex-col gap-1.5 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Top row on narrow screens: which lesson, and the way out */}
          <div className="flex items-center justify-between gap-2 min-w-0 sm:flex-initial sm:justify-start">
            {identity ?? (
              <div className="flex items-center gap-2 min-w-0">
                <UILessonIcon name={iconName} tone={iconTone} variant="bare" size="sm" />
                <div className="min-w-0">
                  {/*
                   * The child's title, and the adult's underneath.
                   *
                   * "L3: Comparing Two Groups (Conservat…" was a filename: a
                   * level number nobody says out loud, a teacher's phrasing, and
                   * a bracket clipped mid-word. The level moves into its own
                   * small chip where it stays useful for navigation without
                   * eating the title, and the concept line below is where the
                   * pedagogy belongs — it is already written for a grown-up.
                   */}
                  <span className="flex items-baseline gap-1.5 min-w-0">
                    {levelNumber ? (
                      <span className="shrink-0 text-[10px] font-black text-muted tabular-nums">
                        {levelNumber}
                      </span>
                    ) : null}
                    <span className="block text-sm font-extrabold text-ink truncate max-w-[150px] xs:max-w-[210px] sm:max-w-[300px]">
                      {title}
                    </span>
                  </span>
                  {subtitle && (
                    <span className="hidden md:block text-[10px] text-muted font-medium truncate max-w-[280px]">
                      {subtitle}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* The controls a child uses, kept reachable on every width */}
            <div className="flex items-center gap-1 shrink-0 sm:hidden">
              {mode && (
                <button
                  onClick={() => {
                    playChrome(koda, "pop");
                    askKoda();
                  }}
                  /*
                   * On a phone the character is the whole button — no tile.
                   *
                   * It was an amber square, which on this bar was the loudest
                   * thing on a screen whose subject is the question, and amber
                   * is the tone this product uses for "try again". A 390px
                   * toolbar has room for the character or for packaging round
                   * it, not both, and the character is the part a child reads.
                   * The 44px box stays: the target does not shrink with the
                   * chrome.
                   */
                  className="min-w-[44px] min-h-[44px] grid place-items-center shrink-0 cursor-pointer rounded-xl transition active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Ask Koda about this question"
                  aria-label="Ask Koda about this question"
                >
                  <KodaFace size={34} />
                </button>
              )}
              <button
                onClick={onExit}
                className="p-2 min-w-[44px] min-h-[44px] rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 cursor-pointer"
                title="Leave this round"
                aria-label="Leave this round"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/*
            * Progress: the round's one progress indicator.
            *
            * Sized up because this is now the only one — the step header used to
            * carry a second, and two of them three inches apart is worse than
            * either alone. A 2px hairline with "20%" beside it is a dashboard
            * widget; a child reads a chunky bar filling up, and the pill says
            * which question they are on in the words they would use.
            */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto sm:min-w-[190px] shrink-0">
            <span className="shrink-0 rounded-full bg-indigo-500 px-2.5 py-1 text-xs font-black tabular-nums text-white shadow-sm">
              {questionIndex}
              <span className="opacity-70">/{totalQuestions}</span>
            </span>
            <div
              className="flex-1 h-3 bg-surface-muted rounded-full overflow-hidden ring-1 ring-line/60"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Question ${questionIndex} of ${totalQuestions}`}
            >
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Wide only: standing, then every control */}
          <div className="hidden sm:flex items-center gap-1 sm:gap-2 shrink-0">
            {/*
              * Standing: two figures a child is proud of, so they are legible
              * rather than squeezed.
              *
              * They were 12px monospace in a translucent pill, reading as a
              * debug readout. Each is now its own chip with the number as the
              * loud part and the icon supporting it — and they are labelled for
              * a screen reader, which `title` alone does not do.
              */}
            <div className="hidden lg:flex items-center gap-1.5">
              <span
                className="flex items-center gap-1.5 rounded-xl bg-orange-500/10 px-2.5 py-1.5 text-orange-700 dark:text-orange-300"
                aria-label={`${standing?.streakDays ?? 0} day streak`}
              >
                <SvgAsset
                  id="streak"
                  size={20}
                  fallback={<Flame className="w-4 h-4 fill-orange-400" />}
                />
                <span className="text-sm font-black tabular-nums">{standing?.streakDays ?? 0}</span>
              </span>
              <span
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500/10 px-2.5 py-1.5 text-indigo-700 dark:text-indigo-300"
                aria-label={`${standing?.xp ?? 0} experience points`}
              >
                <SvgAsset id="points" size={20} fallback={<Zap className="w-4 h-4" />} />
                <span className="text-sm font-black tabular-nums">
                  {formatXp(standing?.xp ?? 0)}
                </span>
              </span>
            </div>

            {mode && (
              <button
                onClick={() => {
                  playChrome(koda, "pop");
                  askKoda();
                }}
                /* Amber-on-white was the loudest thing on a screen whose subject is the
   question. Help should be findable, not the focal point. */
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 min-h-[40px] rounded-xl bg-surface-muted hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-sm transition active:scale-95 shrink-0 cursor-pointer"
                title="Ask Koda about this question"
                aria-label="Ask Koda about this question"
              >
                {/* The same character the floating buddy is, and the same one a
                    tablet sees — one Koda across every width, which is what
                    makes it read as somebody rather than as three icons. The
                    mode is no longer drawn: a mic and a speech bubble asked a
                    child to know which kind of conversation they were about to
                    have, which is not a choice they make or care about. */}
                <KodaFace size={26} />
                <span className="hidden md:inline">Ask Koda</span>
              </button>
            )}

            {extras}

            {/*
              * Everything that is not the lesson, behind one button.
              *
              * The activity log and the fullscreen toggle are for whoever is
              * supervising, not for the child answering the question — and each
              * sitting in the bar as its own unlabelled icon added weight to the
              * one strip that should stay quiet. `UIMenu` already exists and is
              * used elsewhere, so this groups rather than invents.
              */}
            <UIMenu
              align="end"
              trigger={({ toggle }) => (
                <button
                  onClick={() => {
                    playChrome(koda, "pop");
                    toggle();
                  }}
                  className={iconButton}
                  title="More"
                  aria-label="More options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              )}
            >
              <UIMenuItem icon={<ScrollText />} onSelect={() => setShowSettings(true)}>
                Activity log
              </UIMenuItem>
              <UIMenuItem
                icon={isFullscreen ? <Minimize2 /> : <Maximize2 />}
                onSelect={toggleFullscreen}
              >
                {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              </UIMenuItem>
            </UIMenu>

            <button
              onClick={onExit}
              /* Leaving is the one destructive-ish action here, and the design
                 system already has a tone for that — a bespoke rose block was a
                 second opinion about the same thing. */
              className={themeSystem.button("ghost", "icon", "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 min-w-[40px] min-h-[40px]")}
              title="Leave this round"
              aria-label="Leave this round"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
          <div className="bg-surface border-2 border-line rounded-3xl max-w-4xl w-full p-4 sm:p-6 max-h-[92vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
              <h3 className="text-sm sm:text-base font-black text-ink font-mono">
                Activity log
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className={iconButton}
                aria-label="Close settings"
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
