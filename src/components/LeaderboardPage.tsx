import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  Copy,
  Globe2,
  Link2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from "lucide-react";

import { SvgAsset } from "../assets/svg";
import { artAvatarId, artAvatarSeed } from "../lib/avatar";
import {
  Buddy,
  BuddyInvite,
  LeaderboardAPI,
  LeaderboardPrivacy,
  WeeklyLeaderboard,
} from "../lib/leaderboardApi";
import { ApiError, accessToken, request, usePermissions, useSession } from "../lib/sync";
import { playSound } from "../utils/audio";
import { useIsCompact } from "../lib/useBreakpoint";
import {
  UIAvatar,
  UIBadge,
  UIButton,
  UICard,
  UIDialog,
  UIFlashMessage,
  UIModal,
  UIPageHeader,
  UIPageLoader,
  UISectionHeader,
  UISpinner,
} from "./ui";

interface LearnerChoice {
  id: string;
  displayName: string;
  avatarSeed: string;
}

type LeaderboardAvatarArt = "avatar-fox" | "avatar-mango" | "avatar-penguin" | "avatar-comet" | "avatar-otter";

const avatarArtFor = (name: string): LeaderboardAvatarArt | undefined => {
  const normalized = name.toLocaleLowerCase();
  if (normalized.includes("fox")) return "avatar-fox";
  if (normalized.includes("mango")) return "avatar-mango";
  if (normalized.includes("penguin") || normalized.includes("ngi")) return "avatar-penguin";
  if (normalized.includes("comet") || normalized.includes("blue")) return "avatar-comet";
  if (normalized.includes("otter")) return "avatar-otter";
  return undefined;
};

const leaderboardAvatarSeed = (name: string, stored?: string | null): string | undefined => {
  if (artAvatarId(stored ?? undefined)) return stored ?? undefined;
  const fallback = avatarArtFor(name);
  return fallback ? artAvatarSeed(fallback) : stored ?? undefined;
};

const codePattern = /^KODA-[A-HJ-NP-Z2-9]{6}$/i;

