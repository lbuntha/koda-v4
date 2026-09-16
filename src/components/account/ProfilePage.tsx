import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Baby,
  Check,
  Copy,
  Flame,
  KeyRound,
  Pencil,
  ShieldCheck,
  Star,
  Zap,
  UserRound,
} from "lucide-react";

import { SvgAsset } from "../../assets/svg";
import { diceBearAvatar } from "../../lib/avatar";
import { DailyGoalAPI } from "../../lib/dailyGoal";
import { currentLearnerId } from "../../lib/learnerProgress";

import {
  EMPTY_STATS,
  fetchProfileStats,
  subscribeProfileStats,
  type ProfileStats,
} from "../../lib/profileStats";
import { levelFromXp, levelProgress, XP_PER_LEVEL, xpToNextLevel } from "../../lib/level";
import {
  ApiError,
  accessToken,
  request,
  SessionAPI,
  type Session,
  usePermissions,
  useSession,
} from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIAvatar, UIBadge, UIButton, UISectionHeader, UIModal } from "../ui";
import { ProfileEditModal } from "./ProfileEditModal";
import { ChangePasswordCard } from "./ChangePasswordCard";

/**
 * One profile page, three readings of it.
 *
 * A child, a parent and a staff account all arrive at the same route, and the
 * only thing that differs is which four numbers are worth printing and what
 * sits under them — a child's badges, a parent's children, an operator's
 * access. Three separate pages would have meant three banners, three edit
 * dialogues and three sets of empty states drifting apart; the shape is shared
 * because the *identity* is shared, and only the evidence changes.
 */

type Audience = "child" | "parent" | "staff" | "student";

interface FamilyChild {
  id: string;
  displayName: string;
  avatarSeed: string;
  birthYear: number | null;
  createdAt: string;
  hasActiveCode: boolean;
}

interface DeviceCodeResult {
  learner: FamilyChild;
  code: string;
  expiresAt: string;
}

export interface ProfilePageProps {
  /**
   * Lets a card hand the reader on to the page that actually does the work.
   *
   * `learnerId` names a particular child, so a card can open that child's
   * record rather than the list they would then have to search.
   */
  onNavigate?: (tab: "children" | "game" | "settings", learnerId?: string) => void;
}

const audienceOf = (session: Session): Audience => {
  if (session.role === "child" || session.learnerId) return "child";
  if (session.role === "owner" || session.role === "parent") return "parent";
  if (session.role === "student") return "student";
  return "staff";
};

const audienceLabel: Record<Audience, string> = {
  child: "Child",
  parent: "Parent",
  student: "Student",
  staff: "Staff",
};

const displayNameOf = (session: Session): string =>
  session.learnerName ??
  session.displayName ??
  (session.email ? session.email.split("@")[0] : "") ??
  "Your profile";

/** "Ly Buntha" -> "LyBuntha", so the handle reads like one the account chose. */
const handleOf = (session: Session): string => {
  const source = session.learnerName ?? session.displayName ?? session.email?.split("@")[0] ?? "";
  const cleaned = source.replace(/[^A-Za-z0-9]+/g, "");
  return cleaned || "koda";
};

const monthYear = (iso?: string): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
};

const dayMonthYear = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );

const EmptyNote: React.FC<{ icon: React.ReactNode; title: string; detail: string }> = ({
  icon,
  title,
  detail,
}) => (
  <div className="rounded-2xl border-2 border-dashed border-line bg-surface-muted p-6 text-center">
    <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-indigo-500 [&>svg]:h-5 [&>svg]:w-5">
      {icon}
    </span>
    <p className="text-sm font-bold text-ink">{title}</p>
    <p className="mt-1 text-xs text-muted">{detail}</p>
  </div>
);

