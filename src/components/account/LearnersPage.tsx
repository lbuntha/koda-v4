import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, KeyRound, LineChart, MoreVertical, Pencil, Plus, Trash2, UserRound } from "lucide-react";

import { ApiError, accessToken, request, SessionAPI, usePermissions, useSession } from "../../lib/sync";
import { DAILY_GOAL_DEFAULT, DailyGoalAPI } from "../../lib/dailyGoal";
import { CHILD_SETTINGS_DEFAULTS, ChildSettingsAPI, type ChildSettings } from "../../lib/childSettings";
import { Billing } from "../../lib/billing";
import { useBilling } from "../../lib/useBilling";
import { DailyGoalField } from "./DailyGoalField";
import { ChildSettingsFields } from "./ChildSettingsFields";
import { FamilyPinCard } from "./FamilyPinCard";
import { ageFromBirthYear } from "../../skills/viewer";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIAvatar, UIBadge, UIButton, UIDialog, UIMenu, UIMenuItem, UIMenuSeparator, UIModal } from "../ui";
import { ChildReportPage } from "./ChildReportPage";
import { NoAccess } from "./NoAccess";
import { useIsCompact } from "../../lib/useBreakpoint";
import { formatDate as formatInLanguage, useT } from "../../lib/i18n";

interface Learner {
  id: string;
  displayName: string;
  avatarSeed: string;
  birthYear: number | null;
  createdAt: string;
  hasActiveCode: boolean;
}

interface JoinCodeResult {
  learner: Learner;
  code: string;
  expiresAt: string;
}

const field =
  themeSystem.field("lg", "w-full");

/**
 * Whether the draft is actually different from what is stored.
 *
 * Per key and by *value*. The reference comparison this replaced was correct
 * only while every setting was a primitive: `allowedHours` is an object, and two
 * reads of one stored window are two different objects, so `!==` on it was
 * always true — every Save would write and re-sync a document nobody had
 * touched, which is exactly what this guard exists to prevent.
 */
const settingsDiffer = (draft: ChildSettings, saved: ChildSettings): boolean =>
  (Object.keys(draft) as (keyof ChildSettings)[]).some((key) => {
    const mine = draft[key];
    const theirs = saved[key];
    // Only the object-valued fields need the deeper look; `null` against an
    // object still falls to the cheap comparison and reads as a change.
    return mine && theirs && typeof mine === "object" && typeof theirs === "object"
      ? JSON.stringify(mine) !== JSON.stringify(theirs)
      : mine !== theirs;
  });

const formatDate = (value: string) =>
  formatInLanguage(value, { day: "numeric", month: "short", year: "numeric" });

export interface LearnersPageProps {
  /**
   * Which child's record to show instead of the list, if any.
   *
   * Controlled from outside rather than held here, because two screens open it
   * — this page's own cards, and a child on the Profile page — and two sources
   * of truth for "which child am I looking at" is how the back button starts
   * lying about where it goes.
   */
  reportFor?: string | null;
  /** Open a child's record, or close it with `null`. */
  onOpenReport?: (learnerId: string | null) => void;
}

