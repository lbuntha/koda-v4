/**
 * Parent setup: from a new account to a child playing, in three short steps.
 *
 *   1  Add your child      name, birth year (suggests the grade) + grade (required: it picks the lessons)
 *   2  Where will they learn?
 *        On this phone   → a parent PIN (skippable), then the child opens here
 *        Their own device → a QR code, the typed code, Share and Copy
 *   3  Hear how they're doing   push on this device, progress emails (skippable)
 *   ✓  All set              start the first lesson · add another · dashboard
 *
 * Opens by itself the first time a parent with no children arrives, and again
 * from every "Add a child" button. A full screen of one question at a time on a
 * phone, a centred column on anything wider. Every step after the name can be
 * skipped; closing keeps what was done, and Home goes on offering the rest.
 *
 * The network is needed here (a child is a server record, and so is their
 * code), so a failed call says "you're offline" in words rather than spinning.
 */

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  Copy,
  Mail,
  PartyPopper,
  Share2,
  ShieldCheck,
  Smartphone,
  TabletSmartphone,
  X,
} from "lucide-react";
import { ApiError, accessToken, request, SessionAPI, useSession } from "../../lib/sync";
import { Billing } from "../../lib/billing";
import { useBilling } from "../../lib/useBilling";
import { FamilyPin, PIN_LENGTH, isWellFormed } from "../../lib/familyPin";
import { GRADE_CHIPS } from "../../lib/ages";
import {
  chooseNotification,
  enableNotifications,
  notificationPreferences,
  notificationsAreOn,
  pushSupport,
  type NotificationPreferences,
} from "../../lib/push";
import { themeSystem } from "../../lib/themeSystem";
import { formatDate, useT } from "../../lib/i18n";
import { playSound } from "../../utils/audio";
import { UIButton, UIQrCode } from "../ui";

interface CreatedChild {
  id: string;
  name: string;
}

interface JoinCode {
  code: string;
  expiresAt: string;
}

type Step = "child" | "where" | "pin" | "code" | "alerts" | "done";
type Where = "here" | "own";

const emailIsOn = (prefs: NotificationPreferences) =>
  Boolean(prefs.emailEnabled && !prefs.emailStopped && prefs.emailKinds?.some((kind) => kind.on));

/** Grade → age, by the rule the Studio uses: Grade 1 is six, Pre-K is five. */
const ageForGrade = (grade: number) => (grade === 0 ? 5 : grade + 5);

/** Birth years a parent can pick (ages 3 to 19), and the grade each suggests: six is Grade 1, under six Pre-K. */
const CHILD_YEARS: readonly number[] = Array.from({ length: 17 }, (_, i) => new Date().getFullYear() - 3 - i);
const gradeForYear = (year: number) => Math.min(12, Math.max(0, new Date().getFullYear() - year - 5));

/** The flag that stops the wizard opening by itself a second time. */
export const setupSeenKey = (userId: string) => `koda.parentSetup.seen.${userId}`;

export const markSetupSeen = (userId: string | null | undefined) => {
  if (!userId) return;
  try {
    localStorage.setItem(setupSeenKey(userId), "1");
  } catch {
    /* a convenience: without storage the wizard may offer itself again */
  }
};

