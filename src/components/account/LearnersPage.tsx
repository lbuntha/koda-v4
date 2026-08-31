import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, KeyRound, LineChart, MoreVertical, Pencil, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";

import { ApiError, accessToken, request, SessionAPI, usePermissions, useSession } from "../../lib/sync";
import { DAILY_GOAL_DEFAULT, DailyGoalAPI } from "../../lib/dailyGoal";
import { CHILD_SETTINGS_DEFAULTS, ChildSettingsAPI, type ChildSettings } from "../../lib/childSettings";
import { Billing } from "../../lib/billing";
import { useBilling } from "../../lib/useBilling";
import { DailyGoalField } from "./DailyGoalField";
import { ChildSettingsFields } from "./ChildSettingsFields";
import { FamilyPinCard } from "./FamilyPinCard";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIAvatar, UIBadge, UIButton, UIDialog, UIMenu, UIMenuItem, UIMenuSeparator, UIModal } from "../ui";
import { ChildReportPage } from "./ChildReportPage";
import { NoAccess } from "./NoAccess";

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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value),
  );

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
      setNotice("Child profile created. Share this code with the child.");
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
      const changed = (Object.keys(settingsDraft) as (keyof ChildSettings)[]).some(
        (key) => settingsDraft[key] !== saved[key],
      );
      if (changed) ChildSettingsAPI.set(editing.id, settingsDraft);
      setLearners((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditing(null);
      setNotice("Child profile updated.");
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
      setNotice(`${learner.displayName} was removed.`);
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
    return <NoAccess title="Children" permission="learner:read" what="Only family members with child access can view children." />;
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
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="koda-admin-page-title">Children</h1><p className="mt-1 text-sm text-[#6D6997] dark:text-muted">Each child learns on their own device.</p></div>
          {canCreate && (
            <div className="flex flex-wrap items-center gap-3">
              <UIButton
                variant="primary"
                icon={<Plus />}
                disabled={atLimit}
                onClick={() => setCreateOpen(true)}
              >
                Add child
              </UIButton>
              {/*
                * Only shown once the limit is reached, to say why the button is
                * disabled. A parent under the limit does not need a running
                * count of how much plan they have left.
                */}
              {atLimit && (
                <span className="text-xs text-muted">
                  {`The ${plan.planName} plan covers ${plan.learnerLimit} ${plan.learnerLimit === 1 ? "child" : "children"}. Upgrade to add another.`}
                </span>
              )}
            </div>
          )}
        </header>

        {error && <p className={themeSystem.flash("error")}>{error}</p>}
        {notice && <p className={themeSystem.flash("success")}>{notice}</p>}

        {loading ? <div className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted dark:bg-surface">Loading children…</div> : learners.length === 0 ? <section className={themeSystem.card("default", "p-8 text-center")}><UserRound className="mx-auto h-10 w-10 text-indigo-300" /><h2 className="mt-3 text-lg font-semibold text-ink">No child profiles yet</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted">Add a child to create their learning space and pair their tablet with a secure one-time code.</p>{canCreate && <UIButton className="mt-4" icon={<Plus />} disabled={atLimit} onClick={() => setCreateOpen(true)}>Add first child</UIButton>}</section> : <div className="grid gap-4 sm:grid-cols-2">{learners.map((learner) => (
          <article key={learner.id} className={themeSystem.card("default", "p-5")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <UIAvatar name={learner.displayName} seed={learner.avatarSeed} size="md" />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-ink">{learner.displayName}</h2>
                  <p className="text-xs text-muted">Added {formatDate(learner.createdAt)}{learner.birthYear ? ` · born ${learner.birthYear}` : ""}</p>
                  <p className="text-xs text-muted">Daily goal · {DailyGoalAPI.for(learner.id)} rounds</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {learner.hasActiveCode && <UIBadge variant="warning">Code active</UIBadge>}
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
                        aria-label={`More actions for ${learner.displayName}`}
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
                            Edit profile
                          </UIMenuItem>
                        )}
                        {canUpdate && canDelete && <UIMenuSeparator />}
                        {canDelete && (
                          <UIMenuItem
                            tone="danger"
                            icon={<Trash2 />}
                            onSelect={() => { close(); setDeleting(learner); }}
                          >
                            Remove child
                          </UIMenuItem>
                        )}
                      </>
                    )}
                  </UIMenu>
                )}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {canReadRecord && <UIButton variant="primary" size="sm" icon={<LineChart />} onClick={() => { playSound("pop"); onOpenReport?.(learner.id); }}>View report</UIButton>}
              {canSwitch && <UIButton variant="secondary" size="sm" icon={<UserRound />} isLoading={busy === `switch:${learner.id}`} onClick={() => void switchToChild(learner)}>Switch to child</UIButton>}
              <UIButton variant={canReadRecord || canSwitch ? "secondary" : "primary"} size="sm" icon={<KeyRound />} isLoading={busy === `code:${learner.id}`} onClick={() => void issueCode(learner)}>Get device code</UIButton>
            </div>
          </article>
        ))}</div>}

        <FamilyPinCard />
      </div>

      <UIModal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add child" footer={<><UIButton variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</UIButton><UIButton variant="primary" isLoading={busy === "create"} disabled={!name.trim()} onClick={() => void createLearner()}>Create and get code</UIButton></>}><div className="space-y-4"><p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">The child does not need an email or password. You will receive a one-time code after creating this profile.</p><label className="block space-y-1.5"><span className="koda-admin-label text-ink">Child's name</span><input className={field} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Mia" /></label><label className="block space-y-1.5"><span className="koda-admin-label text-ink">Birth year <span className="font-normal text-muted">(optional)</span></span><input className={field} type="number" min="1900" max={new Date().getFullYear()} value={birthYear} onChange={(event) => setBirthYear(event.target.value)} placeholder="2017" /></label></div></UIModal>

      <UIModal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit child" footer={<><UIButton variant="secondary" onClick={() => setEditing(null)}>Cancel</UIButton><UIButton variant="primary" isLoading={Boolean(editing && busy === `edit:${editing.id}`)} onClick={() => void saveLearner()}>Save changes</UIButton></>}>
        {editing && <div className="space-y-4"><label className="block space-y-1.5"><span className="koda-admin-label text-ink">Child's name</span><input className={field} value={editing.displayName} onChange={(event) => setEditing({ ...editing, displayName: event.target.value })} /></label><label className="block space-y-1.5"><span className="koda-admin-label text-ink">Birth year <span className="font-normal text-muted">(optional)</span></span><input className={field} type="number" value={editing.birthYear ?? ""} onChange={(event) => setEditing({ ...editing, birthYear: event.target.value ? Number(event.target.value) : null })} /></label><DailyGoalField label="Daily goal" hint={`Rounds ${editing.displayName || "this child"} aims to finish each day`} value={goalDraft} onChange={setGoalDraft} />
          {/*
            * The rules, under a heading of their own. Above this line is who the
            * child is; below it is how Koda treats them — two different kinds of
            * decision, and running them together made the form read as a list of
            * unrelated fields.
            */}
          <div className="space-y-3 border-t border-line pt-4">
            <div>
              <h3 className="koda-admin-label text-ink">
                How Koda behaves for {editing.displayName.trim() || "this child"}
              </h3>
              <p className="text-xs text-muted">
                These follow {editing.displayName.trim() || "this child"} to every device they sign in on.
              </p>
            </div>
            <ChildSettingsFields
              value={settingsDraft}
              onChange={(patch) => setSettingsDraft((current) => ({ ...current, ...patch }))}
              childName={editing.displayName}
              planHasAi={plan.ai}
            />
          </div>
        </div>}
      </UIModal>

      <UIModal isOpen={Boolean(codeResult)} onClose={() => setCodeResult(null)} title={`Device code for ${codeResult?.learner.displayName ?? "child"}`} footer={<UIButton variant="primary" onClick={() => setCodeResult(null)}>Done</UIButton>}>
        {codeResult && <div className="space-y-5 text-center"><p className="text-sm text-muted">On the child's device, choose <strong>Child code</strong> on the sign-in screen and enter this code.</p><div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-5 dark:border-indigo-800 dark:bg-indigo-950/40"><div className="font-mono text-3xl font-bold tracking-[0.3em] text-indigo-800 dark:text-indigo-200">{codeResult.code}</div><p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">Expires {new Date(codeResult.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · single use</p></div><UIButton variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => void copyCode()}>{copied ? "Copied" : "Copy code"}</UIButton><p className="text-xs text-muted">Keep this code private. It cannot be used again after the child joins.</p></div>}
      </UIModal>

      {/* Removing a child takes their profile and their devices with it, so it is confirmed. */}
      <UIDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} title="Remove child?" description={`${deleting?.displayName ?? "This child"} will be removed and their devices signed out. Their learning history goes with the profile.`} confirmText="Remove child" variant="danger" onConfirm={() => { if (deleting) void deleteLearner(deleting); }} />
    </div>
  );
};
