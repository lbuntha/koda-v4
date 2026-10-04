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
import { DailyGoalAPI } from "../../lib/dailyGoal";
import { currentLearnerId } from "../../lib/learnerProgress";
import { formatDate, translate, useT } from "../../lib/i18n";

import {
  EMPTY_STATS,
  fetchProfileStats,
  subscribeProfileStats,
  type ProfileStats,
} from "../../lib/profileStats";
import { levelFromXp, XP_PER_LEVEL, xpToNextLevel } from "../../lib/level";
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
import { UIAvatar, UIBadge, UIButton, UIRewardProgress, UISectionHeader, UIModal } from "../ui";
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

/* Words under `account.role.<audience>` in the catalogs. */

const displayNameOf = (session: Session): string =>
  session.learnerName ??
  session.displayName ??
  (session.email ? session.email.split("@")[0] : "") ??
  translate("profile.yourProfile");

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
  return formatDate(date, { month: "long", year: "numeric" });
};

const dayMonthYear = (iso: string): string =>
  formatDate(iso, { day: "numeric", month: "short", year: "numeric" });

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
  const { t } = useT();

  return (
    <section className={`${themeSystem.card("default")} ${themeSystem.spacing.card}`}>
      <h2 className="font-mono text-xs font-black uppercase tracking-widest text-muted">
        {t("home.yourProgress")}
      </h2>
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center text-indigo-600 dark:text-indigo-400 [&>svg]:h-10 [&>svg]:w-10">
            <SvgAsset
              id="streak"
              size={50}
              title={t("home.learningStreak")}
              fallback={<Flame className="fill-current" />}
            />
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold text-muted">{t("home.learningStreak")}</span>
          <span className="shrink-0 font-mono text-sm font-black text-ink">
            {t("streak.days", { count: stats.dayStreak })}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center text-indigo-600 dark:text-indigo-400 [&>svg]:h-10 [&>svg]:w-10">
            <SvgAsset id="points" size={50} title={t("home.totalPoints")} fallback={<Zap className="fill-current" />} />
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold text-muted">{t("home.totalPoints")}</span>
          <span className="shrink-0 font-mono text-sm font-black text-ink">{t("progress.xp", { xp: stats.totalXp })}</span>
        </div>

        <div className="pl-[3.75rem]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-muted">{t("home.xpLevel", { level })}</span>
            <span className="font-mono text-[0.6875rem] tabular-nums text-muted">
              {t("home.xpToLevel", { xp: xpToNextLevel(stats.totalXp), level: level + 1 })}
            </span>
          </div>
          <UIRewardProgress
            className="mt-1.5"
            value={XP_PER_LEVEL - xpToNextLevel(stats.totalXp)}
            max={XP_PER_LEVEL}
            label={t("home.xpLevel", { level })}
          />
          <p className="mt-1.5 text-[0.6875rem] text-muted">
            {t("home.xpRule", { xp: XP_PER_LEVEL })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center text-indigo-600 dark:text-indigo-400 [&>svg]:h-10 [&>svg]:w-10">
            <SvgAsset id="star" size={50} title={t("home.lessonsMastered")} fallback={<Star className="fill-current" />} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-muted">{t("home.lessonsMastered")}</span>
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
  const { t, tNodes } = useT();
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
      setError(problem.isOffline ? t("profile.error.offline") : problem.message);
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
      setError(t("profile.error.copy"));
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
          <UIAvatar name={name} seed={seed} size="fill" decorative />
        </div>
        <button
          type="button"
          aria-label={t("profile.edit")}
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
        {joined && <p className="text-sm text-muted">{t("profile.joinedOn", { date: joined })}</p>}

      </header>

      {isLearner && <ProfileProgress stats={figures} />}

      {isParent && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title={t("profile.children.title")}
            subtitle={t("profile.children.subtitle")}
            icon={<Baby className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
            action={
              onNavigate && can("learner:create") ? (
                <UIButton variant="secondary" size="sm" onClick={() => onNavigate("children")}>
                  {t("profile.children.manage")}
                </UIButton>
              ) : undefined
            }
          />
          {!canReadLearners ? (
            <EmptyNote
              icon={<Baby />}
              title={t("profile.children.hidden")}
              detail={t("profile.children.hiddenDetail")}
            />
          ) : children === null ? (
            <p className="text-sm text-muted">{t("profile.children.loading")}</p>
          ) : children.length === 0 ? (
            <EmptyNote
              icon={<Baby />}
              title={t("profile.children.none")}
              detail={t("profile.children.noneDetail")}
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
                          ? t("profile.children.seePractice")
                          : [
                              t("profile.children.added", { date: dayMonthYear(child.createdAt) }),
                              child.birthYear ? t("profile.children.born", { year: String(child.birthYear) }) : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>
                    </div>
                    {child.hasActiveCode && (
                      <UIBadge variant="warning" className="ml-auto shrink-0">
                        {t("profile.children.code")}
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
            title={t("profile.access.title")}
            subtitle={t("profile.access.subtitle")}
            icon={<ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          />
          {permissions.length === 0 ? (
            <EmptyNote
              icon={<ShieldCheck />}
              title={t("profile.access.none")}
              detail={t("profile.access.noneDetail")}
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
          title={t("account.label")}
          subtitle={t("profile.account.subtitle")}
          icon={<UserRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [t("profile.account.name"), name],
            [t("profile.account.handle"), `@${handleOf(session)}`],
            session.email ? [t("account.email"), session.email] : null,
            session.familyName ? [t("profile.account.family"), session.familyName] : null,
            [t("profile.account.role"), t(`account.role.${audience}`)],
            joined ? [t("profile.account.joined"), joined] : null,
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
              <h3 className="koda-admin-label text-ink">{t("profile.device.title")}</h3>
              <p className="text-xs text-muted">{t("profile.device.subtitle")}</p>
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
                    {t("profile.device.button")}
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
        title={t("profile.device.modalTitle", { name: deviceCode?.learner.displayName ?? t("account.role.child") })}
        tone="plain"
        footer={<UIButton variant="primary" onClick={() => setDeviceCode(null)}>{t("skillCard.done")}</UIButton>}
      >
        {deviceCode && (
          <div className="space-y-5 text-center">
            <p className="text-sm text-muted">
              {tNodes("profile.device.howTo", { childCode: <strong>{t("account.childCode")}</strong> })}
            </p>
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-5 dark:border-indigo-800 dark:bg-indigo-950/40">
              <div className="font-mono text-3xl font-bold tracking-[0.3em] text-indigo-800 dark:text-indigo-200">
                {deviceCode.code}
              </div>
              <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">
                {t("profile.device.expires", {
                  time: formatDate(deviceCode.expiresAt, { hour: "numeric", minute: "2-digit" }),
                })}
              </p>
            </div>
            <UIButton
              variant="secondary"
              icon={deviceCodeCopied ? <Check /> : <Copy />}
              onClick={() => void copyDeviceCode()}
            >
              {deviceCodeCopied ? t("profile.device.copied") : t("profile.device.copy")}
            </UIButton>
            <p className="text-xs text-muted">{t("profile.device.private")}</p>
          </div>
        )}
      </UIModal>

      <ProfileEditModal
        isOpen={editOpen}
        currentName={name}
        currentSeed={session.avatarSeed}
        nameLabel={audience === "child" ? t("profile.editModal.yourName") : t("profile.editModal.displayName")}
        onClose={() => setEditOpen(false)}
        onSave={saveProfile}
      />
    </div>
  );
};
