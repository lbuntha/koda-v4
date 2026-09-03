/**
 * Synthesis Tutor - AI Math & Problem Solving Socratic Tutor
 */

import React, { Suspense, lazy, useState, useEffect, useRef, useSyncExternalStore } from "react";
import {
  Megaphone,
  Sparkles,
  Scale,
  PieChart,
  Box,
  Zap,
  Compass,
  Cpu,
  Award,
  Flame,
  Brain,
  Map,
  Volume2,
  VolumeX,
  BookOpen,
  ChevronRight,
  RefreshCw,
  CircleDot,
  Layers,
  Clock,
  GraduationCap,
  Mic,
  Sun,
  Moon,
} from "lucide-react";

import { TopicCategory, GradeLevel, ProblemItem, ChatMessage, UserProgress, SkillNode } from "./types";
import { INITIAL_SKILL_NODES, SAMPLE_PROBLEMS } from "./data/sampleProblems";
import { SKILL_GROWTH_ROADMAP, SkillQuestStage } from "./data/skillTreeRoadmap";
import { KodaAvatar } from "./components/KodaAvatar";
import { SocraticChatPanel } from "./components/SocraticChatPanel";
import { Home } from "./components/Home";
import { KodaFab } from "./components/KodaFab";
import { UpgradePrompt } from "./components/UpgradePrompt";
import { requireFeature } from "./lib/featureGate";
import { PREMIUM_FEATURE, isPremiumLesson, premiumLocked } from "./lib/premiumLessons";
import { authorizeLesson } from "./lib/lessonAccess";
import {
  loadCompletedLevels,
  loadProgress,
  saveCompletedLevels,
  saveProgress,
  subscribeLearnerRecord,
} from "./lib/learnerProgress";
import { recordPractice, useStreak } from "./lib/streak";
import { useSessionClock, useStudyGate } from "./lib/sessionTime";
import { levelFromXp } from "./lib/level";
import { publishLearnerFigures } from "./lib/profileStats";
import { Billing } from "./lib/billing";
import { ApiError } from "./lib/sync";
import { refreshDeploymentRules } from "./lib/deploymentRules";
import { BadgeAPI, earnedBadges } from "./lib/badges";
import { LearnPage } from "./components/LearnPage";
import { SkillCatalogPage } from "./components/SkillCatalogPage";
import { AppNav } from "./components/AppNav";
import { SidebarNav } from "./components/SidebarNav";
import { MainLayout } from "./components/layout/MainLayout";
import { UIPageLoader } from "./components/ui";
import { SkillHost } from "./skills/host/SkillHost";
import {
  getCourseLessons,
  getLessonByLevel,
  isPracticeLesson,
  totalLessonCount,
} from "./curriculum";
import { useAudienceViewer } from "./skills/viewer";
import { SignInScreen } from "./components/account/SignInScreen";
import { ResetPasswordScreen, resetTokenFromUrl } from "./components/account/ResetPasswordScreen";
import { VerifyEmailScreen, verificationTokenFromUrl } from "./components/account/VerifyEmailScreen";
import { LearnersPage } from "./components/account/LearnersPage";
import { DevicesPage } from "./components/account/DevicesPage";
import { ProfilePage } from "./components/account/ProfilePage";
import { KodaAskModal } from "./components/KodaAskModal";
import type { KodaContext } from "./lib/tutorApi";
import { Personas } from "./lib/personas";
import { useKoda } from "./lib/useKoda";
import { SettingsPage } from "./components/SettingsPage";
import {
  SessionAPI,
  installLearningSink,
  refreshMenu,
  refreshPermissions,
  refreshSystem,
  usePermissions,
  useSession,
  useSystem,
} from "./lib/sync";
import { refreshNotificationToken } from "./lib/push";
import { DailyStudyGoal } from "./components/DailyStudyGoal";
import { DayDoneScreen } from "./components/DayDoneScreen";
import { QuickMathPanel } from "./components/QuickMathPanel";
import { LiveVoiceCoachModal } from "./components/LiveVoiceCoachModal";
import { playSound, playBase64Pcm, speakWebSpeech } from "./utils/audio";
import { PreferencesAPI } from "./lib/preferences";
import { themeSystem } from "./lib/themeSystem";
import { listSvgAssets } from "./lib/svgAssetsApi";
import { tutorHeaders } from "./lib/tutorApi";
import { generateLocalSocraticResponse } from "./utils/socraticEngine";
import { refreshSkillRegistry, useSkillRegistryVersion } from "./lib/skillRegistryApi";
import { refreshMaintenanceVersions } from "./lib/maintenanceReset";

