import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";

import { AI_FEATURE, Billing, formatPrice, type Plan, type SandboxCheckout, type UpgradeRequest } from "../../lib/billing";
import { useBilling } from "../../lib/useBilling";
import { ApiError, usePermissions } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIModal, UISectionHeader, UIArtIcon } from "../ui";
import { PlanPaymentReview, SandboxPaymentCode } from "./PlanPaymentReview";

import { translate } from "../../lib/i18n";
const when = (iso: string | null): string | null =>
  iso
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(iso),
      )
    : null;

export const PlanCard: React.FC<{ onPaymentConfirmed?: () => void }> = ({ onPaymentConfirmed }) => {
  const plan = useBilling();
  const { can } = usePermissions();
  // The same right the route checks. A caregiver sees the plan and no button,
  // rather than a button whose press would come back refused.
  const mayBuy = can("family:update");
  const accessEnds = when(plan.renewsAt);

  const [choosing, setChoosing] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [asked, setAsked] = useState<UpgradeRequest | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sandboxAvailable, setSandboxAvailable] = useState(false);
  const [checkout, setCheckout] = useState<SandboxCheckout | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [checking, setChecking] = useState(false);
  const checkInFlight = useRef(false);
  const selectedPlan = plans.find((row) => row.planId === picked && row.planId !== plan.planId);
  const useSandbox = sandboxAvailable && selectedPlan?.currency === "USD" && selectedPlan.priceCents > 0;
  const pending = checkout?.status === "pending" ? checkout : null;

  useEffect(() => {
    void Billing.upgradeRequest().then(setAsked);
  }, [plan.planId]);

  useEffect(() => {
    if (!mayBuy) return;
    let stopped = false;
    void Billing.sandboxCheckout().then((result) => {
      if (stopped) return;
      setSandboxAvailable(result.available);
      if (result.checkout) setCheckout(result.checkout);
    }).catch(() => undefined);
    return () => { stopped = true; };
  }, [mayBuy]);

  const checkPayment = useCallback(async (reference: string, manual = false) => {
    if (checkInFlight.current) return;
    checkInFlight.current = true;
    if (manual) {
      setChecking(true);
      setError(null);
    }
    try {
      const result = await Billing.checkSandboxCheckout(reference);
      setCheckout(result);
      if (result.status === "paid") {
        setConfirmed(true);
        setChoosing(false);
        setAsked(await Billing.upgradeRequest());
        await Billing.refresh();
        onPaymentConfirmed?.();
      }
    } catch (err) {
      if (manual) setError((err as ApiError).message);
    } finally {
      checkInFlight.current = false;
      if (manual) setChecking(false);
    }
  }, [onPaymentConfirmed]);

  const pendingReference = pending?.reference;
  useEffect(() => {
    if (!pendingReference) return;
    const timer = window.setInterval(() => void checkPayment(pendingReference), 5000);
    return () => window.clearInterval(timer);
  }, [pendingReference, checkPayment]);

  const open = useCallback(async () => {
    playSound("pop");
    setError(null);
    setPlans([]);
    setPicked(null);
    setLoadingPlans(true);
    setChoosing(true);
    try {
      const [catalogue, sandbox] = await Promise.all([
        Billing.plans(),
        Billing.sandboxCheckout().catch(() => null),
      ]);
      if (sandbox) {
        setSandboxAvailable(sandbox.available);
        setCheckout(sandbox.checkout);
      }
      setPlans(catalogue);
      // Pre-select what they already asked for, or the cheapest plan that is
      // actually a step up — a chooser that opens on nothing makes a parent
      // pick twice to do the obvious thing.
      const available = catalogue.filter((row) => row.planId !== "free" && row.planId !== plan.planId);
      const preferred = available.find((row) => row.planId === asked?.planId)
        ?? available.find((row) => row.priceCents > plan.priceCents)
        ?? available[0];
      setPicked(preferred?.planId ?? null);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoadingPlans(false);
    }
  }, [asked, plan.planId, plan.priceCents]);

  const send = async () => {
    if (!selectedPlan) return;
    setBusy(true);
    setError(null);
    try {
      if (useSandbox) {
        setConfirmed(false);
        setCheckout(await Billing.startSandboxCheckout(selectedPlan.planId));
      } else {
        setAsked(await Billing.requestUpgrade(selectedPlan.planId));
        setChoosing(false);
      }
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      await Billing.cancelUpgrade();
      setAsked(null);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title={translate("admin.planCard.yourPlan")}
        subtitle={translate("admin.planCard.whatThisFamilySAccountIncludes")}
        icon={<UIArtIcon id="kit-card" className="h-6 w-6" />}
        action={
          mayBuy && (!asked || sandboxAvailable || pending) ? (
            <UIButton variant="primary" size="sm" icon={<ArrowUpRight />} isLoading={loadingPlans} onClick={() => void open()}>
              {translate(pending ? "admin.planPayment.resumeCheckout" : "admin.planCard.upgrade")}
            </UIButton>
          ) : undefined
        }
      />

      {error && !choosing && <p className={themeSystem.flash("error")}>{error}</p>}
      {confirmed && <p role="status" className={themeSystem.flash("success")}>{translate("admin.planPayment.sandboxConfirmed")}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-mono text-sm font-bold text-ink">{plan.planName}</h4>
            {plan.priceCents > 0 && (
              <UIBadge variant="primary">
                {formatPrice(plan.priceCents, plan.currency)}/month
              </UIBadge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {translate("admin.planCard.learnersusedOfLearnerlimitValueValue2", { learnersUsed: plan.learnersUsed, learnerLimit: plan.learnerLimit, value: plan.learnerLimit === 1 ? translate("admin.planCard.child") : translate("admin.planCard.children"), value2: accessEnds ? translate("admin.planPayment.accessEnds", { date: accessEnds }) : "" })}
          </p>
        </div>
        <UIBadge variant={plan.has(AI_FEATURE) ? "success" : "neutral"}>
          {plan.has(AI_FEATURE) ? translate("admin.planCard.askKodaIncluded") : translate("admin.planCard.askKodaNotIncluded")}
        </UIBadge>
      </div>

      {/*
        * An ask in flight, shown instead of the pitch.
        *
        * A parent who has already pressed Upgrade should not be sold to again
        * on the same card — the useful thing to tell them is that it landed,
        * and how to take it back.
        */}
      {asked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
          <p role="status" className="text-sm text-indigo-900 dark:text-indigo-200">
            {translate("admin.planPayment.requestReceived", { plan: asked.planName })}
          </p>
          {mayBuy && (
            <UIButton variant="ghost" size="sm" isLoading={busy} onClick={() => void withdraw()}>
              {translate("admin.planCard.cancelRequest")}
            </UIButton>
          )}
        </div>
      ) : (
        !plan.has(AI_FEATURE) && (
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
            <UIArtIcon id="menu-koda" className="size-6 shrink-0" />
            <p className="text-xs text-indigo-900 dark:text-indigo-200">
              {translate("admin.familyBilling.askKodaHelp")}
            </p>
          </div>
        )
      )}

      <UIModal
        isOpen={choosing}
        onClose={() => { if (!busy) setChoosing(false); }}
        title={translate("admin.planPayment.title")}
        maxWidth="max-w-3xl"
        footer={
          <>
            <UIButton variant="secondary" disabled={busy} onClick={() => setChoosing(false)}>
              {translate(pending ? "common.close" : "admin.planCard.cancel")}
            </UIButton>
            <UIButton
              variant="primary"
              isLoading={busy || checking}
              disabled={!pending && !selectedPlan}
              onClick={() => pending ? void checkPayment(pending.reference, true) : void send()}
            >
              {translate(pending
                ? "admin.planPayment.checkPayment"
                : useSandbox ? "admin.planPayment.showQr" : "admin.planCard.requestThisPlan")}
            </UIButton>
          </>
        }
      >
        {error && <p role="alert" className={themeSystem.flash("error")}>{error}</p>}
        {loadingPlans && <p role="status" className="text-sm text-ink/75">{translate("admin.planPayment.loadingPlans")}</p>}
        {pending && <SandboxPaymentCode checkout={pending} />}
        {checkout?.status === "closed" && <p role="status" className="text-sm text-ink/75">{translate("admin.planPayment.checkoutClosed")}</p>}
        {!pending && !loadingPlans && !error && !selectedPlan && (
          <p className="text-sm text-ink/75">{translate("admin.planPayment.noPlans")}</p>
        )}
        {!pending && plans.length > 0 && (
          <div className="grid items-start gap-4 md:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="koda-admin-section-title mb-2">{translate("admin.planCard.chooseAPlan")}</legend>
              <div className="space-y-2">
                {plans.filter((row) => row.planId !== "free" || row.planId === plan.planId).map((row) => {
                  const isCurrent = row.planId === plan.planId;
                  const isPicked = row.planId === picked;
                  return (
                    <label
                      key={row.planId}
                      className={`block w-full rounded-2xl border p-3 text-left transition focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 ${
                        isPicked
                          ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                          : "border-line bg-surface hover:border-indigo-300"
                      } ${isCurrent ? "" : "cursor-pointer"}`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="upgrade-plan"
                        checked={isPicked}
                        disabled={isCurrent || busy}
                        onChange={() => setPicked(row.planId)}
                      />
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="koda-admin-card-title break-words">{row.name}</span>
                          {isCurrent && <UIBadge variant="neutral">{translate("admin.planCard.yourPlan")}</UIBadge>}
                          {isPicked && !isCurrent && <Check aria-hidden="true" className="size-4 text-indigo-600 dark:text-indigo-300" />}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-ink">
                          {row.priceCents === 0
                            ? translate("admin.planCard.free")
                            : `${formatPrice(row.priceCents, row.currency)}/month`}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-ink/75">{row.description}</span>
                      <span className="mt-1 block text-sm text-ink/75">
                        {translate("admin.planCard.upToLearnerlimitValueValue2", { learnerLimit: row.learnerLimit, value: row.learnerLimit === 1 ? translate("admin.planCard.child") : translate("admin.planCard.children"), value2: row.features.includes(AI_FEATURE) ? translate("admin.planCard.askKodaIncluded2") : "" })}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {selectedPlan && <PlanPaymentReview plan={selectedPlan} sandbox={useSandbox} />}
          </div>
        )}
      </UIModal>
    </section>
  );
};