const friendlyWeek = (start: string, end: string): string => {
  const format = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${format.format(new Date(`${start}T12:00:00`))} – ${format.format(new Date(`${end}T12:00:00`))}`;
};

const rankTone = (rank: number): string => {
  if (rank === 1) return "bg-amber-100 text-amber-800 border-amber-300";
  if (rank === 2) return "bg-slate-100 text-slate-700 border-slate-300";
  if (rank === 3) return "bg-orange-100 text-orange-800 border-orange-300";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
};

export const LeaderboardPage: React.FC = () => {
  const isCompact = useIsCompact();
  const session = useSession();
  const { can } = usePermissions();
  const canConsent = can("leaderboard:consent");
  const canManage = can("buddy:manage");
  const [learners, setLearners] = useState<LearnerChoice[]>([]);
  const [learnerId, setLearnerId] = useState(session?.learnerId ?? "");
  const [privacy, setPrivacy] = useState<LeaderboardPrivacy | null>(null);
  const [board, setBoard] = useState<WeeklyLeaderboard | null>(null);
  const [publicBoard, setPublicBoard] = useState<WeeklyLeaderboard | null>(null);
  const [boardScope, setBoardScope] = useState<"buddies" | "public">("buddies");
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [consentVisibility, setConsentVisibility] = useState<"buddies" | "public">("buddies");
  const [invite, setInvite] = useState<BuddyInvite | null>(null);
  const [buddyCode, setBuddyCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<Buddy | null>(null);
  const [blocking, setBlocking] = useState<Buddy | null>(null);
  const [buddySearch, setBuddySearch] = useState("");
  const [manageOpen, setManageOpen] = useState(false);

  const selectedLearner = useMemo(
    () => learners.find((learner) => learner.id === learnerId),
    [learnerId, learners],
  );

  const loadLearners = useCallback(async () => {
    const token = await accessToken();
    const response = await request<{ learners: LearnerChoice[] }>("/learners", { token });
    setLearners(response.learners);
    if (response.learners.length === 0) setLoading(false);
    setLearnerId((current) => {
      if (session?.learnerId) return session.learnerId;
      return response.learners.some((learner) => learner.id === current)
        ? current
        : (response.learners[0]?.id ?? "");
    });
  }, [session?.learnerId]);

  const loadBoard = useCallback(async (target: string, quiet = false, signal?: AbortSignal) => {
    if (!target) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [nextPrivacy, nextBoard, nextPublicBoard, nextBuddies] = await Promise.all([
        LeaderboardAPI.privacy(target, signal),
        LeaderboardAPI.weekly(target, signal),
        LeaderboardAPI.publicWeekly(target, signal),
        LeaderboardAPI.buddies(target, signal),
      ]);
      setPrivacy(nextPrivacy);
      setBoard(nextBoard);
      setPublicBoard(nextPublicBoard);
      setBuddies(nextBuddies);
      setNickname(nextPrivacy.nickname ?? "");
    } catch (caught) {
      if (!signal?.aborted) setError((caught as ApiError).message);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void loadLearners().catch((caught) => {
      setError((caught as ApiError).message);
      setLoading(false);
    });
  }, [loadLearners]);

  useEffect(() => {
    if (!learnerId) return;
    const controller = new AbortController();
    // Never leave one child's board on screen while another child's private
    // state is loading after the selector changes.
    setPrivacy(null);
    setBoard(null);
    setPublicBoard(null);
    setBuddies([]);
    void loadBoard(learnerId, false, controller.signal);
    return () => controller.abort();
  }, [learnerId, loadBoard]);

  const enableSharing = async () => {
    if (!learnerId || !confirmed || nickname.trim().length < 2) return;
    setBusy("consent");
    setError(null);
    try {
      await LeaderboardAPI.setPrivacy(learnerId, consentVisibility, nickname.trim());
      setConsentOpen(false);
      setConfirmed(false);
      setNotice(
        consentVisibility === "public"
          ? "This learner is now included on the public leaderboard."
          : "Leaderboard sharing is on for approved buddies only.",
      );
      playSound("success");
      await loadBoard(learnerId, true);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const stopSharing = async () => {
    if (!learnerId) return;
    setBusy("privacy");
    try {
      await LeaderboardAPI.setPrivacy(learnerId, "private");
      setNotice("Sharing stopped. This learner disappeared from all leaderboards.");
      await loadBoard(learnerId, true);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const createCode = async () => {
    if (!learnerId) return;
    setBusy("invite");
    setError(null);
    try {
      setInvite(await LeaderboardAPI.createInvite(learnerId));
      setCopied(false);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const addBuddy = async () => {
    if (!learnerId || !codePattern.test(buddyCode.trim())) return;
    setBusy("accept");
    setError(null);
    try {
      await LeaderboardAPI.acceptInvite(learnerId, buddyCode);
      setBuddyCode("");
      setNotice("Buddy added. Sharing remains a separate choice for each learner.");
      await loadBoard(learnerId, true);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const removeBuddy = async (buddy: Buddy, block = false) => {
    if (!learnerId) return;
    setBusy(`${block ? "block" : "remove"}:${buddy.relationshipId}`);
    try {
      if (block) await LeaderboardAPI.blockBuddy(learnerId, buddy.relationshipId);
      else await LeaderboardAPI.removeBuddy(learnerId, buddy.relationshipId);
      setNotice(block ? "Buddy blocked and removed." : "Buddy removed.");
      await loadBoard(learnerId, true);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const copyInvite = async () => {
    if (!invite?.code) return;
    await navigator.clipboard?.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading && !privacy && learners.length === 0) return <UIPageLoader label="Loading buddy leaderboard" />;

  if (!learnerId) {
    return (
      <div className="mx-auto max-w-5xl py-8">
        <UIFlashMessage type="info" title="No learner profile" message="Add or select a learner profile before opening the buddy leaderboard." />
      </div>
    );
  }

  const sharedCount = buddies.filter((buddy) => buddy.sharingEnabled).length;
  const activeBoard = boardScope === "public" ? publicBoard : board;
  const filteredBuddies = buddies.filter((buddy) =>
    (buddy.nickname ?? "Private buddy").toLocaleLowerCase().includes(buddySearch.trim().toLocaleLowerCase()),
  );
  const participating = boardScope === "public"
    ? privacy?.visibility === "public"
    : privacy?.sharingEnabled === true;
  const switchingLearner = loading && !privacy && learners.length > 0;
  const yourRow = activeBoard?.rows.find((row) => row.isYou);
  const leadingXp = activeBoard?.rows[0]?.weeklyXp ?? 0;
  const weeklyProgress = yourRow && leadingXp > 0
    ? Math.max(8, Math.min(100, Math.round((yourRow.weeklyXp / leadingXp) * 100)))
    : 0;

  return (
    <div className="min-h-full bg-white dark:bg-canvas">
      <div className="mx-auto max-w-6xl space-y-5">
        <UIPageHeader
          eyebrow="Friends & progress"
          title="Leaderboards"
          subtitle="Choose a public challenge or a private board with approved buddies."
          action={!isCompact ? (
            <UIButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={refreshing ? "animate-spin" : ""} />}
              onClick={() => void loadBoard(learnerId, true)}
              disabled={refreshing}
              aria-label="Refresh leaderboard"
            >
              Refresh
            </UIButton>
          ) : undefined}
        />

        {learners.length > 1 && !session?.learnerId && !(isCompact && manageOpen) && (
          <section className="max-w-2xl" aria-labelledby="leaderboard-learner-label">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="leaderboard-learner-label" className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Choose player
              </h2>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                {selectedLearner?.displayName}
              </span>
            </div>
            <UICard
              className={`grid grid-cols-2 gap-2 p-2 ${learners.length === 3 ? "min-[30rem]:grid-cols-3" : learners.length >= 4 ? "min-[30rem]:grid-cols-4" : ""}`}
              role="radiogroup"
              aria-labelledby="leaderboard-learner-label"
            >
              {learners.map((learner) => {
                const selected = learner.id === learnerId;
                return (
                  <button
                    key={learner.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setLearnerId(learner.id)}
                    className={`flex min-h-14 min-w-0 items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300/60 ${selected ? "border-indigo-700 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-600" : "border-transparent bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/50"}`}
                  >
                    <UIAvatar
                      name={learner.displayName}
                      seed={learner.avatarSeed}
                      size="sm"
                      decorative
                      className={selected ? "ring-2 ring-white/80" : ""}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-black">{learner.displayName}</span>
                    {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </UICard>
          </section>
        )}

        {error && <UIFlashMessage type="error" title="Couldn’t update the leaderboard" message={error} onClose={() => setError(null)} />}
        {notice && <UIFlashMessage type="success" message={notice} onClose={() => setNotice(null)} />}

        {switchingLearner ? (
          <UICard className="flex min-h-48 items-center justify-center p-5" aria-live="polite">
            <div className="flex flex-col items-center gap-3 text-center">
              <UISpinner size="md" label={`Loading ${selectedLearner?.displayName ?? "player"} leaderboard`} />
              <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
                Loading {selectedLearner?.displayName ?? "player"}…
              </p>
            </div>
          </UICard>
        ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.8fr)]">
          {(!isCompact || !manageOpen) && (
          <section className="space-y-4" aria-labelledby="weekly-ranking-title">
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800" role="tablist" aria-label="Leaderboard type">
              <button
                type="button"
                role="tab"
                aria-selected={boardScope === "buddies"}
                onClick={() => setBoardScope("buddies")}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${boardScope === "buddies" ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}
              >
                <Users className="h-4 w-4" /> Buddies
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={boardScope === "public"}
                onClick={() => setBoardScope("public")}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${boardScope === "public" ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}
              >
                <Globe2 className="h-4 w-4" /> Public
              </button>
            </div>

            {boardScope === "buddies" && !privacy?.sharingEnabled ? (
              <UICard className="overflow-hidden border-indigo-200 p-4 text-center rail:p-5">
                <span className="inline-flex items-center rounded-full border-2 border-[#F0B90B] bg-white px-2.5 py-1 text-xs font-black text-[#0B0E11] dark:bg-slate-900 dark:text-white">
                  <LockKeyhole className="mr-1 h-3 w-3 text-[#F0B90B]" /> Not sharing
                </span>
                <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-white">You’re private by default</h2>
                <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-slate-600 dark:text-slate-300 rail:text-sm">Choose Buddies only or Public. Nothing is shared until an eligible account confirms it.</p>
                <div className="mx-auto mt-4 flex max-w-xs items-end justify-center" aria-hidden="true">
                  {selectedLearner && (
                    <UIAvatar
                      name={selectedLearner.displayName}
                      seed={selectedLearner.avatarSeed}
                      size="lg"
                      decorative
                      className="-mr-2 border-4 border-white dark:border-slate-950"
                    />
                  )}
                  <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-indigo-500 to-violet-700 text-white">
                    <LockKeyhole className="h-9 w-9" />
                  </div>
                  <span className="-ml-2 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-cyan-100 text-cyan-700 dark:border-slate-950 dark:bg-cyan-950 dark:text-cyan-300">
                    <Users className="h-7 w-7" />
                  </span>
                </div>
                <div className="mx-auto mt-4 max-w-lg rounded-2xl border border-sky-200 bg-sky-50 p-3 text-left dark:border-sky-900 dark:bg-sky-950/40">
                  {["Nickname and avatar", "Weekly XP and rank", "No email, age, real name, or lesson details"].map((item) => (
                    <div key={item} className="flex items-center gap-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 rail:text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-3.5 w-3.5" /></span>
                      {item}
                    </div>
                  ))}
                </div>
                {canConsent ? (
                  <div className="mt-4 flex flex-col justify-center gap-2 rail:flex-row">
                    <UIButton className="w-full rail:w-auto" size="md" icon={<Users />} onClick={() => { setConsentVisibility("buddies"); setConsentOpen(true); }}>Buddies only</UIButton>
                    <UIButton className="w-full rail:w-auto" variant="outline" size="md" icon={<Globe2 />} onClick={() => { setConsentVisibility("public"); setConsentOpen(true); }}>Join public</UIButton>
                  </div>
                ) : (
                  <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    Ask a parent or account owner to turn on sharing.
                  </p>
                )}
              </UICard>
            ) : (
              <>
                <UICard className={`bg-white p-4 dark:bg-slate-900 ${boardScope === "public" ? "border-violet-200 dark:border-violet-900" : "border-cyan-200 dark:border-cyan-900"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <UIBadge variant={participating ? "success" : "neutral"}>
                      {boardScope === "public" ? <Globe2 className="mr-1 h-3.5 w-3.5" /> : <Users className="mr-1 h-3.5 w-3.5" />}
                      {boardScope === "public"
                        ? participating ? "Included publicly" : "Viewing only"
                        : `Sharing with ${sharedCount} ${sharedCount === 1 ? "buddy" : "buddies"}`}
                    </UIBadge>
                    {boardScope === "public" ? <Globe2 className="h-8 w-8 text-violet-500" aria-hidden="true" /> : <SvgAsset id="trophy" size={36} />}
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <h2 id="weekly-ranking-title" className="text-lg font-black text-slate-950 dark:text-white">This week</h2>
                      {activeBoard && <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{friendlyWeek(activeBoard.weekStart, activeBoard.weekEnd)} · resets Monday</p>}
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Top 20 + you</span>
                  </div>
                  {yourRow && (
                    <div className="mt-3 rounded-2xl border border-white/80 bg-white/80 p-3 text-left dark:border-slate-700 dark:bg-slate-900/70">
                      <div className="flex items-center gap-3">
                        <SvgAsset id="weekly-progress" size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-700 dark:text-slate-200">
                            <span>Your weekly progress</span>
                            <span className="tabular-nums">{yourRow.weeklyXp.toLocaleString()} XP</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width]" style={{ width: `${weeklyProgress}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {boardScope === "public" && !participating && canConsent && (
                    <UIButton className="mt-4" size="sm" icon={<Globe2 />} onClick={() => { setConsentVisibility("public"); setConsentOpen(true); }}>Join public leaderboard</UIButton>
                  )}
                </UICard>

                <div>
                  {activeBoard?.rows.length ? (
                    <ol className="space-y-2" aria-label={`Weekly ${boardScope} rankings`}>
                      {activeBoard.rows.map((row, index) => (
                        <React.Fragment key={`${row.rank}:${row.nickname}`}>
                        {index === 20 && row.isYou && <li className="py-1 text-center text-xs font-black uppercase tracking-widest text-slate-400">Your position</li>}
                        <li
                          className={`flex items-center gap-3 rounded-2xl border-2 bg-transparent px-3 py-3 rail:px-4 ${row.isYou ? "border-violet-300 dark:border-violet-700" : "border-slate-200 dark:border-slate-700"}`}
                        >
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${rankTone(row.rank)}`} aria-label={`Rank ${row.rank}`}>{row.rank}</span>
                          <UIAvatar name={row.nickname} seed={leaderboardAvatarSeed(row.nickname, row.avatarSeed)} size="md" decorative />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-black text-slate-950 dark:text-white">{row.isYou ? "You" : row.nickname}</p>
                            {row.isYou && <p className="truncate text-xs font-semibold text-violet-600 dark:text-violet-300">{row.nickname}</p>}
                          </div>
                          <span className="shrink-0 font-black tabular-nums text-slate-800 dark:text-slate-100">{row.weeklyXp.toLocaleString()} XP</span>
                        </li>
                        </React.Fragment>
                      ))}
                    </ol>
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <SvgAsset id="trophy" size={56} className="mx-auto" />
                      <h3 className="mt-3 font-black text-slate-900 dark:text-white">No scores yet this week</h3>
                      <p className="mt-1 text-sm text-slate-500">Complete a lesson to place on the board.</p>
                    </div>
                  )}
                </div>

                {canConsent && privacy?.sharingEnabled && (
                  <div className="grid gap-2 rail:grid-cols-2">
                    <UIButton variant="secondary" fullWidth onClick={() => { setConsentVisibility(privacy.visibility === "public" ? "public" : "buddies"); setConsentOpen(true); }}>
                      Change sharing option
                    </UIButton>
                    <UIButton variant="outline" fullWidth isLoading={busy === "privacy"} onClick={() => void stopSharing()}>
                      Make private
                    </UIButton>
                  </div>
                )}
              </>
            )}

            {isCompact && (
              <UIButton variant="secondary" fullWidth icon={<UserRoundPlus />} onClick={() => setManageOpen((open) => !open)} aria-expanded={manageOpen}>
                {manageOpen ? "Hide buddy management" : `Manage buddies (${buddies.length})`}
              </UIButton>
            )}
          </section>
          )}

          {(!isCompact || manageOpen) && (
          <section className="space-y-4" aria-labelledby="manage-buddies-title">
            {isCompact && (
              <div className="flex items-center gap-2">
                <UIButton
                  variant="ghost"
                  size="icon"
                  icon={<ChevronLeft />}
                  aria-label="Back to leaderboard"
                  onClick={() => setManageOpen(false)}
                />
                <div className="min-w-0">
                  <h2 id="manage-buddies-title" className="text-xl font-black text-slate-950 dark:text-white">Manage buddies</h2>
                  <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {selectedLearner ? `Connections for ${selectedLearner.displayName}` : "Private connections"}
                  </p>
                </div>
              </div>
            )}
            <UICard className="border-orange-200 p-4 dark:border-orange-900/70 rail:p-5">
              <UISectionHeader
                title={<span id={isCompact ? undefined : "manage-buddies-title"}>{isCompact ? "Buddy code" : "Manage buddies"}</span>}
                subtitle={isCompact ? undefined : selectedLearner ? `Connections for ${selectedLearner.displayName}` : "Private connections"}
                icon={<UserRoundPlus className="h-5 w-5 text-orange-500" />}
              />
              {canManage ? (
                <div className="mt-4 space-y-4">
                  {isCompact && invite?.code ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-lg font-black tracking-wider text-slate-950 dark:text-white">{invite.code}</span>
                        <UIButton size="sm" icon={copied ? <Check /> : <Copy />} onClick={() => void copyInvite()}>{copied ? "Copied" : "Copy code"}</UIButton>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Expires in 15 minutes and works once.</p>
                    </div>
                  ) : (
                    <UIButton fullWidth variant="secondary" icon={<Link2 />} isLoading={busy === "invite"} onClick={() => void createCode()}>
                      Create buddy code
                    </UIButton>
                  )}
                  <div>
                    <label htmlFor="buddy-code" className="text-sm font-bold text-slate-800 dark:text-slate-100">Enter a buddy code</label>
                    <input
                      id="buddy-code"
                      value={buddyCode}
                      onChange={(event) => setBuddyCode(event.target.value.toUpperCase())}
                      placeholder="KODA-XXXXXX"
                      maxLength={11}
                      autoCapitalize="characters"
                      className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 font-mono text-lg font-black uppercase tracking-wider text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <UIButton fullWidth icon={<Plus />} isLoading={busy === "accept"} disabled={!codePattern.test(buddyCode.trim())} onClick={() => void addBuddy()}>
                    Add buddy
                  </UIButton>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">A parent or account owner manages buddy connections.</p>
              )}
            </UICard>

            <UICard className="p-5">
              <UISectionHeader title="Your buddies" subtitle={`${buddies.length} connected`} icon={<Users className="h-5 w-5 text-cyan-600" />} />
              {buddies.length > 5 && (
                <label className="relative mt-4 block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <span className="sr-only">Search buddies</span>
                  <input
                    value={buddySearch}
                    onChange={(event) => setBuddySearch(event.target.value)}
                    placeholder="Search buddies"
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              )}
              <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
                {filteredBuddies.length ? filteredBuddies.map((buddy) => (
                  <div key={buddy.relationshipId} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                    <UIAvatar
                      name={buddy.nickname ?? "Private buddy"}
                      seed={leaderboardAvatarSeed(buddy.nickname ?? "", buddy.avatarSeed)}
                      size="sm"
                      decorative
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900 dark:text-white">{buddy.nickname ?? "Private buddy"}</p>
                      <p className="text-xs text-slate-500">{buddy.sharingEnabled ? "Sharing leaderboard" : "Leaderboard hidden"}</p>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" className="rounded-xl px-2 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40" onClick={() => setRemoving(buddy)}>Remove</button>
                        <button type="button" className="rounded-xl px-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" onClick={() => setBlocking(buddy)}>Block</button>
                      </div>
                    )}
                  </div>
                )) : buddies.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
                    <Search className="mx-auto h-9 w-9 text-slate-300" />
                    <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">No buddies match “{buddySearch}”</p>
                    <button type="button" className="mt-2 text-xs font-black text-indigo-600" onClick={() => setBuddySearch("")}>Clear search</button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
                    <Users className="mx-auto h-9 w-9 text-slate-300" />
                    <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">No buddies yet</p>
                    <p className="mt-1 text-xs text-slate-500">Use a one-time code to connect safely.</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2 rounded-2xl bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Adding a buddy never turns on leaderboard sharing.
              </div>
            </UICard>
          </section>
          )}
        </div>
        )}
      </div>

      <UIModal isOpen={consentOpen} onClose={() => !busy && setConsentOpen(false)} title="Choose leaderboard sharing" maxWidth="max-w-lg" tone="plain">
        <div className="space-y-5">
          <div className="grid gap-2 rail:grid-cols-2" role="radiogroup" aria-label="Who can see this learner">
            <button
              type="button"
              role="radio"
              aria-checked={consentVisibility === "buddies"}
              onClick={() => { setConsentVisibility("buddies"); setConfirmed(false); }}
              className={`rounded-2xl border-2 p-4 text-left ${consentVisibility === "buddies" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-700"}`}
            >
              <Users className="h-5 w-5 text-cyan-600" />
              <span className="mt-2 block font-black text-slate-900 dark:text-white">Buddies only</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Only direct, accepted buddies.</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={consentVisibility === "public"}
              onClick={() => { setConsentVisibility("public"); setConfirmed(false); }}
              className={`rounded-2xl border-2 p-4 text-left ${consentVisibility === "public" ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40" : "border-slate-200 dark:border-slate-700"}`}
            >
              <Globe2 className="h-5 w-5 text-violet-600" />
              <span className="mt-2 block font-black text-slate-900 dark:text-white">Public</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Any signed-in Koda learner.</span>
            </button>
          </div>
          <div className={`rounded-2xl border p-4 text-sm leading-6 ${consentVisibility === "public" ? "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100" : "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100"}`}>
            {consentVisibility === "public" ? "Any signed-in Koda learner can see" : "Approved buddies can see"} only this nickname, avatar, weekly XP, and rank. A real name, email, age, family, and lesson details stay private.
          </div>
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            Leaderboard nickname
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={24}
              placeholder="Example: StarFox"
              className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-slate-200 p-4 dark:border-slate-700">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 accent-indigo-600" />
            <span className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
              {consentVisibility === "public"
                ? "I understand this profile will be visible to any signed-in Koda learner."
                : "I confirm this learner may appear to direct, approved buddies."}
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 rail:flex-row rail:justify-end">
            <UIButton variant="secondary" onClick={() => setConsentOpen(false)} disabled={busy === "consent"}>Not now</UIButton>
            <UIButton icon={consentVisibility === "public" ? <Globe2 /> : <ShieldCheck />} isLoading={busy === "consent"} disabled={!confirmed || nickname.trim().length < 2 || nickname.includes("@")} onClick={() => void enableSharing()}>{consentVisibility === "public" ? "Confirm public sharing" : "Confirm buddies only"}</UIButton>
          </div>
        </div>
      </UIModal>

      <UIModal isOpen={Boolean(invite) && !isCompact} onClose={() => setInvite(null)} title="Buddy code" maxWidth="max-w-md" tone="plain">
        {invite?.code && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">Share this code directly with the buddy you want to add.</p>
            <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 py-5 font-mono text-2xl font-black tracking-wider text-slate-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-white">{invite.code}</div>
            <p className="text-xs font-semibold text-slate-500">Expires in 15 minutes and works once.</p>
            <UIButton fullWidth icon={copied ? <Check /> : <Copy />} onClick={() => void copyInvite()}>{copied ? "Copied" : "Copy code"}</UIButton>
          </div>
        )}
      </UIModal>

      <UIDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove this buddy?"
        description="They will disappear from both buddy lists and leaderboards. A new code is required to reconnect."
        confirmText="Remove buddy"
        onConfirm={() => removing && void removeBuddy(removing)}
        variant="danger"
      />
      <UIDialog
        isOpen={Boolean(blocking)}
        onClose={() => setBlocking(null)}
        title="Block this buddy?"
        description="They will be removed immediately and cannot reconnect until unblocked."
        confirmText="Block buddy"
        onConfirm={() => blocking && void removeBuddy(blocking, true)}
        variant="danger"
      />
    </div>
  );
};
