import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  Baby,
  KeyRound,
  Pencil,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { diceBearAvatar } from "../../lib/avatar";
import { DailyGoalAPI } from "../../lib/dailyGoal";
import { currentLearnerId } from "../../lib/learnerProgress";

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
import { UIAvatar, UIBadge, UIButton, UISectionHeader } from "../ui";
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
