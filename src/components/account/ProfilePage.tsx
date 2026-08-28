import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Award,
  Baby,
  Flame,
  KeyRound,
  Pencil,
  ShieldCheck,
  Medal,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  Users,
  Zap,
} from "lucide-react";

import { diceBearAvatar } from "../../lib/avatar";
import { BADGE_METRICS, badgeShelf, useBadges } from "../../lib/badges";
import { DailyGoalAPI } from "../../lib/dailyGoal";
import { currentLearnerId } from "../../lib/learnerProgress";
import { BadgeIcon } from "./BadgeVisuals";
import { DailyGoalField } from "./DailyGoalField";
import {
  EMPTY_STATS,
  fetchProfileStats,
  subscribeProfileStats,
  type ProfileStats,
} from "../../lib/profileStats";
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
import { UIAvatar, UIBadge, UIButton, UISectionHeader, UIStatTile } from "../ui";
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

/** Two up from `sm`, then as many across as the reading has tiles to show. */
const StatGrid: React.FC<{ children: React.ReactNode; wide?: string }> = ({
  children,
  wide = "lg:grid-cols-3",
}) => <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${wide}`}>{children}</div>;

/** Says out loud that a figure has not been measured yet, so a seeded sample is
    never read as a result. Drops away the moment anything records a real one. */
const SampleBadge: React.FC<{ stats: ProfileStats | null }> = ({ stats }) =>
  stats?.source === "placeholder" ? <UIBadge variant="neutral">Sample data</UIBadge> : null;

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

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const session = useSession();
  const { can } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<FamilyChild[] | null>(null);
  // Every figure on this page comes from this row. Nothing below counts,
  // sums or infers a statistic — see `lib/profileStats.ts` for why.
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useSyncExternalStore(DailyGoalAPI.subscribe, DailyGoalAPI.version);
  // Subscribed rather than read once: an owner renaming a badge should change
  // what this page prints, and the row stores ids precisely so it can.
  const rules = useBadges();
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
  /*
   * Every badge, won and unwon, measured off the same stored row as the rest of
   * the page.
   *
   * The row is the record of what this learner has done, so the shelf agrees
   * with the tiles above it by construction — no second count, no chance of the
   * profile awarding a badge the statistics do not support.
   */
  const shelf = badgeShelf(rules, {
    xp: figures.totalXp,
    longestStreak: figures.longestStreak,
    starsEarned: figures.starsEarned,
  });
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

  return (
    <div className={"mx-auto max-w-5xl space-y-6"}>
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

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {isLearner ? (
              <>
                <span>{figures.lessonsMastered} Lessons mastered</span>
                <span>{figures.starsEarned} Stars</span>
              </>
            ) : isParent ? (
              <>
                <span>{figures.childrenCount} Children</span>
                <span>{session.familyName ?? "Family"}</span>
              </>
            ) : (
              <>
                <span>{figures.permissionsCount} Permissions</span>
                <span>{session.platformRole && session.platformRole !== "none" ? session.platformRole : "No platform role"}</span>
              </>
            )}
          </div>
          <UIBadge variant={isLearner ? "success" : isParent ? "primary" : "info"}>
            {audienceLabel[audience]}
            {session.familyName ? ` · ${session.familyName}` : ""}
          </UIBadge>
        </div>
      </header>

      <hr className="border-t border-line" />

      {/* ---------------------------------------------------------------- */}
      {/* STATISTICS — four facts, chosen by who is reading                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className={themeSystem.typography("h2")}>Statistics</h2>
          <SampleBadge stats={stats} />
        </div>

        {isLearner ? (
          <StatGrid>
            <UIStatTile
              icon={<Flame className="fill-current" />}
              value={`${figures.dayStreak}`}
              label="Day streak"
              tone="streak"
            />
            <UIStatTile
              icon={<Zap className="fill-current" />}
              value={`${figures.totalXp} XP`}
              label="Total XP"
            />
            <UIStatTile
              icon={<ShieldCheck />}
              value={figures.league ?? "None"}
              label="Current league"
              tone="success"
            />
            <UIStatTile
              icon={<Medal />}
              value={`${figures.topThreeFinishes}`}
              label="Top 3 finishes"
            />
            <UIStatTile
              icon={<Trophy />}
              value={`Level ${figures.level}`}
              label="Current level"
              tone="success"
            />
            <UIStatTile
              icon={<Star className="fill-current" />}
              value={`${figures.starsEarned}`}
              label="Stars earned"
              tone="streak"
            />
          </StatGrid>
        ) : isParent ? (
          <StatGrid>
            <UIStatTile icon={<Baby />} value={`${figures.childrenCount}`} label="Children" />
            <UIStatTile
              icon={<KeyRound />}
              value={`${figures.codesWaiting}`}
              label="Codes waiting"
              tone="streak"
            />
            <UIStatTile
              icon={<Sparkles />}
              value={`${figures.lessonsAvailable}`}
              label="Lessons available"
              tone="success"
            />
          </StatGrid>
        ) : (
          <StatGrid wide="lg:grid-cols-2">
            <UIStatTile
              icon={<KeyRound />}
              value={`${figures.permissionsCount}`}
              label="Permissions"
            />
            <UIStatTile
              icon={<Sparkles />}
              value={`${figures.lessonsAvailable}`}
              label="Lessons available"
              tone="success"
            />
          </StatGrid>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* WHAT SITS UNDER THE NUMBERS, per reading                          */}
      {/* ---------------------------------------------------------------- */}
      {isLearner && (
        <>
          <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
            <UISectionHeader
              title="Today"
              subtitle="The daily goal, and how far through the course this learner is"
              icon={<Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
            />
            {/*
              * A student sets their own goal; a child's is set for them.
              *
              * `learner:update` is the same right a parent uses on the Children
              * page — an older learner with their own sign-in holds it over
              * their own record and nobody else's, which is exactly the
              * distinction this row needs. A child sees the bar and no stepper.
              */}
            {ownGoal !== null && (
              <DailyGoalField
                label="Daily goal"
                hint="Rounds you aim to finish each day"
                value={ownGoal}
                onChange={(goal) => DailyGoalAPI.set(currentLearnerId(), goal)}
              />
            )}
            <div className="space-y-3">
              {[
                {
                  label: "Daily goal",
                  done: figures.dailySolved,
                  target: ownGoal ?? figures.dailyGoal,
                },
                {
                  label: "Course progress",
                  done: figures.lessonsMastered,
                  target: figures.lessonsAvailable,
                },
              ].map(({ label, done, target }) => (
                <div key={label} className="rounded-2xl border border-line bg-surface-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-mono text-sm font-bold text-ink">{label}</h4>
                    <span className="font-mono text-sm font-black tabular-nums text-ink">
                      {done} / {target}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${target > 0 ? Math.min(100, (done / target) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
            <UISectionHeader
              title="Achievements"
              subtitle="Won, and the next one to go for"
              icon={<Award className="h-5 w-5 text-amber-500" />}
            />
            {shelf.length === 0 ? (
              <EmptyNote
                icon={<Award />}
                title="No badges set up"
                detail="An owner can add some on the Badges page."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {shelf.map(({ rule, earned, standing, progress }) => {
                  const unit = BADGE_METRICS.find((m) => m.id === rule.metric)?.unit ?? "";
                  return (
                    <div
                      key={rule.id}
                      className={`flex items-center gap-3 rounded-2xl border p-4 ${
                        earned
                          ? "border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/20"
                          : "border-line bg-surface-muted"
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                          earned
                            ? "border-amber-300 bg-surface text-amber-500 dark:border-amber-700/60"
                            : "border-line bg-surface text-muted opacity-60"
                        }`}
                      >
                        <BadgeIcon icon={rule.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4
                            className={`truncate font-mono text-sm font-bold ${
                              earned ? "text-ink" : "text-muted"
                            }`}
                          >
                            {rule.label}
                          </h4>
                          {!earned && (
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                              {standing} / {rule.threshold}
                            </span>
                          )}
                        </div>
                        {earned ? (
                          <p className="truncate text-xs text-muted">
                            {rule.description || `${rule.threshold} ${unit}`}
                          </p>
                        ) : (
                          <>
                            {/*
                              * The locked ones are the point of the shelf.
                              * A badge nobody can see is not a goal, and the
                              * gap is what makes the next lesson worth
                              * starting — so the bar and the words say how
                              * far, not merely that it is missing.
                              */}
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                              <div
                                className="h-full rounded-full bg-amber-400 transition-all"
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </div>
                            <p className="mt-1 text-xs text-muted">
                              {Math.max(0, rule.threshold - standing)} {unit} to go
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {onNavigate && (
              <UIButton variant="primary" size="sm" onClick={() => onNavigate("game")}>
                Keep learning
              </UIButton>
            )}
          </section>
        </>
      )}

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
      </section>

      {/* Under Account, because it is the same subject: how this profile is
          identified, and the secret that proves it. */}
      <ChangePasswordCard />

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
