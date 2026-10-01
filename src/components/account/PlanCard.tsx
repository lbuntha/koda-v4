import React, { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, CreditCard, Sparkles } from "lucide-react";

import { AI_FEATURE, Billing, formatPrice, type Plan, type UpgradeRequest } from "../../lib/billing";
import { useBilling } from "../../lib/useBilling";
import { ApiError, usePermissions } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIModal, UISectionHeader } from "../ui";

import { translate } from "../../lib/i18n";
const when = (iso: string | null): string | null =>
  iso
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(iso),
      )
    : null;

/**
 * The family's own plan, in a sentence they can act on — and the way onto a
 * better one.
 *
 * Upgrading is a *request*, not a purchase, and the card says so rather than
 * pretending otherwise. There is no card processor yet: pressing Upgrade
 * records which plan the family wants, an operator sees it on the Billing
 * screen and grants it, and nothing about what the family may do changes until
 * they do. When checkout arrives it answers the same request in the same place
 * — the button, the plan chooser and the "asked for" state all stay.
 *
 * What it must never become is a button that grants itself. A family on the
 * free plan pressing Upgrade must still be on the free plan a second later,
 * because the alternative is Ask Koda for anybody who clicks.
 */
export const PlanCard: React.FC = () => {
  const plan = useBilling();
  const { can } = usePermissions();
  // The same right the route checks. A caregiver sees the plan and no button,
  // rather than a button whose press would come back refused.
  const mayBuy = can("family:update");
  const renews = when(plan.renewsAt);

  const [choosing, setChoosing] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [asked, setAsked] = useState<UpgradeRequest | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Billing.upgradeRequest().then(setAsked);
  }, [plan.planId]);

  const open = useCallback(async () => {
    playSound("pop");
    setError(null);
    setChoosing(true);
    try {
      const catalogue = await Billing.plans();
      setPlans(catalogue);
      // Pre-select what they already asked for, or the cheapest plan that is
      // actually a step up — a chooser that opens on nothing makes a parent
      // pick twice to do the obvious thing.
      const better = catalogue.filter((row) => row.priceCents > plan.priceCents);
      setPicked(asked?.planId ?? better[0]?.planId ?? null);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }, [asked, plan.priceCents]);

  const send = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      setAsked(await Billing.requestUpgrade(picked));
      setChoosing(false);
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
        icon={<CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        action={
          mayBuy && !asked ? (
            <UIButton variant="primary" size="sm" icon={<ArrowUpRight />} onClick={() => void open()}>
              {translate("admin.planCard.upgrade")}
            </UIButton>
          ) : undefined
        }
      />

      {error && !choosing && <p className={themeSystem.flash("error")}>{error}</p>}

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
            {translate("admin.planCard.learnersusedOfLearnerlimitValueValue2", { learnersUsed: plan.learnersUsed, learnerLimit: plan.learnerLimit, value: plan.learnerLimit === 1 ? translate("admin.planCard.child") : translate("admin.planCard.children"), value2: renews ? translate("admin.planCard.renewsRenews", { renews: renews }) : "" })}
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
          <p className="text-xs text-indigo-900 dark:text-indigo-200">
            {translate("admin.planCard.youAskedFor")}{" "}<strong>{asked.planName}</strong>{translate("admin.planCard.cardPaymentIsNotSwitchedOn")}
          </p>
          {mayBuy && (
            <UIButton variant="ghost" size="sm" isLoading={busy} onClick={() => void withdraw()}>
              {translate("admin.planCard.cancelRequest")}
            </UIButton>
          )}
        </div>
      ) : (
        !plan.has(AI_FEATURE) && (
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
            <p className="text-xs text-indigo-900 dark:text-indigo-200">
              {translate("admin.planCard.everyLessonEveryBadgeAndThe")}{" "}<strong>{translate("admin.planCard.askKoda")}</strong>{" "}{translate("admin.planCard.writtenHelpSpokenGuidanceTheVoice")}
            </p>
          </div>
        )
      )}

      <UIModal
        isOpen={choosing}
        onClose={() => setChoosing(false)}
        title={translate("admin.planCard.chooseAPlan")}
        footer={
          <>
            <UIButton variant="secondary" onClick={() => setChoosing(false)}>
              {translate("admin.planCard.cancel")}
            </UIButton>
            <UIButton
              variant="primary"
              isLoading={busy}
              disabled={!picked || picked === plan.planId}
              onClick={() => void send()}
            >
              {translate("admin.planCard.requestThisPlan")}
            </UIButton>
          </>
        }
      >
        <div className="space-y-3">
          {error && <p className={themeSystem.flash("error")}>{error}</p>}

          {plans.map((row) => {
            const isCurrent = row.planId === plan.planId;
            const isPicked = row.planId === picked;
            return (
              <button
                key={row.planId}
                type="button"
                disabled={isCurrent}
                onClick={() => setPicked(row.planId)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isPicked
                    ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                    : "border-line bg-surface hover:border-indigo-300"
                } ${isCurrent ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-mono text-sm font-bold text-ink">{row.name}</h4>
                    {isCurrent && <UIBadge variant="neutral">{translate("admin.planCard.yourPlan")}</UIBadge>}
                    {isPicked && !isCurrent && <Check className="h-4 w-4 text-indigo-600" />}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    {row.priceCents === 0
                      ? translate("admin.planCard.free")
                      : `${formatPrice(row.priceCents, row.currency)}/month`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{row.description}</p>
                <p className="mt-1 text-xs text-muted">
                  {translate("admin.planCard.upToLearnerlimitValueValue2", { learnerLimit: row.learnerLimit, value: row.learnerLimit === 1 ? translate("admin.planCard.child") : translate("admin.planCard.children"), value2: row.features.includes(AI_FEATURE) ? translate("admin.planCard.askKodaIncluded2") : "" })}
                </p>
              </button>
            );
          })}

          {/*
            * Said plainly, because a button labelled "Request this plan" beside
            * a price looks like a checkout. A parent who believes they have
            * paid and then finds Ask Koda still off has been misled by this
            * screen, and one sentence is what that costs to avoid.
            */}
          <p className="text-xs text-muted">
            {translate("admin.planCard.noCardIsTakenYetThis")}
          </p>
        </div>
      </UIModal>
    </section>
  );
};
