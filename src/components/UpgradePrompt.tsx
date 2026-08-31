import React, { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";

import { formatPrice } from "../lib/billing";
import { FeatureGate } from "../lib/featureGate";
import { usePermissions } from "../lib/sync";
import { useBilling } from "../lib/useBilling";
import { themeSystem } from "../lib/themeSystem";
import { UIButton, UIModal } from "./ui";

/**
 * What a family is told when they reach for something their plan does not cover.
 *
 * Mounted once, by the app, and shown by `requireFeature` from anywhere. One
 * dialog rather than one per button, because the wording is the product
 * decision here — a child should get a plain sentence and a way to tell their
 * grown-up, and every surface should give them the same one.
 *
 * Two audiences reach the same gate, and they are told different things. An
 * adult who may change the plan is shown the way to it; a child is told to ask
 * their grown-up, because a seven-year-old cannot act on a price and offering
 * them one is how a tablet ends up ordering a subscription.
 */

/** What each sellable feature is, in words a seven-year-old can read. */
const FEATURE_COPY: Record<string, { title: string; blurb: string }> = {
  "ai.koda": {
    title: "Ask Koda",
    blurb:
      "Koda can talk you through a problem, read what you have drawn, and answer out loud.",
  },
};

export interface UpgradePromptProps {
  /**
   * The way to the plan card, for an adult who can act on this.
   *
   * Optional: without it the dialog still tells the truth, it just cannot
   * offer the shortcut — which is what a shell with no tab of its own wants.
   */
  onOpenPlan?: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({ onOpenPlan }) => {
  useSyncExternalStore(FeatureGate.subscribe, FeatureGate.version, FeatureGate.version);
  const plan = useBilling();
  const { can } = usePermissions();
  // The same right the upgrade route checks, so this never offers a button
  // whose press comes back refused.
  const mayBuy = can("family:update");
  const feature = FeatureGate.pending();
  const withheld = FeatureGate.withheld();

  /*
   * A grown-up in this family switched it off, which is not a plan problem and
   * must not be answered with a price. The child is told who to ask instead.
   */
  if (withheld) {
    const copy = FEATURE_COPY[withheld];
    return (
      <UIModal
        isOpen
        onClose={() => FeatureGate.dismiss()}
        title={copy?.title ?? "Switched off"}
        footer={
          <UIButton variant="primary" onClick={() => FeatureGate.dismiss()}>
            Okay
          </UIButton>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
            <p className="text-sm text-indigo-900 dark:text-indigo-200">
              Koda&rsquo;s help is switched off for you right now. Your grown-up chose that, and
              they can turn it back on.
            </p>
          </div>
          <p className="text-sm text-muted">
            Everything else still works — every lesson, every star, your streak and your badges.
          </p>
        </div>
      </UIModal>
    );
  }

  if (!feature) return null;
  const copy = FEATURE_COPY[feature] ?? {
    title: "Not on this plan",
    blurb: "This part of Koda is included with a paid plan.",
  };

  return (
    <UIModal
      isOpen
      onClose={() => FeatureGate.dismiss()}
      title={copy.title}
      footer={
        mayBuy && onOpenPlan ? (
          <>
            <UIButton variant="secondary" onClick={() => FeatureGate.dismiss()}>
              Not now
            </UIButton>
            <UIButton
              variant="primary"
              onClick={() => {
                FeatureGate.dismiss();
                onOpenPlan();
              }}
            >
              See plans
            </UIButton>
          </>
        ) : (
          <UIButton variant="primary" onClick={() => FeatureGate.dismiss()}>
            Got it
          </UIButton>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
          <p className="text-sm text-indigo-900 dark:text-indigo-200">
            {copy.blurb} That part is on a paid plan, and yours is{" "}
            <strong>{plan.planName}</strong>.
          </p>
        </div>

        <p className="text-sm text-muted">
          Everything else is still yours: every lesson, every star, your streak and your badges.
          {mayBuy
            ? " Your plan is under Settings, and you can ask to move to one that includes it."
            : " Ask your grown-up if you would like Koda to start answering."}
        </p>

        {/*
          * Still no checkout here. "See plans" goes to the plan card, which
          * records a request — the price is named on that screen beside the
          * sentence saying no card is taken, and repeating half of that here
          * would make this dialog read like a till.
          */}
        <p className={themeSystem.typography("body-sm")}>
          <span className="font-mono text-ink">
            Your plan: {plan.planName}
            {plan.priceCents > 0 ? `, ${formatPrice(plan.priceCents, plan.currency)}/month` : ""}
          </span>
        </p>
      </div>
    </UIModal>
  );
};