const ProfileProgress: React.FC<{ stats: ProfileStats }> = ({ stats }) => {
  const level = levelFromXp(stats.totalXp);
  const progress = Math.round(levelProgress(stats.totalXp) * 100);

  return (
    <section className={`${themeSystem.card("default")} ${themeSystem.spacing.card}`}>
      <h2 className="font-mono text-xs font-black uppercase tracking-widest text-muted">
        Your progress
      </h2>
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center text-purple-500 [&>svg]:h-10 [&>svg]:w-10">
            <SvgAsset
              id="streak"
              size={50}
              title="Learning streak"
              fallback={<Flame className="fill-current" />}
            />
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold text-muted">Learning streak</span>
          <span className="shrink-0 font-mono text-sm font-black text-ink">
            {stats.dayStreak} {stats.dayStreak === 1 ? "day" : "days"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center text-purple-500 [&>svg]:h-10 [&>svg]:w-10">
            <SvgAsset id="points" size={50} title="Total points" fallback={<Zap className="fill-current" />} />
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold text-muted">Total points</span>
          <span className="shrink-0 font-mono text-sm font-black text-ink">{stats.totalXp} XP</span>
        </div>

        <div className="pl-[3.75rem]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-muted">XP Level {level}</span>
            <span className="font-mono text-[0.6875rem] tabular-nums text-muted">
              {xpToNextLevel(stats.totalXp)} XP to level {level + 1}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[0.6875rem] text-muted">
            {XP_PER_LEVEL} XP earns a level. Every finished round pays XP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center text-amber-500 [&>svg]:h-10 [&>svg]:w-10">
            <SvgAsset id="star" size={50} title="Lessons mastered" fallback={<Star className="fill-current" />} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-muted">Lessons mastered</span>
          <span className="shrink-0 font-mono text-sm font-black text-ink">
            {stats.lessonsMastered} / {stats.lessonsAvailable}
          </span>
        </div>
      </div>
    </section>
  );
};

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const session = useSession();
  const { can } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<FamilyChild[] | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResult | null>(null);
  const [deviceCodeBusy, setDeviceCodeBusy] = useState<string | null>(null);
  const [deviceCodeCopied, setDeviceCodeCopied] = useState(false);
  // Every figure on this page comes from this row. Nothing below counts,
  // sums or infers a statistic — see `lib/profileStats.ts` for why.
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useSyncExternalStore(DailyGoalAPI.subscribe, DailyGoalAPI.version);
  const audience = session ? audienceOf(session) : "staff";
  const isParent = audience === "parent";
  const canReadLearners = can("learner:read");
  const canReadRecord = can("learner_data:read");

  const loadChildren = useCallback(async () => {
    if (!isParent || !canReadLearners) return;
    try {
      const token = await accessToken();
      const body = await request<{ learners: FamilyChild[] }>("/learners", { token });
      setChildren(body.learners);
    } catch {
      // The profile is still worth reading without the family list; the
      // Children page is where that failure is actually actionable.
      setChildren([]);
    }
  }, [canReadLearners, isParent]);

  useEffect(() => void loadChildren(), [loadChildren]);

  useEffect(() => {
    let cancelled = false;
    void fetchProfileStats().then((row) => {
      if (!cancelled) setStats(row ?? EMPTY_STATS);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.deviceId]);

  // A round finished with this page open writes a new row; adopt it rather than
  // waiting to be reopened.
  useEffect(() => subscribeProfileStats(setStats), []);

  if (!session) return null;

  const name = displayNameOf(session);
  const seed = session.avatarSeed ?? session.learnerId ?? session.userId ?? session.deviceId;
  const joined = monthYear(session.joinedAt);
  // Read, never computed. `EMPTY_STATS` covers the moment before the row
  // arrives and a device with no connection to fetch it.
  const figures = stats ?? EMPTY_STATS;
  const isLearner = audience === "child" || audience === "student";
  // Their own goal, when this reading is a learner reading their own profile
  // and they hold the right to change it. `null` means "not theirs to set" —
  // a child, or an adult, both of whom see the goal but not the stepper.
  const ownGoal = isLearner && can("learner:update") ? DailyGoalAPI.for(currentLearnerId()) : null;
  // The chips list what this account may do; the *count* beside them is a
  // recorded figure like every other one.
  const permissions = session.permissions ?? [];

  const saveProfile = async (patch: { displayName: string; avatarSeed: string }) => {
    setError(null);
    try {
      await SessionAPI.updateProfile(patch);
      playSound("pop");
    } catch (err) {
      const problem = err as ApiError;
      setError(problem.isOffline ? "No connection — your profile was not changed." : problem.message);
      throw err;
    }
  };

  const issueDeviceCode = async (child: FamilyChild) => {
    setDeviceCodeBusy(child.id);
    setError(null);
    try {
      const token = await accessToken();
      const result = await request<DeviceCodeResult>(`/learners/${child.id}/join-code`, {
        method: "POST",
        token,
      });
      setDeviceCode(result);
      setDeviceCodeCopied(false);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setDeviceCodeBusy(null);
    }
  };

  const copyDeviceCode = async () => {
    if (!deviceCode) return;
    try {
      await navigator.clipboard.writeText(deviceCode.code);
      setDeviceCodeCopied(true);
    } catch {
      setError("The code could not be copied. Please select it manually.");
    }
  };

  return (
    <div className={"mx-auto max-w-2xl space-y-6"}>
      {error && <p className={themeSystem.flash("error")}>{error}</p>}

      {/* ---------------------------------------------------------------- */}
      {/* BANNER — the face, and the one control that changes it            */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative flex h-48 items-center justify-center overflow-hidden rounded-2xl border-2 border-line bg-surface-muted sm:h-64">
        <div className="h-28 w-28 overflow-hidden rounded-3xl border-2 border-line bg-surface shadow-sm sm:h-36 sm:w-36">
          <UIAvatar name={name} src={diceBearAvatar(seed)} size="fill" decorative />
        </div>
        <button
          type="button"
          aria-label="Edit profile"
          onClick={() => {
            playSound("pop");
            setEditOpen(true);
          }}
          className={themeSystem.button("secondary", "icon", "absolute right-3 top-3 !rounded-2xl")}
        >
          <Pencil />
        </button>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* IDENTITY                                                          */}
      {/* ---------------------------------------------------------------- */}
      <header className="space-y-1">
        <h1 className={themeSystem.typography("h1")}>{name}</h1>
        <p className="text-base font-bold text-muted">@{handleOf(session)}</p>
        {joined && <p className="text-sm text-muted">Joined {joined}</p>}

      </header>

      {isLearner && <ProfileProgress stats={figures} />}

      {isParent && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title="Children"
            subtitle="The profiles under this family"
            icon={<Baby className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
            action={
              onNavigate && can("learner:create") ? (
                <UIButton variant="secondary" size="sm" onClick={() => onNavigate("children")}>
                  Manage
                </UIButton>
              ) : undefined
            }
          />
          {!canReadLearners ? (
            <EmptyNote
              icon={<Baby />}
              title="Not visible to this account"
              detail="Viewing children needs the learner:read permission."
            />
          ) : children === null ? (
            <p className="text-sm text-muted">Loading children…</p>
          ) : children.length === 0 ? (
            <EmptyNote
              icon={<Baby />}
              title="No child profiles yet"
              detail="Add a child to give them their own learning space and profile."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {children.map((child) => {
                const body = (
                  <>
                    <UIAvatar name={child.displayName} seed={child.avatarSeed} size="md" />
                    <div className="min-w-0 text-left">
                      <p className="truncate font-mono text-sm font-bold text-ink">
                        {child.displayName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {canReadRecord
                          ? "See what they have practised"
                          : `Added ${dayMonthYear(child.createdAt)}${child.birthYear ? ` · born ${child.birthYear}` : ""}`}
                      </p>
                    </div>
                    {child.hasActiveCode && (
                      <UIBadge variant="warning" className="ml-auto shrink-0">
                        Code
                      </UIBadge>
                    )}
                  </>
                );
                const shell = "flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-muted p-3";

                return (
                  <li key={child.id}>
                    {onNavigate && canReadRecord ? (
                      <button
                        type="button"
                        onClick={() => onNavigate("children", child.id)}
                        className={`${shell} cursor-pointer transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30`}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className={shell}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {audience === "staff" && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title="Access"
            subtitle="What this account is allowed to do on this deployment"
            icon={<ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          />
          {permissions.length === 0 ? (
            <EmptyNote
              icon={<ShieldCheck />}
              title="No permissions loaded"
              detail="The effective set arrives with the account; reconnect to see it."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {permissions.map((permission) => (
                <UIBadge key={permission} variant="neutral" className="font-mono">
                  {permission}
                </UIBadge>
              ))}
            </div>
          )}
        </section>
      )}

      {/* The account facts a profile is expected to carry, and nothing that
          belongs to Settings — this page says who you are, not how the app
          behaves. */}
      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-3`)}>
        <UISectionHeader
          title="Account"
          subtitle="How this profile is identified"
          icon={<UserRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Name", name],
            ["Handle", `@${handleOf(session)}`],
            session.email ? ["Email", session.email] : null,
            session.familyName ? ["Family", session.familyName] : null,
            ["Role", audienceLabel[audience]],
            joined ? ["Joined", joined] : null,
          ]
            .filter((row): row is [string, string] => row !== null)
            .map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-line bg-surface-muted p-3">
                <dt className="koda-admin-label">{label}</dt>
                <dd className="mt-0.5 truncate font-mono text-sm font-bold text-ink">{value}</dd>
              </div>
            ))}
        </dl>
        {isParent && can("learner:update") && children && children.length > 0 && (
          <div className="space-y-3 border-t border-line pt-4">
            <div>
              <h3 className="koda-admin-label text-ink">Child device access</h3>
              <p className="text-xs text-muted">Generate a one-time code for a child&apos;s device.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <UIAvatar name={child.displayName} seed={child.avatarSeed} size="sm" />
                    <span className="truncate text-sm font-semibold text-ink">{child.displayName}</span>
                  </div>
                  <UIButton
                    variant="secondary"
                    size="sm"
                    icon={<KeyRound />}
                    isLoading={deviceCodeBusy === child.id}
                    onClick={() => void issueDeviceCode(child)}
                  >
                    Device code
                  </UIButton>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Under Account, because it is the same subject: how this profile is
          identified, and the secret that proves it. */}
      <ChangePasswordCard />

      <UIModal
        isOpen={Boolean(deviceCode)}
        onClose={() => setDeviceCode(null)}
        title={`Device code for ${deviceCode?.learner.displayName ?? "child"}`}
        tone="plain"
        footer={<UIButton variant="primary" onClick={() => setDeviceCode(null)}>Done</UIButton>}
      >
        {deviceCode && (
          <div className="space-y-5 text-center">
            <p className="text-sm text-muted">
              On the child&apos;s device, choose <strong>Child code</strong> on the sign-in screen and enter this code.
            </p>
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-5 dark:border-indigo-800 dark:bg-indigo-950/40">
              <div className="font-mono text-3xl font-bold tracking-[0.3em] text-indigo-800 dark:text-indigo-200">
                {deviceCode.code}
              </div>
              <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">
                Expires {new Date(deviceCode.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · single use
              </p>
            </div>
            <UIButton
              variant="secondary"
              icon={deviceCodeCopied ? <Check /> : <Copy />}
              onClick={() => void copyDeviceCode()}
            >
              {deviceCodeCopied ? "Copied" : "Copy code"}
            </UIButton>
            <p className="text-xs text-muted">Keep this code private. It cannot be used again after the child joins.</p>
          </div>
        )}
      </UIModal>

      <ProfileEditModal
        isOpen={editOpen}
        currentName={name}
        currentSeed={session.avatarSeed}
        nameLabel={audience === "child" ? "Your name" : "Display name"}
        onClose={() => setEditOpen(false)}
        onSave={saveProfile}
      />
    </div>
  );
};
