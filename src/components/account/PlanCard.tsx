import React from "react";
import { CreditCard, Sparkles } from "lucide-react";

import { AI_FEATURE, formatPrice } from "../../lib/billing";
import { useBilling } from "../../lib/useBilling";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UISectionHeader } from "../ui";

const when = (iso: string | null): string | null =>
  iso
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(iso),
      )
    : null;

/**
 * The family's own plan, in a sentence they can act on.
 *
 * Not a paywall and not a sales pitch: a parent who cannot add a second child,
 * or whose Koda has gone quiet, should be able to find out why in one place
 * without being sold to on every screen. The upgrade path is deliberately left
 * as "ask whoever runs Koda" — there is no checkout yet, and inventing a button
 * that goes nowhere is worse than saying so.
 */
export const PlanCard: React.FC = () => {
  const plan = useBilling();
  const renews = when(plan.renewsAt);

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title="Your plan"
        subtitle="What this family's account includes"
        icon={<CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />

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
            {plan.learnersUsed} of {plan.learnerLimit}{" "}
            {plan.learnerLimit === 1 ? "child" : "children"}
            {renews ? ` · renews ${renews}` : ""}
          </p>
        </div>
        <UIBadge variant={plan.has(AI_FEATURE) ? "success" : "neutral"}>
          {plan.has(AI_FEATURE) ? "Ask Koda included" : "Ask Koda not included"}
        </UIBadge>
      </div>

      {!plan.has(AI_FEATURE) && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
          <p className="text-xs text-indigo-900 dark:text-indigo-200">
            Every lesson, every badge and the whole course are yours on this plan. What a paid plan
            adds is <strong>Ask Koda</strong> — written help, spoken guidance, the voice coach, and
            Koda reading what your child has drawn. Ask whoever runs your Koda to switch it on.
          </p>
        </div>
      )}
    </section>
  );
};