export const LearnersPage: React.FC<LearnersPageProps> = ({ reportFor = null, onOpenReport }) => {
  useSyncExternalStore(DailyGoalAPI.subscribe, DailyGoalAPI.version);
  const plan = useBilling();
  const { t, tNodes } = useT();
  const isCompact = useIsCompact();
  const { can } = usePermissions();
  const session = useSession();
  const canRead = can("learner:read");
  const canCreate = can("learner:create");
  const canUpdate = can("learner:update");
  const canDelete = can("learner:delete");
  const canReadRecord = can("learner_data:read");
  const canSwitch = canRead && !session?.learnerId;
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [editing, setEditing] = useState<Learner | null>(null);
  // Held as a draft rather than saved on each tap: this control sits in a form
  // with a Cancel button, and a goal that had already been written would make
  // that button a lie.
  const [goalDraft, setGoalDraft] = useState(DAILY_GOAL_DEFAULT);
  // Held as a draft for the same reason, and written in the same gesture: these
  // are rules about a child, and half-applying them on Cancel would leave a
  // parent believing they had set something they had not.
  const [settingsDraft, setSettingsDraft] = useState<ChildSettings>(CHILD_SETTINGS_DEFAULTS);
  const [codeResult, setCodeResult] = useState<JoinCodeResult | null>(null);
  const [deleting, setDeleting] = useState<Learner | null>(null);
  const [copied, setCopied] = useState(false);
  // Two conditions that mean different things: the right to add a child, and
  // whether the plan has room for another. The server checks both — this only
  // decides what the button says.
  const atLimit = learners.length >= plan.learnerLimit;

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const token = await accessToken();
      const response = await request<{ learners: Learner[] }>("/learners", { token });
      setLearners(response.learners);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => void load(), [load]);

  const createLearner = async () => {
    if (!name.trim()) return;
    setBusy("create");
    setError(null);
    try {
      const token = await accessToken();
      const created = await request<Learner>("/learners", {
        method: "POST",
        token,
        body: { displayName: name.trim(), birthYear: birthYear ? Number(birthYear) : null },
      });
      const code = await request<JoinCodeResult>(`/learners/${created.id}/join-code`, {
        method: "POST",
        token,
      });
      setLearners((current) => [...current, code.learner]);
      // A child just used one of the plan's places, so the count on the plan
      // card and the state of this page's button both moved.
      void Billing.refresh();
      setCreateOpen(false);
      setName("");
      setBirthYear("");
      setCodeResult(code);
      setNotice(t("children.notice.created"));
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const issueCode = async (learner: Learner) => {
    setBusy(`code:${learner.id}`);
    setError(null);
    try {
      const token = await accessToken();
      const code = await request<JoinCodeResult>(`/learners/${learner.id}/join-code`, {
        method: "POST",
        token,
      });
      setLearners((current) => current.map((item) => item.id === learner.id ? code.learner : item));
      setCodeResult(code);
      setCopied(false);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const switchToChild = async (learner: Learner) => {
    setBusy(`switch:${learner.id}`);
    setError(null);
    try {
      await SessionAPI.switchToChild(learner.id, learner.displayName);
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const saveLearner = async () => {
    if (!editing || !editing.displayName.trim()) return;
    setBusy(`edit:${editing.id}`);
    try {
      const token = await accessToken();
      const updated = await request<Learner>(`/learners/${editing.id}`, {
        method: "PATCH",
        token,
        body: { displayName: editing.displayName.trim(), birthYear: editing.birthYear },
      });
      // The name is the server's record; the goal and the rules are synced
      // documents of their own, so they are written here rather than in the
      // same request.
      if (goalDraft !== DailyGoalAPI.for(editing.id)) DailyGoalAPI.set(editing.id, goalDraft);
      const saved = ChildSettingsAPI.for(editing.id);
      if (settingsDiffer(settingsDraft, saved)) ChildSettingsAPI.set(editing.id, settingsDraft);
      setLearners((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditing(null);
      setNotice(t("children.notice.updated"));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const deleteLearner = async (learner: Learner) => {
    setBusy(`delete:${learner.id}`);
    try {
      const token = await accessToken();
      await request(`/learners/${learner.id}`, { method: "DELETE", token });
      setLearners((current) => current.filter((item) => item.id !== learner.id));
      setNotice(t("children.notice.removed", { name: learner.displayName }));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const copyCode = async () => {
    if (!codeResult) return;
    await navigator.clipboard?.writeText(codeResult.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!canRead) {
    return <NoAccess title={t("profile.children.title")} permission="learner:read" what={t("children.noAccess")} />;
  }

  const showing = reportFor ? learners.find((item) => item.id === reportFor) : undefined;
  if (showing) {
    return (
      <ChildReportPage
        learnerId={showing.id}
        learnerName={showing.displayName}
        avatarSeed={showing.avatarSeed}
        onBack={() => onOpenReport?.(null)}
      />
    );
  }

  return (
    <div className="min-h-full bg-white dark:bg-canvas">
      <div className="mx-auto max-w-5xl space-y-4">
        {/*
          * On a phone the toolbar already says "Children" a couple of
          * centimetres higher up, so printing the heading and its line again
          * spends the top of a 390px screen repeating what the reader just
          * read. Above `rail:` the rail carries the nav and nothing names the
          * page, so the heading is the only label and it stays.
          *
          * Left out of the tree rather than hidden, because `space-y-5` still
          * spaces a child it cannot see: a hidden header would leave 20px of
          * nothing under the toolbar. When there is no "Add child" button
          * either, the whole header goes.
          */}
        {(!isCompact || canCreate) && (
        <header className={isCompact ? "flex justify-end" : "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"}>
          {!isCompact && (
          <div><h1 className="koda-admin-page-title">{t("profile.children.title")}</h1><p className="mt-1 text-sm text-[#6D6997] dark:text-muted">{t("children.subtitle")}</p></div>
          )}
          {canCreate && (
            <div className="flex flex-wrap items-center gap-3">
              <UIButton
                variant="primary"
                icon={<Plus />}
                disabled={atLimit}
                onClick={() => setCreateOpen(true)}
              >
                {t("children.add")}
              </UIButton>
              {/*
                * Only shown once the limit is reached, to say why the button is
                * disabled. A parent under the limit does not need a running
                * count of how much plan they have left.
                */}
              {atLimit && (
                <span className="text-xs text-muted">
                  {t("children.atLimit", { plan: plan.planName, count: plan.learnerLimit })}
                </span>
              )}
            </div>
          )}
        </header>
        )}

        {error && <p className={themeSystem.flash("error")}>{error}</p>}
        {notice && <p className={themeSystem.flash("success")}>{notice}</p>}

        {loading ? <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted dark:bg-surface">{t("profile.children.loading")}</div> : learners.length === 0 ? <section className={themeSystem.card("default", "p-6 text-center")}><UserRound className="mx-auto h-10 w-10 text-indigo-300" /><h2 className="mt-3 text-lg font-semibold text-ink">{t("profile.children.none")}</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted">{t("children.noneNote")}</p>{canCreate && <UIButton className="mt-4" icon={<Plus />} disabled={atLimit} onClick={() => setCreateOpen(true)}>{t("children.add")}</UIButton>}</section> : <div className="grid gap-3 sm:grid-cols-2">{learners.map((learner) => (
          <article key={learner.id} className={themeSystem.card("default", "p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <UIAvatar name={learner.displayName} seed={learner.avatarSeed} size="md" />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-ink">{learner.displayName}</h2>
                  <p className="text-xs text-muted">{learner.birthYear ? t("children.born", { year: String(learner.birthYear) }) : t("profile.children.added", { date: formatDate(learner.createdAt) })}</p>
                  <p className="text-xs text-muted">{t("children.goalRounds", { count: DailyGoalAPI.for(learner.id) })}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {learner.hasActiveCode && <UIBadge variant="info">{t("children.codeActive")}</UIBadge>}
                {/*
                  * Edit and Remove live here rather than in the row below. They
                  * are occasional, and Remove is destructive — a red button on
                  * every card reads as a suggestion. The row keeps only what a
                  * parent actually does day to day.
                  */}
                {(canUpdate || canDelete) && (
                  <UIMenu
                    align="end"
                    trigger={({ toggle, isOpen }) => (
                      <button
                        type="button"
                        onClick={() => { playSound("pop"); toggle(); }}
                        aria-haspopup="menu"
                        aria-expanded={isOpen}
                        aria-label={t("children.moreActions", { name: learner.displayName })}
                        className={`rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${isOpen ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100" : ""}`}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    )}
                  >
                    {({ close }) => (
                      <>
                        {canUpdate && (
                          <UIMenuItem
                            icon={<Pencil />}
                            onSelect={() => { close(); setGoalDraft(DailyGoalAPI.for(learner.id)); setSettingsDraft(ChildSettingsAPI.for(learner.id)); setEditing({ ...learner }); }}
                          >
                            {t("profile.edit")}
                          </UIMenuItem>
                        )}
                        {canUpdate && canDelete && <UIMenuSeparator />}
                        {canDelete && (
                          <UIMenuItem
                            tone="danger"
                            icon={<Trash2 />}
                            onSelect={() => { close(); setDeleting(learner); }}
                          >
                            {t("children.remove")}
                          </UIMenuItem>
                        )}
                      </>
                    )}
                  </UIMenu>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {canReadRecord && <UIButton variant="primary" size="sm" icon={<LineChart />} onClick={() => { playSound("pop"); onOpenReport?.(learner.id); }}>{t("children.report")}</UIButton>}
              {canSwitch && <UIButton variant="secondary" size="sm" icon={<UserRound />} isLoading={busy === `switch:${learner.id}`} onClick={() => void switchToChild(learner)}>{t("children.switch")}</UIButton>}
              <UIButton variant={canReadRecord || canSwitch ? "secondary" : "primary"} size="sm" icon={<KeyRound />} isLoading={busy === `code:${learner.id}`} onClick={() => void issueCode(learner)}>{t("profile.device.button")}</UIButton>
            </div>
          </article>
        ))}</div>}

        <FamilyPinCard />
      </div>

      <UIModal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={t("children.add")} footer={<><UIButton variant="secondary" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</UIButton><UIButton variant="primary" isLoading={busy === "create"} disabled={!name.trim()} onClick={() => void createLearner()}>{t("children.createAndCode")}</UIButton></>}><div className="space-y-4"><p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">{t("children.createNote")}</p><label className="block space-y-1.5"><span className="koda-admin-label text-ink">{t("children.name")}</span><input className={field} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t("children.namePlaceholder")} /></label><label className="block space-y-1.5"><span className="koda-admin-label text-ink">{t("children.birthYear")} <span className="font-normal text-muted">({t("common.optional").toLocaleLowerCase()})</span></span><input className={field} type="number" min="1900" max={new Date().getFullYear()} value={birthYear} onChange={(event) => setBirthYear(event.target.value)} placeholder="2017" /></label></div></UIModal>

      <UIModal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={t("children.edit")} footer={<><UIButton variant="secondary" onClick={() => setEditing(null)}>{t("common.cancel")}</UIButton><UIButton variant="primary" isLoading={Boolean(editing && busy === `edit:${editing.id}`)} onClick={() => void saveLearner()}>{t("children.save")}</UIButton></>}>
        {editing && <div className="space-y-4"><label className="block space-y-1.5"><span className="koda-admin-label text-ink">{t("children.name")}</span><input className={field} value={editing.displayName} onChange={(event) => setEditing({ ...editing, displayName: event.target.value })} /></label><label className="block space-y-1.5"><span className="koda-admin-label text-ink">{t("children.birthYear")} <span className="font-normal text-muted">({t("common.optional").toLocaleLowerCase()})</span></span><input className={field} type="number" value={editing.birthYear ?? ""} onChange={(event) => setEditing({ ...editing, birthYear: event.target.value ? Number(event.target.value) : null })} /></label><DailyGoalField label={t("home.dailyGoal")} hint={t("children.goalHint", { name: editing.displayName || t("children.thisChild") })} value={goalDraft} onChange={setGoalDraft} />
          {/*
            * The rules, under a heading of their own. Above this line is who the
            * child is; below it is how Koda treats them — two different kinds of
            * decision, and running them together made the form read as a list of
            * unrelated fields.
            */}
          <div className="space-y-3 border-t border-line pt-4">
            <div>
              <h3 className="koda-admin-label text-ink">
                {t("children.kodaSettings")}
              </h3>
              <p className="text-xs text-muted">{t("children.everyDevice")}</p>
            </div>
            <ChildSettingsFields
              value={settingsDraft}
              onChange={(patch) => setSettingsDraft((current) => ({ ...current, ...patch }))}
              childName={editing.displayName}
              planHasAi={plan.ai}
              /* Read from the draft, not the saved record, so a parent filling in
                 the birth year sees the age-band placement move in the same
                 gesture rather than after a save and a reopen. */
              childAge={editing.birthYear ? ageFromBirthYear(editing.birthYear) : null}
            />
          </div>
        </div>}
      </UIModal>

      <UIModal isOpen={Boolean(codeResult)} onClose={() => setCodeResult(null)} title={t("profile.device.modalTitle", { name: codeResult?.learner.displayName ?? t("account.role.child") })} tone="plain" footer={<UIButton variant="primary" onClick={() => setCodeResult(null)}>{t("skillCard.done")}</UIButton>}>
        {codeResult && <div className="space-y-5 text-center"><p className="text-sm text-muted">{tNodes("profile.device.howTo", { childCode: <strong>{t("account.childCode")}</strong> })}</p><div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-5 dark:border-indigo-800 dark:bg-indigo-950/40"><div className="font-mono text-3xl font-bold tracking-[0.3em] text-indigo-800 dark:text-indigo-200">{codeResult.code}</div><p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">{t("profile.device.expires", { time: formatInLanguage(codeResult.expiresAt, { hour: "numeric", minute: "2-digit" }) })}</p></div><UIButton variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => void copyCode()}>{copied ? t("profile.device.copied") : t("profile.device.copy")}</UIButton><p className="text-xs text-muted">{t("profile.device.private")}</p></div>}
      </UIModal>

      {/* Removing a child takes their profile and their devices with it, so it is confirmed. */}
      <UIDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} title={t("children.removeTitle")} description={t("children.removeBody", { name: deleting?.displayName ?? t("children.thisChildCap") })} confirmText={t("children.remove")} variant="danger" onConfirm={() => { if (deleting) void deleteLearner(deleting); }} />
    </div>
  );
};