/*
 * The operator's pages, fetched when one is opened rather than shipped to
 * everybody.
 *
 * These seven are the largest components in the app and the least used: the
 * Skill Manager alone is bigger than every learner-facing page put together,
 * and a five-year-old counting rockets downloaded all of it to render a screen
 * they have no right to open. Splitting them here costs an admin one fetch the
 * first time they open a page and saves every learner the whole weight.
 *
 * Gated *and* split: the `can(...)` checks below are unchanged, because a chunk
 * that is merely hard to fetch is not a permission. The split is about bytes;
 * the server is what refuses the data.
 *
 * Named exports, so each import is mapped onto the default a lazy chunk must
 * expose. `SkillManagerPage` is already imported this way by the round's top
 * bar for its Activity trail — with the eager import gone, that lazy import and
 * this one resolve to the same chunk instead of pinning the module into the
 * main bundle.
 */
const SkillManagerPage = lazy(() =>
  import("./components/skills/SkillManagerPage").then((m) => ({ default: m.SkillManagerPage })),
);
const SvgAssetsPage = lazy(() =>
  import("./components/SvgAssetsPage").then((m) => ({ default: m.SvgAssetsPage })),
);
const UsersPage = lazy(() =>
  import("./components/account/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const RolesPage = lazy(() =>
  import("./components/account/RolesPage").then((m) => ({ default: m.RolesPage })),
);
const MenuPage = lazy(() =>
  import("./components/account/MenuPage").then((m) => ({ default: m.MenuPage })),
);
const AdminPage = lazy(() =>
  import("./components/account/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const KodaPage = lazy(() =>
  import("./components/account/KodaPage").then((m) => ({ default: m.KodaPage })),
);

/**
 * The wait, while one of those chunks arrives.
 *
 * One boundary per page slot rather than one around the whole tab area: a
 * shared boundary would blank the operator's notice and every sibling tab for
 * the fraction of a second a fetch takes, and a page that fails to load would
 * take its neighbours down with it.
 */
const Deferred: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Suspense fallback={<UIPageLoader label={label} />}>{children}</Suspense>
);

export default function App() {
  // Publication is server-owned. Subscribing here makes every learner-facing
  // visibility resolver repaint when the online registry replaces its cache.
  useSkillRegistryVersion();
  const [skillNodes, setSkillNodes] = useState<SkillNode[]>(INITIAL_SKILL_NODES);
  const session = useSession();
  const { can } = usePermissions();
  const canManageMenu = Boolean(session && can("menu:manage"));
  const canManageRoles = Boolean(session && can("role:manage"));
  const canManageChildren = Boolean(session && can("learner:create"));
  const canManageSkills = Boolean(session && can("content:write"));
  // The shared art library is the deployment's, not a family's — see
  // `content:write` in the policy table. Hiding the nav entry is not enough on
  // its own: the tab id survives a sign-out, so the page itself is gated too.
  const canEditArt = Boolean(session && can("content:write"));
  // The deployment's own pages — Ask Koda and Admin. One right, because both
  // decide what every family on this Koda gets rather than what one family sets.
  const canOperate = Boolean(session && can("system:write"));

  // A stored session is a claim, not proof — check it with the server on boot.
  // Offline it stands; rejected, it is cleared and the gate comes back.
  useEffect(() => {
    void SessionAPI.verify();
  }, []);

  // Everything the learning log records is also queued for upload. Starting it
  // here rather than at module load keeps it out of the way of tests.
  useEffect(() => installLearningSink(), []);

  /*
   * Keep the notification token current, for accounts that have one.
   *
   * FCM rotates a registration token on its own schedule, and a browser that
   * registered once and never again goes quiet after a rotation: no error, no
   * bounce, just a parent who stops hearing from Koda. This asks for the token
   * on each launch and only writes when it has actually changed, so the usual
   * case costs nothing. It never prompts — permission is asked for in Settings,
   * from a tap, and nowhere else.
   */
  useEffect(() => {
    if (!session) return;
    void refreshNotificationToken();
  }, [session]);

  // What this account may do decides what the sidebar draws, and it depends on
  // the account — so it is fetched when one appears, not once at boot when
  // there may not be one yet.
  useEffect(() => {
    if (!session) return;
    // Server reset generations make an admin erase reach every offline-first
    // device. Reload after applying one so React state also starts from zero.
    void refreshMaintenanceVersions()
      .then((changed) => {
        if (changed) window.location.reload();
      })
      .catch(() => undefined);
    void refreshPermissions();
    // The sidebar comes from the menu collection; the bundled JSON is what it
    // draws until this returns, and whenever there is no network at all.
    void refreshMenu();
    // And what the deployment allows at all — the ceiling over every family
    // toggle. Cached, so this only corrects a stale copy.
    void refreshSystem();
    // Skill code is bundled for offline play; Mongo owns whether each bundled
    // skill is released. Failure leaves the last complete cache in force.
    void refreshSkillRegistry().catch(() => undefined);
    // Mongo is authoritative for the shared art library. The IndexedDB cache
    // and bundled snapshot keep rendering available before this returns.
    void listSvgAssets().catch(() => undefined);
    // What this family's plan covers. Read here, beside the switchboard, so a
    // screen never has to fetch it before it can decide what to draw.
    void Billing.refresh();
    // Who Koda can be. Beside the plan for the same reason: a screen naming the
    // child's teacher should never have to fetch before it can draw.
    void Personas.refresh();
    // The XP rates, the streak rule and the badges: one operator's answer for
    // every family, pulled beside the switchboard that works the same way.
    void refreshDeploymentRules();
  }, [
    session?.role,
    session?.familyId,
    session?.platformRole,
    session?.permissions?.join("|"),
  ]);

  const [activeTab, setActiveTab] = useState<
    | "home"
    | "game"
    | "profile"
    | "skills"
    | "assets"
    | "users"
    | "roles"
    | "children"
    | "devices"
    | "menu"
    | "koda"
    | "admin"
    | "scoring"
    | "badges"
    | "billing"
    | "keys"
    | "system"
    | "settings"
  >("home");

  /*
   * Which child's record is open, if any.
   *
   * Held here rather than inside the Children page because the Profile page
   * opens it too — a child's card there goes straight to that child's record
   * rather than dropping the reader on a list to find them again.
   */
  const [childReport, setChildReport] = useState<string | null>(null);
  useEffect(() => {
    // Leaving the Children page closes the record behind you: coming back to a
    // tab you left should show the page, not the last thing you drilled into.
    if (activeTab !== "children") setChildReport(null);
  }, [activeTab]);

  // Active-tab state survives sign-out. Re-check the capability on every
  // account change so a parent cannot inherit an operator's open Menu page.
  useEffect(() => {
    if (activeTab === "menu" && !canManageMenu) setActiveTab("home");
    if (activeTab === "roles" && !canManageRoles) setActiveTab("home");
    if (activeTab === "children" && !canManageChildren) setActiveTab("home");
    if (activeTab === "assets" && !canEditArt) setActiveTab("home");
    if (activeTab === "skills" && !canManageSkills) setActiveTab("home");
    if (activeTab === "koda" && !canOperate) setActiveTab("home");
  }, [
    activeTab,
    canEditArt,
    canManageChildren,
    canManageMenu,
    canManageRoles,
    canManageSkills,
    canOperate,
  ]);
  /**
   * Sound and voice come from the family's preferences, not from state here.
   *
   * Both used to live in this component — voice purely in memory, so a reload
   * forgot it — which meant neither could follow a family to a second device.
   * Subscribing instead means a change made on a parent's laptop repaints these
   * switches when it lands.
   */
  useSyncExternalStore(PreferencesAPI.subscribe, PreferencesAPI.version, PreferencesAPI.version);
  const { soundEnabled, voiceEnabled } = PreferencesAPI.current();
  const { notice: systemNotice } = useSystem();
  const [activeLevelNumber, setActiveLevelNumber] = useState<number>(1);
  const lessonStartInFlight = useRef(false);
  const [lessonAccessError, setLessonAccessError] = useState<string | null>(null);
  /**
   * Whether the Learn tab is playing a round or offering the picker.
   *
   * The tab used to mount the activity directly, which only worked while one
   * skill existed: it opened whatever lesson `activeLevelNumber` pointed at and
   * gave a learner no way to reach a second skill.
   */
  const [inRound, setInRound] = useState<boolean>(false);
  // Read once, from the address bar, before anything else has an opinion.
  const [resetToken, setResetToken] = useState<string | null>(resetTokenFromUrl);
  const [verificationToken, setVerificationToken] = useState<string | null>(verificationTokenFromUrl);

  /*
   * The day's time cap, if this child's grown-up set one.
   *
   * Both stores are subscribed rather than read once: a parent changing the cap
   * on their phone reaches this tablet through sync, and the clock itself moves
   * while a round runs. `useSessionClock` is what advances it — only while a
   * round is actually open, so a child reading the Learn page is not spending
   * their afternoon.
   */
  useSessionClock(inRound);
  const { cap: sessionCap, dayDone } = useStudyGate();

  /**
   * Open a lesson, unless today's time is gone.
   *
   * The one door into a round, so the cap is checked once rather than at each
   * button that starts one. Checked on the way *in* and never mid-round: a
   * child two questions from finishing should finish, which means a capped day
   * can overrun by one round's length. That is the humane reading and it is
   * deliberate.
   */
  const startLesson = async (levelNumber: number) => {
    if (lessonStartInFlight.current) return;
    setLessonAccessError(null);
    /*
     * A lesson the plan does not cover is explained rather than opened.
     *
     * Here, with the study cap, because this is the one door — a padlock drawn
     * on the learning path is a hint, and a hint is all it can be while every
     * other way in (Home's band, a resume card, a deep link) exists. Asked
     * before the cap, and before the tab changes, so a child who cannot open it
     * is not first dropped onto an empty game screen.
     */
    const lesson = getLessonByLevel(levelNumber, viewer);

    /* A cached paid entitlement makes the path responsive and keeps it useful
     * offline, but an online start is authorized again by the API. The server
     * resolves the lesson tier itself and checks the effective subscription,
     * including cancellation and expiry; the browser's label grants nothing. */
    if (lesson) {
      lessonStartInFlight.current = true;
      try {
        await authorizeLesson(lesson.skillId, lesson.id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 402) {
          await Billing.refresh();
          requireFeature(PREMIUM_FEATURE, () => {});
          return;
        }
        if (error instanceof ApiError && error.isOffline && premiumLocked(lesson)) {
          /* Offline cannot re-check an expired grant. Free accounts still get
           * the useful plan explanation; a cached paid grant is the explicit
           * offline licence and continues below. */
          requireFeature(PREMIUM_FEATURE, () => {});
          return;
        }
        const mayUseOffline =
          error instanceof ApiError &&
          error.isOffline &&
          (!isPremiumLesson(lesson) || Billing.has(PREMIUM_FEATURE));
        if (!mayUseOffline) {
          setLessonAccessError(
            error instanceof Error ? error.message : "Could not verify access to this lesson.",
          );
          return;
        }
      } finally {
        lessonStartInFlight.current = false;
      }
    }

    setActiveTab("game");
    if (dayDone) {
      setInRound(false);
      return;
    }
    setActiveLevelNumber(levelNumber);
    setInRound(true);
  };
  const [selectedLearnSkillId, setSelectedLearnSkillId] = useState<string | null>(null);
  const viewer = useAudienceViewer();
  const [completedGameLevels, setCompletedGameLevels] =
    useState<Record<number, number>>(loadCompletedLevels);
  const [activeSkillId, setActiveSkillId] = useState<string>("stage_counting");
  const [studioMode, setStudioMode] = useState<"manipulatives" | "quickmath">("manipulatives");
  const [activeTopic, setActiveTopic] = useState<TopicCategory>("number_bonds");
  const [problemIndex, setProblemIndex] = useState(0);

  const [stageStars, setStageStars] = useState<Record<string, number>>({
    stage_counting: 3,
    stage_sorting: 2,
    stage_comparing: 2,
    stage_number_bonds: 3,
    stage_addition: 2,
    stage_subtraction: 1,
    stage_baseten: 2,
    stage_multiplication: 0,
    stage_fractions: 0,
  });

  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState(false);
  /*
   * Ask Koda in writing.
   *
   * A tap opens the voice coach wherever this deployment runs it — Koda is
   * something a child talks to — and this is the other half: where the voice
   * coach is switched off, and for a child who would rather type, which is one
   * tap away inside either panel. Both doors are wired here rather than in the
   * button, so the pair cannot get out of step.
   */
  const [isKodaAskOpen, setIsKodaAskOpen] = useState(false);
  /*
   * What Koda is told about, outside a round.
   *
   * This used to hand over `currentProblem` — an entry from `SAMPLE_PROBLEMS`,
   * which exists whatever screen is open — so a child asking for help on the
   * home page was answered about a balance-scale question they could not see,
   * and every conversation opened with Koda explaining the wrong thing. There
   * is no question on these screens, so Koda is told there is none and asked to
   * help with whatever the child brings.
   *
   * A round is the other case, and it does not come through here at all: the
   * round's own top bar passes the question being answered — see `SkillRound`.
   */
  const kodaContext: KodaContext = {
    topic: activeTopic,
    where: `The student is on the ${activeTab} screen of Koda and is not answering a question right now. Help with whatever they ask; do not assume a problem is on screen.`,
  };

  /** Voice -> writing, the way back out of a spoken session. */
  const kodaWrites = useKoda().access("chat").offered;
  const switchToWrittenKoda = () => {
    setIsLiveVoiceOpen(false);
    setIsKodaAskOpen(true);
  };
  const [soraState, setSoraState] = useState<"thinking" | "speaking" | "listening" | "cheering" | "idle">("idle");

  const [userProgress, setUserProgress] = useState<UserProgress>(loadProgress);
  // The record says what the run reached; this says what it reads as today, so
  // a round opened the morning after a missed day does not show a live streak.
  const streak = useStreak(userProgress);
  // Kept on this device, so a round played yesterday is still there today.
  useEffect(() => {
    saveProgress(userProgress);
  }, [userProgress]);

  useEffect(() => {
    saveCompletedLevels(completedGameLevels);
  }, [completedGameLevels]);

  /*
   * Whose record is on screen follows who is signed in.
   *
   * The progress and levels held here are read once at mount, which was right
   * while a device had exactly one record. It has one per learner now, so a
   * child signing in after their sibling — or on a second device, where their
   * record arrives from sync a moment after the sign-in that asked for it —
   * has to be re-read rather than left with whatever was loaded first.
   */
  const signedInLearner = session?.learnerId ?? null;
  useEffect(() => {
    const adopt = () => {
      setUserProgress(loadProgress());
      setCompletedGameLevels(loadCompletedLevels());
    };
    adopt();
    return subscribeLearnerRecord(adopt);
  }, [signedInLearner]);

  /*
   * The learner's own profile reads a stored row, not this device's memory, so
   * every figure it prints has to be written there — otherwise a child with a
   * live streak and real XP on Home opens their profile to the seeded sample
   * and a badge saying so.
   *
   * Only for a reading that is actually a learner's: an adult's row carries
   * children and permissions, and must not be overwritten with the progress of
   * whichever child last used the tablet.
   */
  const isLearnerReading = Boolean(
    session && (session.learnerId || session.role === "child" || session.role === "student"),
  );
  const starsEarned = Object.values(completedGameLevels).reduce((total, stars) => total + stars, 0);
  const lessonsMastered = Object.values(completedGameLevels).filter((stars) => stars > 0).length;
  const lessonsAvailable = getCourseLessons(viewer).length;
  // Measured against best-ever figures — `longestStreak`, not today's — so a
  // badge is never lost to a bad week. Re-read on every change, including a
  // rule an owner edits, which is what makes a new badge land straight away.
  useSyncExternalStore(BadgeAPI.subscribe, BadgeAPI.version);
  const badges = earnedBadges(BadgeAPI.current(), {
    xp: userProgress.xp,
    longestStreak: userProgress.longestStreak,
    starsEarned,
  })
    .map((rule) => rule.id)
    .join(",");
  useEffect(() => {
    if (!isLearnerReading) return;
    void publishLearnerFigures({
      // The streak as the rule reads it today, not the number the record
      // reached — a run that lapsed overnight must not be written back as live.
      dayStreak: streak.days,
      longestStreak: userProgress.longestStreak,
      totalXp: userProgress.xp,
      level: levelFromXp(userProgress.xp),
      starsEarned,
      lessonsMastered,
      lessonsAvailable,
      dailyGoal: userProgress.dailyGoal,
      dailySolved: streak.solvedToday,
      // Joined and split so the effect compares the list by value: a new array
      // of the same ids on every render would republish forever.
      badges: badges ? badges.split(",") : [],
    });
  }, [
    badges,
    isLearnerReading,
    streak.days,
    userProgress.longestStreak,
    streak.solvedToday,
    userProgress.xp,
    userProgress.level,
    userProgress.dailyGoal,
    starsEarned,
    lessonsMastered,
    lessonsAvailable,
  ]);


  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "m_1",
      sender: "koda",
      text: "Welcome to Synthesis Tutor! I'm Koda, your AI math coach. Let's build intuitive visual mental models together. Take a look at the interactive manipulative on screen!",
      timestamp: new Date(),
    },
  ]);

  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // Get active problem
  const currentProblemsList = SAMPLE_PROBLEMS[activeTopic] || SAMPLE_PROBLEMS.number_bonds || SAMPLE_PROBLEMS.balance_equations;
  const currentProblem: ProblemItem = currentProblemsList[problemIndex] || currentProblemsList[0];

  // Helper: Call Gemini TTS voice audio with browser speech fallback
  const speakText = async (text: string) => {
    if (!voiceEnabled || !text) return;
    try {
      setSoraState("speaking");
      const res = await fetch("/api/tutor/speech", {
        method: "POST",
        headers: await tutorHeaders(),
        body: JSON.stringify({ text, voice: "Kore" }),
      });
      const data = await res.json();
      if (data && data.audio) {
        playBase64Pcm(data.audio);
      } else {
        speakWebSpeech(text);
      }
    } catch {
      speakWebSpeech(text);
    } finally {
      setTimeout(() => setSoraState("idle"), 2500);
    }
  };

  // Helper: Call Socratic Tutor API Endpoint with full graceful fallback
  const sendToSora = async (userMessage: string, currentState?: any) => {
    setIsLoadingChat(true);
    setSoraState("thinking");

    // Add user message to feed
    const studentMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: "student",
      text: userMessage,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, studentMsg]);

    try {
      const res = await fetch("/api/tutor/respond", {
        method: "POST",
        headers: await tutorHeaders(),
        body: JSON.stringify({
          problem: currentProblem,
          state: currentState || {},
          userMessage,
          history: chatMessages.slice(-4),
          topic: activeTopic,
        }),
      });

      let data: any = null;
      if (res.ok) {
        data = await res.json();
      } else {
        data = generateLocalSocraticResponse(currentProblem, userMessage, currentState, activeTopic);
      }

      if (!data || !data.replyText) {
        data = generateLocalSocraticResponse(currentProblem, userMessage, currentState, activeTopic);
      }

      const soraMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: "sora",
        text: data.replyText || "Let's explore this step carefully together!",
        timestamp: new Date(),
        hintType: data.hintType,
        xpEarned: data.xpEarned || 0,
      };

      setChatMessages((prev) => [...prev, soraMsg]);

      if (data.isCorrect) {
        setSoraState("cheering");
        playSound("levelup");
        // Award XP & Increment Daily Solved
        setUserProgress((prev) => ({
          // Practice is practice, chat or round: the same call rolls the day
          // over and decides whether today has earned its day of streak.
          ...recordPractice(prev),
          xp: prev.xp + (data.xpEarned || 50),
          problemsSolved: prev.problemsSolved + 1,
        }));
      } else {
        setSoraState("speaking");
      }

      if (data.audioSpeechText) {
        speakText(data.audioSpeechText);
      } else {
        speakText(data.replyText);
      }
    } catch {
      // Local fallback on any network error
      const fallbackData = generateLocalSocraticResponse(currentProblem, userMessage, currentState, activeTopic);
      const soraMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: "sora",
        text: fallbackData.replyText,
        timestamp: new Date(),
        hintType: fallbackData.hintType,
        xpEarned: fallbackData.xpEarned,
      };
      setChatMessages((prev) => [...prev, soraMsg]);

      if (fallbackData.isCorrect) {
        setSoraState("cheering");
        playSound("levelup");
        setUserProgress((prev) => ({
          ...recordPractice(prev),
          xp: prev.xp + (fallbackData.xpEarned || 50),
          problemsSolved: prev.problemsSolved + 1,
        }));
      } else {
        setSoraState("speaking");
      }

      speakText(fallbackData.audioSpeechText || fallbackData.replyText);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Action: Request Socratic hint
  const handleRequestHint = () => {
    const hint =
      currentProblem.socraticHints[
        Math.floor(Math.random() * currentProblem.socraticHints.length)
      ] || "Look closely at how changing one part affects the whole visual model!";
    sendToSora(`Koda, can you give me a Socratic hint about ${currentProblem.title}?`);
  };

  // Action: Manipulative solve attempt
  const handleSolveAttempt = (attemptValue: any) => {
    sendToSora(
      `I tested a configuration on the visual manipulative: ${JSON.stringify(attemptValue)}. Does this balance or solve the problem?`
    );
  };

  // The lesson at this position decides which skill runs. Hardcoding
  // "counting/quest" here worked while counting was the only skill and sent
  // every other skill's lessons into the counting game the moment a second one
  // registered — the course already knows the answer, so ask it.
  const activeLesson = getLessonByLevel(activeLevelNumber, viewer);

  const lessonHost = (
    <SkillHost
      key={activeLesson?.ref ?? activeLevelNumber}
      activityRef={activeLesson?.activity ?? "counting/quest"}
      params={{ level: activeLevelNumber, ...(activeLesson?.params ?? {}) }}
      level={activeLevelNumber}
      lesson={
        // Without this the learning log is a silent no-op — the SDK refuses to
        // record events it cannot attribute to a concept.
        activeLesson?.conceptKey
          ? {
              lessonId: activeLesson.id,
              conceptKey: activeLesson.conceptKey,
              standards: activeLesson.standards,
              ageBand: activeLesson.ageBand,
              title: activeLesson.title,
              concept: activeLesson.concept,
              totalLessons: totalLessonCount(viewer),
              // Which kind of round this is, decided once by the course: the
              // chrome reads it to stop repeating the word, and every event
              // carries it so speed can be read off practice alone.
              practice: isPracticeLesson(activeLesson),
            }
          : undefined
      }
      snapshot={{
        ...userProgress,
        level: levelFromXp(userProgress.xp),
        streakDays: streak.days,
        streakCadence: streak.cadence,
        dailySolved: streak.solvedToday,
      }}
      onExit={() => setInRound(false)}
      onAwardXp={(earnedXp) =>
        setUserProgress((prev) => ({ ...prev, xp: prev.xp + earnedXp }))
      }
      onComplete={(result) => {
        setUserProgress((prev) => ({
          ...recordPractice(prev),
          problemsSolved: prev.problemsSolved + 1,
        }));
        setCompletedGameLevels((prev) => ({
          ...prev,
          // Best ever, not most recent: a level's stars are what the learner has
          // shown they can do, so replaying it and having an off day must never
          // take a star away. Counting already kept the maximum internally; the
          // app's copy — the one the Learn page reads — did not.
          [result.levelNumber]: Math.max(prev[result.levelNumber] ?? 0, result.stars),
        }));
      }}
    />
  );

  /**
   * Sign-in is required to reach the app.
   *
   * Worth knowing what this costs: the session lives in `localStorage`, so a
   * device that has signed in once still plays with no connection — but a
   * device that never has cannot get past this screen, which is the one place
   * Koda now needs a network. Removing the gate is deleting these four lines.
   */
  /*
   * A reset link stands in front of the gate, not behind it.
   *
   * Somebody arriving on one cannot sign in — that is the whole reason they are
   * here — so showing them the sign-in screen would be a closed door with the
   * key taped to the other side. Read once at mount: the token is on the URL,
   * and the screen clears it as soon as it has been spent.
   */
  if (verificationToken) {
    return (
      <VerifyEmailScreen
        token={verificationToken}
        onDone={() => setVerificationToken(null)}
      />
    );
  }

  if (resetToken) {
    return <ResetPasswordScreen token={resetToken} onDone={() => setResetToken(null)} />;
  }

  if (!session) {
    return <SignInScreen />;
  }

  /*
   * A round takes the whole screen.
   *
   * The rail was left up mid-lesson so it stayed reachable — but what it shows a
   * five-year-old counting crowns is Users, Roles, Devices and the art library.
   * The round's own top bar already carries an exit, so nothing is lost by
   * standing the shell down, and what is gained is that the activity is the only
   * thing on screen.
   */
  const inLesson = activeTab === "game" && inRound;

  return (
    <MainLayout
      // Only a running round wants the full width; the picker is a normal page.
      contained={!inLesson}
      /* Two shells, each hiding itself at the width that is not its own — the
         rail from `rail:` up, the toolbar and tab bar below it. A round stands
         both of them down: what a rail shows a five-year-old counting crowns is
         Users, Roles, Devices and the art library, and the round's own top bar
         already carries the way out. */
      sidebar={
        inLesson ? null : (
          <SidebarNav
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
          />
        )
      }
      nav={
        inLesson ? null : (
          <AppNav
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
            userProgress={userProgress}
          />
        )
      }
    >
      <>
        {/* The operator's message to everybody, when there is one. Above the
            tabs on purpose: it is the one thing that is not about the page. */}
        {systemNotice && (
          <div className="mb-4">
            <p className={themeSystem.flash("warning")}>
              <Megaphone className="w-4 h-4 inline mr-1.5" />
              {systemNotice}
            </p>
          </div>
        )}

        {lessonAccessError && (
          <div className="mb-4">
            <p className={themeSystem.flash("error")}>{lessonAccessError}</p>
          </div>
        )}

        {/* TAB 1: THE ACTIVE LESSON'S SKILL — inside the shell, so the sidebar stays
            reachable mid-lesson. contained={false} lets it use the full width. */}
        {activeTab === "game" &&
          (inRound ? (
            lessonHost
          ) : dayDone && sessionCap !== null ? (
            /* Stands in for the picker rather than sitting beside it: a path a
               child can still tap is a path they will keep tapping. */
            <DayDoneScreen cap={sessionCap} onGoHome={() => setActiveTab("home")} />
          ) : selectedLearnSkillId ? (
            <LearnPage
              skillId={selectedLearnSkillId}
              completedLevels={completedGameLevels}
              onBack={() => setSelectedLearnSkillId(null)}
              onStartLesson={startLesson}
            />
          ) : (
            <SkillCatalogPage
              activeLevelNumber={activeLevelNumber}
              completedLevels={completedGameLevels}
              onSelectSkill={setSelectedLearnSkillId}
            />
          ))}

        {/* TAB 0: CREATIVE LEARNING PATHWAY HOME HUB */}
          {activeTab === "home" && (
            <Home
              userProgress={userProgress}
              completedLevels={completedGameLevels}
              onStartLesson={startLesson}
              onOpenSkill={(skillId) => {
                setSelectedLearnSkillId(skillId);
                setInRound(false);
                setActiveTab("game");
              }}
              onBrowseSkills={() => {
                setSelectedLearnSkillId(null);
                setInRound(false);
                setActiveTab("game");
              }}
            />
          )}

          {/* TAB: PLUGIN MANAGER — its own destination, not buried in Settings */}
          {activeTab === "skills" && canManageSkills && (
            <Deferred label="Loading Skill Manager">
              <SkillManagerPage />
            </Deferred>
          )}

          {/* TAB: SVG COLLECTION — what is in src/assets/svg, drawn */}
          {activeTab === "assets" && canEditArt && (
            <Deferred label="Loading art library">
              <SvgAssetsPage />
            </Deferred>
          )}

          {/* TAB: PROFILE — the same page for a child, a parent and staff; only
              the numbers under the banner change. */}
          {activeTab === "profile" && (
            <ProfilePage
              onNavigate={(tab, learnerId) => {
                if (tab === "game") setInRound(false);
                // A child's card carries their id, so the Children tab opens on
                // that child rather than on the list.
                setChildReport(learnerId ?? null);
                setActiveTab(tab);
              }}
            />
          )}

          {activeTab === "users" && (
            <Deferred label="Loading users">
              <UsersPage />
            </Deferred>
          )}

          {activeTab === "roles" && canManageRoles && (
            <Deferred label="Loading roles">
              <RolesPage />
            </Deferred>
          )}

          {activeTab === "children" && (
            <LearnersPage reportFor={childReport} onOpenReport={setChildReport} />
          )}

          {activeTab === "devices" && <DevicesPage />}

          {activeTab === "menu" && canManageMenu && (
            <Deferred label="Loading menu">
              <MenuPage />
            </Deferred>
          )}

          {/* The assistant's own page. Same right as Admin, and gated here as
              well as in the menu: a tab id survives a sign-out. */}
          {activeTab === "koda" && canOperate && (
            <Deferred label="Loading Ask Koda">
              <KodaPage />
            </Deferred>
          )}

          {/* Their own pages, not Settings cards: each is gated by its own
              right, and a card inside a page everyone can open cannot be. */}
          {/* Two doors, because they are two different jobs. Settings is the
              family's own; Admin is what one operator decides for everybody. */}
          {(activeTab === "admin" ||
            activeTab === "scoring" ||
            activeTab === "badges" ||
            activeTab === "billing" ||
            activeTab === "keys" ||
            activeTab === "system") && (
            <Deferred label="Loading Admin">
              <AdminPage
                initialTab={
                  activeTab === "admin"
                    ? undefined
                    : (activeTab as "scoring" | "badges" | "billing" | "keys" | "system")
                }
              />
            </Deferred>
          )}

          {activeTab === "settings" && (
            <SettingsPage
              soundEnabled={soundEnabled}
              onToggleSound={() => PreferencesAPI.update({ soundEnabled: !soundEnabled })}
              voiceEnabled={voiceEnabled}
              onToggleVoice={() => PreferencesAPI.update({ voiceEnabled: !voiceEnabled })}
              /* On a phone this page is also the way to Profile and the
                 management pages — the tab bar carries four destinations, not
                 thirteen. Ignored from `rail:` up, where the sidebar has them
                 all and the section hides itself. */
              activeTab={activeTab}
              onSelectTab={(tab) => setActiveTab(tab)}
            />
          )}
      </>

      {/*
        * Ask Koda, floating bottom-right on every screen except a running round
        * — the round's top bar carries its own Ask Koda button, opening the same
        * panel on the question being answered, and a floating one over the
        * activity would sit on top of what the child is working on.
        */}
      {/*
        * And not while Koda is already on screen talking.
        *
        * The button *is* Koda — so with the voice coach open there were two of
        * them in the same corner, one listening and one waiting to be asked. A
        * child tapping the wrong one is the least of it: two copies of the same
        * character, in two different states, is the app disagreeing with itself
        * about where Koda is.
        */}
      {!inLesson && !isLiveVoiceOpen && !isKodaAskOpen && (
        <KodaFab
          onAsk={(mode) => (mode === "voice" ? setIsLiveVoiceOpen(true) : setIsKodaAskOpen(true))}
        />
      )}

      <KodaAskModal
        isOpen={isKodaAskOpen}
        onClose={() => setIsKodaAskOpen(false)}
        onStartVoice={() => setIsLiveVoiceOpen(true)}
        context={kodaContext}
      />

      {/* Mounted once. Any `requireFeature` call anywhere in the app shows it. */}
      <UpgradePrompt onOpenPlan={() => setActiveTab("settings")} />

      {/* Global Gemini Live Voice Coach Modal */}
      <LiveVoiceCoachModal
        isOpen={isLiveVoiceOpen}
        onClose={() => setIsLiveVoiceOpen(false)}
        onSwitchToText={kodaWrites ? switchToWrittenKoda : undefined}
        currentLevel={levelFromXp(userProgress.xp)}
        currentTopic={kodaContext.topic}
        currentQuestionText={kodaContext.question}
        currentProblemContext={kodaContext.where}
        studentName="Student"
        onAwardXp={(earnedXp) => {
          setUserProgress((prev) => ({
            ...prev,
            xp: prev.xp + earnedXp,
          }));
        }}
      />
    </MainLayout>
  );
}
