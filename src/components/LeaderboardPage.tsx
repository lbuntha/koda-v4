import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Copy, Globe2, Link2, LockKeyhole, Plus, RefreshCw, Search, ShieldCheck, UserRoundPlus, Users } from "lucide-react";

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
  UISpinner,
  UISearchInput,
  UIArtIcon,
} from "./ui";

import { currentLanguage, translate } from "../lib/i18n";
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
  const format = new Intl.DateTimeFormat(currentLanguage(), { month: "short", day: "numeric" });
  return `${format.format(new Date(`${start}T12:00:00`))} – ${format.format(new Date(`${end}T12:00:00`))}`;
};

const rankTone = (rank: number): string => {
  if (rank === 1) return "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-800";
  if (rank === 2) return "bg-slate-100 text-slate-700 border-slate-300";
  if (rank === 3) return "bg-orange-100 text-orange-800 border-orange-300";
  return "bg-indigo-50 text-indigo-700 border-indigo-200";
};

export const LeaderboardPage: React.FC = () => {
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
          ? translate("leaderboard.thisLearnerIsNowIncludedOn")
          : translate("leaderboard.leaderboardSharingIsOnForApproved"),
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
      setNotice(translate("leaderboard.sharingStoppedThisLearnerDisappearedFrom"));
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
      setNotice(translate("leaderboard.buddyAddedSharingRemainsASeparate"));
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
      setNotice(block ? translate("leaderboard.buddyBlockedAndRemoved") : translate("leaderboard.buddyRemoved"));
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

  if (loading && !privacy && learners.length === 0) return <UIPageLoader label={translate("leaderboard.loadingBuddyLeaderboard")} />;

  if (!learnerId) {
    return (
      <div className="mx-auto max-w-5xl py-8">
        <UIFlashMessage type="info" title={translate("leaderboard.noLearnerProfile")} message={translate("leaderboard.addOrSelectALearnerProfile")} />
      </div>
    );
  }

  const sharedCount = buddies.filter((buddy) => buddy.sharingEnabled).length;
  const activeBoard = boardScope === "public" ? publicBoard : board;
  const filteredBuddies = buddies.filter((buddy) =>
    (buddy.nickname ?? translate("leaderboard.privateBuddy")).toLocaleLowerCase().includes(buddySearch.trim().toLocaleLowerCase()),
  );
  const participating = boardScope === "public"
    ? privacy?.visibility === "public"
    : privacy?.sharingEnabled === true;
  const switchingLearner = loading && !privacy && learners.length > 0;

  const weekLabel = activeBoard ? translate("leaderboard.valueResetsMonday", { value: friendlyWeek(activeBoard.weekStart, activeBoard.weekEnd) }) : undefined;
  const statusLabel = boardScope === "public"
    ? participating ? translate("leaderboard.includedPublicly") : translate("leaderboard.viewingOnly")
    : translate("leaderboard.sharingWithSharedcountValue", { sharedCount: sharedCount, value: sharedCount === 1 ? translate("leaderboard.buddy") : translate("leaderboard.buddies2") });

  return (
    <div className="min-h-full bg-white dark:bg-canvas">
      <div className="mx-auto max-w-2xl space-y-4">
        <UIPageHeader
          title={translate("leaderboard.leaderboards")}
          action={
            <UIButton
              variant="ghost"
              size="icon"
              icon={<RefreshCw className={refreshing ? "animate-spin" : ""} />}
              onClick={() => void loadBoard(learnerId, true)}
              disabled={refreshing}
              aria-label={translate("leaderboard.refreshLeaderboard")}
            />
          }
        />

        {learners.length > 1 && !session?.learnerId && !manageOpen && (
          // One tap to switch whose board this is; the selected child is the filled chip.
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={translate("leaderboard.choosePlayer")}>
            {learners.map((learner) => {
              const selected = learner.id === learnerId;
              return (
                <button
                  key={learner.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setLearnerId(learner.id)}
                  className={`flex min-h-11 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300/60 ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-line bg-surface text-ink hover:border-indigo-300"}`}
                >
                  <UIAvatar name={learner.displayName} seed={learner.avatarSeed} size="sm" decorative />
                  <span className="max-w-[9rem] truncate">{learner.displayName}</span>
                </button>
              );
            })}
          </div>
        )}

        {error && <UIFlashMessage type="error" title={translate("leaderboard.couldnTUpdateTheLeaderboard")} message={error} onClose={() => setError(null)} />}
        {notice && <UIFlashMessage type="success" message={notice} onClose={() => setNotice(null)} />}

        {switchingLearner ? (
          <UICard className="flex min-h-48 items-center justify-center p-5" aria-live="polite">
            <div className="flex flex-col items-center gap-3 text-center">
              <UISpinner size="md" label={translate("leaderboard.loadingValueLeaderboard", { value: selectedLearner?.displayName ?? translate("leaderboard.player") })} />
              <p className="text-sm font-bold text-muted">
                {translate("leaderboard.loadingValue", { value: selectedLearner?.displayName ?? translate("leaderboard.player") })}
              </p>
            </div>
          </UICard>
        ) : manageOpen ? (
          <section className="space-y-4" aria-labelledby="manage-buddies-title">
            <div className="flex items-center gap-2">
              <UIButton variant="ghost" size="icon" icon={<ChevronLeft />} aria-label={translate("leaderboard.backToLeaderboard")} onClick={() => setManageOpen(false)} />
              <div className="min-w-0">
                <h2 id="manage-buddies-title" className="text-xl font-black text-ink">{translate("leaderboard.manageBuddies")}</h2>
                <p className="truncate text-xs font-semibold text-muted">
                  {selectedLearner ? translate("leaderboard.connectionsForDisplayname", { displayName: selectedLearner.displayName }) : translate("leaderboard.privateConnections")}
                </p>
              </div>
            </div>

            <UICard className="space-y-4 p-4">
              {canManage ? (
                <>
                  {invite?.code ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-lg font-black tracking-wider text-ink">{invite.code}</span>
                        <UIButton size="sm" icon={copied ? <Check /> : <Copy />} onClick={() => void copyInvite()}>{copied ? translate("leaderboard.copied") : translate("leaderboard.copyCode")}</UIButton>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-muted">{translate("leaderboard.expiresIn15MinutesAndWorks")}</p>
                    </div>
                  ) : (
                    <UIButton fullWidth variant="secondary" icon={<Link2 />} isLoading={busy === "invite"} onClick={() => void createCode()}>
                      {translate("leaderboard.createBuddyCode")}
                    </UIButton>
                  )}
                  <div>
                    <label htmlFor="buddy-code" className="text-sm font-bold text-ink">{translate("leaderboard.enterABuddyCode")}</label>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="buddy-code"
                        value={buddyCode}
                        onChange={(event) => setBuddyCode(event.target.value.toUpperCase())}
                        placeholder={translate("leaderboard.kodaXxxxxx")}
                        maxLength={11}
                        autoCapitalize="characters"
                        className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-4 py-2.5 font-mono text-base font-black uppercase tracking-wider text-ink outline-none focus:border-indigo-500"
                      />
                      <UIButton icon={<Plus />} isLoading={busy === "accept"} disabled={!codePattern.test(buddyCode.trim())} onClick={() => void addBuddy()}>
                        {translate("leaderboard.addBuddy")}
                      </UIButton>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">{translate("leaderboard.aParentOrAccountOwnerManages")}</p>
              )}
            </UICard>

            <section aria-label={translate("leaderboard.yourBuddies")} className="space-y-2">
              <h3 className="text-sm font-black text-ink">
                {translate("leaderboard.yourBuddies")} <span className="font-semibold text-muted">· {translate("leaderboard.lengthConnected", { length: buddies.length })}</span>
              </h3>
              {buddies.length > 5 && (
                <UISearchInput label={translate("leaderboard.searchBuddies")} value={buddySearch} onChange={(event) => setBuddySearch(event.target.value)} />
              )}
              {filteredBuddies.length ? filteredBuddies.map((buddy) => (
                <div key={buddy.relationshipId} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                  <UIAvatar name={buddy.nickname ?? translate("leaderboard.privateBuddy")} seed={leaderboardAvatarSeed(buddy.nickname ?? "", buddy.avatarSeed)} size="sm" decorative />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ink">{buddy.nickname ?? translate("leaderboard.privateBuddy")}</p>
                    <p className="text-xs text-muted">{buddy.sharingEnabled ? translate("leaderboard.sharingLeaderboard") : translate("leaderboard.leaderboardHidden")}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" className="rounded-xl px-2 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40" onClick={() => setRemoving(buddy)}>{translate("leaderboard.remove")}</button>
                      <button type="button" className="rounded-xl px-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" onClick={() => setBlocking(buddy)}>{translate("leaderboard.block")}</button>
                    </div>
                  )}
                </div>
              )) : buddies.length ? (
                <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center">
                  <Search className="mx-auto h-8 w-8 text-muted" />
                  <p className="mt-2 text-sm font-bold text-ink">{translate("leaderboard.noBuddiesMatchBuddysearch", { buddySearch: buddySearch })}</p>
                  <button type="button" className="mt-2 text-xs font-black text-indigo-600" onClick={() => setBuddySearch("")}>{translate("leaderboard.clearSearch")}</button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted" />
                  <p className="mt-2 text-sm font-bold text-ink">{translate("leaderboard.noBuddiesYet")}</p>
                  <p className="mt-1 text-xs text-muted">{translate("leaderboard.useAOneTimeCodeTo")}</p>
                </div>
              )}
            </section>

            <p className="flex gap-2 text-xs font-semibold leading-5 text-emerald-800 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              {translate("leaderboard.addingABuddyNeverTurnsOn")}
            </p>
          </section>
        ) : (
          <section className="space-y-3" aria-labelledby="weekly-ranking-title">
            <h2 id="weekly-ranking-title" className="sr-only">{translate("leaderboard.thisWeek")}</h2>
            <div className="grid grid-cols-2 rounded-2xl bg-surface-muted p-1" role="tablist" aria-label={translate("leaderboard.leaderboardType")}>
              {(["buddies", "public"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  role="tab"
                  aria-selected={boardScope === scope}
                  onClick={() => setBoardScope(scope)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${boardScope === scope ? "bg-surface text-indigo-700 shadow-sm dark:text-indigo-300" : "text-muted"}`}
                >
                  {scope === "buddies" ? <Users className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}{" "}
                  {scope === "buddies" ? translate("leaderboard.buddies") : translate("leaderboard.public")}
                </button>
              ))}
            </div>

            {boardScope === "buddies" && !privacy?.sharingEnabled ? (
              <UICard className="p-5 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <LockKeyhole className="h-7 w-7" />
                </span>
                <h3 className="mt-3 text-lg font-black text-ink">{translate("leaderboard.youRePrivateByDefault")}</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted">{translate("leaderboard.chooseBuddiesOnlyOrPublicNothing")}</p>
                <ul className="mx-auto mt-3 max-w-sm space-y-1 text-left">
                  {[translate("leaderboard.shared.nickname"), translate("leaderboard.shared.xp"), translate("leaderboard.shared.private")].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs font-semibold text-body">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                {canConsent ? (
                  <div className="mt-4 flex flex-col justify-center gap-2 rail:flex-row">
                    <UIButton icon={<Users />} onClick={() => { setConsentVisibility("buddies"); setConsentOpen(true); }}>{translate("leaderboard.buddiesOnly")}</UIButton>
                    <UIButton variant="outline" icon={<Globe2 />} onClick={() => { setConsentVisibility("public"); setConsentOpen(true); }}>{translate("leaderboard.joinPublic")}</UIButton>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-violet-50 p-3 text-sm font-bold text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                    {translate("leaderboard.askAParentOrAccountOwner")}
                  </p>
                )}
              </UICard>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <UIBadge variant={participating ? "success" : "neutral"}>{statusLabel}</UIBadge>
                  {/* The week, here rather than in the header: a phone hides the page header. */}
                  {weekLabel && <span className="text-xs font-semibold text-muted">{weekLabel}</span>}
                  {boardScope === "public" && !participating && canConsent && (
                    <UIButton size="sm" icon={<Globe2 />} onClick={() => { setConsentVisibility("public"); setConsentOpen(true); }}>{translate("leaderboard.joinPublicLeaderboard")}</UIButton>
                  )}
                </div>

                {activeBoard?.rows.length ? (
                  <ol className="space-y-2" aria-label={translate("leaderboard.weeklyBoardscopeRankings", { boardScope: boardScope })}>
                    {activeBoard.rows.map((row, index) => (
                      <React.Fragment key={`${row.rank}:${row.nickname}`}>
                        {index === 20 && row.isYou && <li className="py-1 text-center text-xs font-black uppercase tracking-widest text-muted">{translate("leaderboard.yourPosition")}</li>}
                        <li className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${row.isYou ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40" : "border-line"}`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black ${rankTone(row.rank)}`} aria-label={translate("leaderboard.rankRank", { rank: row.rank })}>{row.rank}</span>
                          <UIAvatar name={row.nickname} seed={leaderboardAvatarSeed(row.nickname, row.avatarSeed)} size="sm" decorative />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-black text-ink">{row.isYou ? translate("leaderboard.you") : row.nickname}</p>
                            {row.isYou && <p className="truncate text-xs font-semibold text-violet-700 dark:text-violet-300">{row.nickname}</p>}
                          </div>
                          <span className="shrink-0 font-black tabular-nums text-ink">{translate("leaderboard.valueXp", { value: row.weeklyXp.toLocaleString() })}</span>
                        </li>
                      </React.Fragment>
                    ))}
                  </ol>
                ) : (
                  <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
                    <SvgAsset id="trophy" size={48} className="mx-auto" />
                    <h3 className="mt-3 font-black text-ink">{translate("leaderboard.noScoresYetThisWeek")}</h3>
                    <p className="mt-1 text-sm text-muted">{translate("leaderboard.completeALessonToPlaceOn")}</p>
                  </div>
                )}

                {canConsent && privacy?.sharingEnabled && (
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-sm font-bold text-indigo-600 hover:underline dark:text-indigo-300"
                      onClick={() => { setConsentVisibility(privacy.visibility === "public" ? "public" : "buddies"); setConsentOpen(true); }}
                    >
                      {translate("leaderboard.changeSharingOption")}
                    </button>
                  </div>
                )}
              </>
            )}

            <UIButton variant="secondary" fullWidth icon={<UserRoundPlus />} onClick={() => setManageOpen(true)}>
              {translate("leaderboard.manageBuddiesLength", { length: buddies.length })}
            </UIButton>
          </section>
        )}
      </div>

      <UIModal isOpen={consentOpen} onClose={() => !busy && setConsentOpen(false)} title={translate("leaderboard.chooseLeaderboardSharing")} maxWidth="max-w-lg" tone="plain">
        <div className="space-y-5">
          <div className="grid gap-2 rail:grid-cols-2" role="radiogroup" aria-label={translate("leaderboard.whoCanSeeThisLearner")}>
            <button
              type="button"
              role="radio"
              aria-checked={consentVisibility === "buddies"}
              onClick={() => { setConsentVisibility("buddies"); setConfirmed(false); }}
              className={`rounded-2xl border-2 p-4 text-left ${consentVisibility === "buddies" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-700"}`}
            >
              <UIArtIcon id="menu-users" className="h-6 w-6" />
              <span className="mt-2 block font-black text-slate-900 dark:text-white">{translate("leaderboard.buddiesOnly")}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{translate("leaderboard.onlyDirectAcceptedBuddies")}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={consentVisibility === "public"}
              onClick={() => { setConsentVisibility("public"); setConfirmed(false); }}
              className={`rounded-2xl border-2 p-4 text-left ${consentVisibility === "public" ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40" : "border-slate-200 dark:border-slate-700"}`}
            >
              <UIArtIcon id="kit-globe" className="h-6 w-6" />
              <span className="mt-2 block font-black text-slate-900 dark:text-white">{translate("leaderboard.public")}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{translate("leaderboard.anySignedInKodaLearner")}</span>
            </button>
          </div>
          <div className={`rounded-2xl border p-4 text-sm leading-6 ${consentVisibility === "public" ? "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100" : "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100"}`}>
            {translate("leaderboard.valueOnlyThisNicknameAvatarWeekly", { value: consentVisibility === "public" ? translate("leaderboard.anySignedInKodaLearnerCan") : translate("leaderboard.approvedBuddiesCanSee") })}
          </div>
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            {translate("leaderboard.leaderboardNickname")}
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={24}
              placeholder={translate("leaderboard.exampleStarfox")}
              className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-slate-200 p-4 dark:border-slate-700">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 accent-indigo-600" />
            <span className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
              {consentVisibility === "public"
                ? translate("leaderboard.iUnderstandThisProfileWillBe")
                : translate("leaderboard.iConfirmThisLearnerMayAppear")}
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 rail:flex-row rail:justify-end">
            {privacy?.sharingEnabled && (
              <UIButton
                variant="ghost"
                className="rail:mr-auto"
                isLoading={busy === "privacy"}
                onClick={() => { setConsentOpen(false); void stopSharing(); }}
              >
                {translate("leaderboard.makePrivate")}
              </UIButton>
            )}
            <UIButton variant="secondary" onClick={() => setConsentOpen(false)} disabled={busy === "consent"}>{translate("leaderboard.notNow")}</UIButton>
            <UIButton icon={consentVisibility === "public" ? <Globe2 /> : <ShieldCheck />} isLoading={busy === "consent"} disabled={!confirmed || nickname.trim().length < 2 || nickname.includes("@")} onClick={() => void enableSharing()}>{consentVisibility === "public" ? translate("leaderboard.confirmPublicSharing") : translate("leaderboard.confirmBuddiesOnly")}</UIButton>
          </div>
        </div>
      </UIModal>

      <UIDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={translate("leaderboard.removeThisBuddy")}
        description={translate("leaderboard.theyWillDisappearFromBothBuddy")}
        confirmText={translate("leaderboard.removeBuddy")}
        onConfirm={() => removing && void removeBuddy(removing)}
        variant="danger"
      />
      <UIDialog
        isOpen={Boolean(blocking)}
        onClose={() => setBlocking(null)}
        title={translate("leaderboard.blockThisBuddy")}
        description={translate("leaderboard.theyWillBeRemovedImmediatelyAnd")}
        confirmText={translate("leaderboard.blockBuddy")}
        onConfirm={() => blocking && void removeBuddy(blocking, true)}
        variant="danger"
      />
    </div>
  );
};