export const ParentSetup: React.FC<{ onClose(): void }> = ({ onClose }) => {
  const { t } = useT();
  const session = useSession();
  const [step, setStep] = useState<Step>("child");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  /** Optional: a birth year is more exact than a grade, and picking one suggests the grade. */
  const [birthYear, setBirthYear] = useState("");
  const [child, setChild] = useState<CreatedChild | null>(null);
  const [where, setWhere] = useState<Where | null>(null);
  const [code, setCode] = useState<JoinCode | null>(null);
  const [pin, setPin] = useState("");
  const [pinAgain, setPinAgain] = useState("");
  /** Asked once per visit: a second child does not repeat the alerts step. */
  const [alertsAsked, setAlertsAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * Whether the plan has room for another child. The server is what refuses;
   * this only stops the wizard offering a step that would end in that refusal.
   */
  const plan = useBilling();
  const atLimit = plan.learnersUsed >= plan.learnerLimit;
  const limitNote = t("children.atLimit", { plan: plan.planName, count: plan.learnerLimit });

  useEffect(() => markSetupSeen(session?.userId), [session?.userId]);

  // Escape closes, as every other sheet in the app does.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const childName = child?.name ?? name.trim();

  const fail = (err: unknown) => {
    setError(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? t("setup.offline")
        : (err as ApiError)?.message || t("setup.somethingWrong"),
    );
  };

  const afterWhere = () => setStep(alertsAsked ? "done" : "alerts");

  /* Step 1 → create the child. */
  const createChild = async () => {
    if (!name.trim() || grade === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await request<{ id: string; displayName: string }>("/learners", {
        method: "POST",
        token: await accessToken(),
        body: { displayName: name.trim(), birthYear: birthYear ? Number(birthYear) : new Date().getFullYear() - ageForGrade(grade) },
      });
      setChild({ id: created.id, name: created.displayName });
      await Billing.refresh().catch(() => undefined);
      playSound("pop");
      setStep("where");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  /* Step 2 → this device, or their own. */
  const chooseWhere = async (choice: Where) => {
    if (!child || busy) return;
    setWhere(choice);
    setError(null);
    playSound("pop");
    if (choice === "here") {
      setBusy(true);
      const hasPin = await FamilyPin.isSet().catch(() => false);
      setBusy(false);
      if (hasPin) afterWhere();
      else setStep("pin");
      return;
    }
    setBusy(true);
    try {
      const result = await request<JoinCode>(`/learners/${child.id}/join-code`, {
        method: "POST",
        token: await accessToken(),
      });
      setCode({ code: result.code, expiresAt: result.expiresAt });
      setStep("code");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const savePin = async () => {
    if (!isWellFormed(pin)) return;
    if (pin !== pinAgain) {
      setError(t("pin.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await FamilyPin.set(pin);
      playSound("pop");
      afterWhere();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const startHere = async () => {
    if (!child) return;
    setBusy(true);
    try {
      await SessionAPI.switchToChild(child.id, child.name);
      onClose();
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  const addAnother = () => {
    setName("");
    setGrade(null);
    setBirthYear("");
    setChild(null);
    setWhere(null);
    setCode(null);
    setPin("");
    setPinAgain("");
    setError(null);
    setStep("child");
  };

  /* Which of the three dots is lit. */
  const dot = step === "child" ? 0 : step === "alerts" ? 2 : step === "done" ? 3 : 1;
  const back =
    step === "pin" || step === "code"
      ? () => setStep("where")
      : step === "alerts"
        ? () => setStep(where === "own" ? "code" : "where")
        : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("setup.title")}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-canvas animate-fadeIn"
    >
      {/* Top bar: back, three dots, close. */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="w-11">
            {back && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  back();
                }}
                aria-label={t("setup.back")}
                className="grid h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-surface-muted hover:text-ink"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i < dot ? "w-2 bg-violet-400" : i === dot ? "w-6 bg-violet-600" : "w-2 bg-slate-300 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
          <div className="w-11">
            <button
              type="button"
              onClick={onClose}
              aria-label={t("setup.later")}
              title={t("setup.later")}
              className="grid h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-surface-muted hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-6 pt-2 sm:px-6 sm:pb-10">
        {step === "child" && atLimit && (
          <Screen
            icon={<ShieldCheck className="h-7 w-7" />}
            title={t("setup.child.title")}
            body={limitNote}
            action={
              <UIButton variant="primary" className="w-full" onClick={onClose}>
                {t("setup.done.dashboard")}
              </UIButton>
            }
          />
        )}

        {step === "child" && !atLimit && (
          <Screen
            title={t("setup.child.title")}
            body={t("setup.child.body")}
            action={
              <UIButton
                variant="primary"
                className="w-full"
                isLoading={busy}
                disabled={!name.trim() || grade === null}
                onClick={() => void createChild()}
              >
                {t("setup.continue")}
              </UIButton>
            }
          >
            <label className="block">
              <span className="text-sm font-bold text-ink">{t("setup.child.name")}</span>
              <input
                className={`${themeSystem.field("lg", "w-full")} mt-1.5`}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- the step is this one field
                autoFocus
                value={name}
                maxLength={40}
                autoComplete="off"
                placeholder={t("setup.child.namePlaceholder")}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void createChild()}
              />
            </label>

            <label className="mt-6 block">
              <span className="text-sm font-bold text-ink">
                {name.trim() ? t("setup.child.yearFor", { name: name.trim() }) : t("setup.child.year")}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{t("setup.child.yearWhy")}</span>
              <select
                className={`${themeSystem.field("lg", "w-full")} mt-2`}
                value={birthYear}
                onChange={(event) => {
                  setBirthYear(event.target.value);
                  if (event.target.value) setGrade(gradeForYear(Number(event.target.value)));
                }}
              >
                <option value="">{t("setup.child.yearPick")}</option>
                {CHILD_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="mt-6">
              <legend className="text-sm font-bold text-ink">
                {name.trim() ? t("setup.child.gradeFor", { name: name.trim() }) : t("setup.child.grade")}
              </legend>
              <p className="mt-0.5 text-xs text-muted">{t("setup.child.gradeWhy")}</p>
              <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-7">
                {GRADE_CHIPS.map((chip) => {
                  const selected = grade === chip.grade;
                  return (
                    <button
                      key={chip.grade}
                      type="button"
                      aria-pressed={selected}
                      aria-label={chip.grade === 0 ? t("ages.preK") : t("ages.grade", { grade: chip.grade })}
                      onClick={() => {
                        setGrade(chip.grade);
                        playSound("pop");
                      }}
                      className={`h-12 rounded-2xl border-2 text-base font-black transition ${
                        chip.grade === 0 ? "col-span-2 sm:col-span-1 text-sm" : ""
                      } ${
                        selected
                          ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                          : "border-line bg-surface text-ink hover:border-violet-300"
                      }`}
                    >
                      {chip.grade === 0 ? t("ages.preK") : chip.grade}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Screen>
        )}

        {step === "where" && child && (
          <Screen title={t("setup.where.title", { name: child.name })} body={t("setup.where.body")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                icon={<Smartphone className="h-7 w-7" />}
                tone="violet"
                title={t("setup.where.here")}
                body={t("setup.where.hereBody", { name: child.name })}
                disabled={busy}
                onClick={() => void chooseWhere("here")}
              />
              <ChoiceCard
                icon={<TabletSmartphone className="h-7 w-7" />}
                tone="sky"
                title={t("setup.where.own")}
                body={t("setup.where.ownBody", { name: child.name })}
                disabled={busy}
                onClick={() => void chooseWhere("own")}
              />
            </div>
          </Screen>
        )}

        {step === "pin" && (
          <Screen
            icon={<ShieldCheck className="h-7 w-7" />}
            title={t("setup.pin.title")}
            body={t("setup.pin.body", { name: childName })}
            action={
              <>
                <UIButton
                  variant="primary"
                  className="w-full"
                  isLoading={busy}
                  disabled={!isWellFormed(pin) || pinAgain.length !== PIN_LENGTH}
                  onClick={() => void savePin()}
                >
                  {t("setup.pin.save")}
                </UIButton>
                <UIButton variant="ghost" className="w-full" onClick={afterWhere}>
                  {t("setup.notNow")}
                </UIButton>
              </>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <PinField label={t("setup.pin.new")} value={pin} onChange={setPin} autoFocus />
              <PinField label={t("setup.pin.again")} value={pinAgain} onChange={setPinAgain} />
            </div>
          </Screen>
        )}

        {step === "code" && code && child && (
          <CodeScreen
            code={code}
            name={child.name}
            action={
              <UIButton variant="primary" className="w-full" onClick={afterWhere}>
                {t("setup.continue")}
              </UIButton>
            }
          />
        )}

        {step === "alerts" && (
          <AlertsScreen
            name={childName}
            email={session?.email ?? null}
            onDone={() => {
              setAlertsAsked(true);
              setStep("done");
            }}
          />
        )}

        {step === "done" && child && (
          <Screen
            icon={<PartyPopper className="h-7 w-7" />}
            title={t("setup.done.title")}
            body={
              where === "here"
                ? t("setup.done.bodyHere", { name: child.name })
                : t("setup.done.bodyOwn", { name: child.name })
            }
            action={
              <>
                {where === "here" ? (
                  <UIButton variant="primary" className="w-full" isLoading={busy} onClick={() => void startHere()}>
                    {t("setup.done.start", { name: child.name })}
                  </UIButton>
                ) : (
                  <UIButton variant="primary" className="w-full" onClick={onClose}>
                    {t("setup.done.dashboard")}
                  </UIButton>
                )}
                {atLimit ? (
                  <p className="text-center text-sm text-muted">{limitNote}</p>
                ) : (
                  <UIButton variant="secondary" className="w-full" onClick={addAnother}>
                    {t("setup.done.another")}
                  </UIButton>
                )}
                {where === "here" && (
                  <UIButton variant="ghost" className="w-full" onClick={onClose}>
                    {t("setup.done.dashboard")}
                  </UIButton>
                )}
              </>
            }
          />
        )}

        {error && (
          <p role="alert" className={`mt-4 ${themeSystem.flash("error", "text-sm")}`}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * One step: an optional mark, a title, a sentence, the content, and the
 * buttons pinned to the bottom of a phone where a thumb is.
 */
const Screen: React.FC<{
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ icon, title, body, action, children }) => (
  <div className="flex flex-1 flex-col">
    <div className="pt-2 sm:pt-6">
      {icon && (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          {icon}
        </span>
      )}
      <h1 className="text-2xl font-black leading-tight text-ink sm:text-3xl">{title}</h1>
      <p className="mt-2 text-base text-muted">{body}</p>
    </div>
    {children && <div className="mt-6">{children}</div>}
    {action && <div className="mt-auto flex flex-col gap-2 pt-8 sm:mt-8">{action}</div>}
  </div>
);

const ChoiceCard: React.FC<{
  icon: React.ReactNode;
  tone: "violet" | "sky";
  title: string;
  body: string;
  disabled?: boolean;
  onClick(): void;
}> = ({ icon, tone, title, body, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`${themeSystem.card("interactive")} flex w-full items-center gap-4 p-4 text-left disabled:opacity-60 sm:flex-col sm:items-start sm:p-5`}
  >
    <span
      className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${
        tone === "violet"
          ? "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
          : "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
      }`}
    >
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block text-lg font-black leading-tight text-ink">{title}</span>
      <span className="mt-1 block text-sm text-muted">{body}</span>
    </span>
  </button>
);

const PinField: React.FC<{ label: string; value: string; onChange(v: string): void; autoFocus?: boolean }> = ({
  label,
  value,
  onChange,
  autoFocus,
}) => (
  <label className="block">
    <span className="text-sm font-bold text-ink">{label}</span>
    <input
      // eslint-disable-next-line jsx-a11y/no-autofocus -- the step is these two fields
      autoFocus={autoFocus}
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={PIN_LENGTH}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
      className={`${themeSystem.field("lg", "w-full")} mt-1.5 text-center font-mono text-2xl tracking-[0.5em]`}
    />
  </label>
);

/** Step 2, their own device: the code as a QR, as text, and as a message to send. */
const CodeScreen: React.FC<{ code: JoinCode; name: string; action: React.ReactNode }> = ({ code, name, action }) => {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?join=${code.code}`;
  const message = t("setup.code.message", { name, link, code: code.code });
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the code is on screen to read out instead */
    }
  };

  return (
    <Screen title={t("setup.code.title", { name })} body={t("setup.code.body", { name })} action={action}>
      <div className={`${themeSystem.card("default")} flex flex-col items-center gap-4 p-5 sm:p-6`}>
        <UIQrCode value={link} size={196} label={t("setup.code.qrLabel", { name })} />
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{t("setup.code.orType")}</p>
          <p className="mt-1 font-mono text-3xl font-black tracking-[0.25em] text-ink">{code.code}</p>
          <p className="mt-1 text-xs text-muted">
            {t("profile.device.expires", { time: formatDate(code.expiresAt, { hour: "numeric", minute: "2-digit" }) })}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          {canShare && (
            <UIButton
              variant="secondary"
              icon={<Share2 />}
              onClick={() => void navigator.share({ text: message }).catch(() => undefined)}
            >
              {t("setup.code.share")}
            </UIButton>
          )}
          <UIButton
            variant="secondary"
            className={canShare ? "" : "col-span-2"}
            icon={copied ? <Check /> : <Copy />}
            onClick={() => void copy()}
          >
            {copied ? t("profile.device.copied") : t("profile.device.copy")}
          </UIButton>
        </div>
      </div>
    </Screen>
  );
};

/**
 * Step 3: alerts on this device and progress email.
 *
 * Built from what the server says this deployment can send, so it never
 * offers a switch that does nothing — and steps straight past itself when
 * there is nothing to offer, or nothing reachable to ask.
 */
const AlertsScreen: React.FC<{ name: string; email: string | null; onDone(): void }> = ({ name, email, onDone }) => {
  const { t } = useT();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [pushState, setPushState] = useState<"off" | "on" | "denied" | "unavailable" | "busy">(() =>
    notificationsAreOn() ? "on" : "off",
  );
  const [emailOn, setEmailOn] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  useEffect(() => {
    let live = true;
    notificationPreferences()
      .then((loaded) => {
        if (!live) return;
        const support = pushSupport();
        const push = loaded.enabled && support.state !== "unsupported" && support.state !== "not-configured";
        const mail = loaded.emailEnabled && Boolean(loaded.emailKinds?.length);
        if (!push && !mail) onDone();
        else {
          setPrefs(loaded);
          setEmailOn(emailIsOn(loaded));
        }
      })
      .catch(() => live && onDone());
    return () => {
      live = false;
    };
    // `onDone` is the parent's step setter; asking once on arrival is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!prefs) return <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted">…</div>;

  const support = pushSupport();
  const pushOffered = prefs.enabled && support.state !== "unsupported" && support.state !== "not-configured";

  const turnOnPush = async () => {
    setPushState("busy");
    const outcome = await enableNotifications();
    setPushState(outcome.state === "on" ? "on" : outcome.state === "denied" ? "denied" : "unavailable");
  };

  /*
   * The server's rule: progress email goes out while "stop all" is not set
   * and at least one kind is chosen. Off is "stop all"; on lifts that and, for
   * an account that never picked a kind, turns them all on.
   */
  const toggleEmail = async () => {
    setEmailBusy(true);
    try {
      let next: NotificationPreferences;
      if (emailOn) {
        next = await chooseNotification("*", false, "email");
      } else {
        next = prefs.emailStopped ? await chooseNotification("*", true, "email") : prefs;
        if (!next.emailKinds?.some((kind) => kind.on)) {
          for (const kind of next.emailKinds ?? []) next = await chooseNotification(kind.id, true, "email");
        }
      }
      setPrefs(next);
      setEmailOn(emailIsOn(next));
    } catch {
      /* left as it was; Settings has the same switch */
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <Screen
      icon={<Bell className="h-7 w-7" />}
      title={t("setup.alerts.title", { name })}
      body={t("setup.alerts.body", { name })}
      action={
        <>
          <UIButton variant="primary" className="w-full" onClick={onDone}>
            {t("setup.continue")}
          </UIButton>
          <UIButton variant="ghost" className="w-full" onClick={onDone}>
            {t("setup.notNow")}
          </UIButton>
        </>
      }
    >
      <div className="space-y-3">
        {pushOffered && (
          <div className={`${themeSystem.card("default")} flex items-center gap-4 p-4`}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <Bell className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-ink">{t("setup.alerts.push")}</p>
              <p className="text-sm text-muted">
                {pushState === "denied"
                  ? t("setup.alerts.pushDenied")
                  : pushState === "unavailable"
                    ? t("setup.alerts.pushUnavailable")
                    : t("setup.alerts.pushBody")}
              </p>
            </div>
            {pushState === "on" ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-emerald-600">
                <Check className="h-4 w-4" /> {t("setup.alerts.on")}
              </span>
            ) : pushState === "off" || pushState === "busy" ? (
              <UIButton variant="primary" size="sm" isLoading={pushState === "busy"} onClick={() => void turnOnPush()}>
                {t("setup.alerts.turnOn")}
              </UIButton>
            ) : null}
          </div>
        )}

        {prefs.emailEnabled && Boolean(prefs.emailKinds?.length) && (
          <button
            type="button"
            role="switch"
            aria-checked={emailOn}
            disabled={emailBusy}
            onClick={() => void toggleEmail()}
            className={`${themeSystem.card("interactive")} flex w-full items-center gap-4 p-4 text-left`}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
              <Mail className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black text-ink">{t("setup.alerts.email")}</span>
              <span className="block truncate text-sm text-muted">
                {prefs.emailVerified || !email ? email ?? "" : t("setup.alerts.emailVerify", { email })}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${emailOn ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${emailOn ? "left-6" : "left-1"}`}
              />
            </span>
          </button>
        )}
      </div>
    </Screen>
  );
};
