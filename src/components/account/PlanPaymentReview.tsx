import { CircleHelp, QrCode, ShieldCheck } from "lucide-react";

import { formatPrice, type Plan, type SandboxCheckout } from "../../lib/billing";
import { translate } from "../../lib/i18n";
import { CONTACT_EMAIL } from "../legal/legalText";
import { UIBadge } from "../ui";

export function PlanPaymentReview({ plan, sandbox = false }: { plan: Plan; sandbox?: boolean }) {
  const paid = plan.priceCents > 0;
  const price = formatPrice(plan.priceCents, plan.currency);
  const displayPrice = plan.currency === "USD" ? `US${price}` : price;

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/70 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
        <div>
          <h4 className="koda-admin-section-title">
            {translate(sandbox ? "admin.planPayment.sandbox" : "admin.planPayment.noPaymentDue")}
          </h4>
          <p className="text-sm text-ink/75">
            {translate(sandbox ? "admin.planPayment.sandboxDetails" : "admin.planPayment.requestDetails")}
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="koda-admin-card-title break-words">{plan.name}</p>
          {paid && <p className="text-sm text-ink/75">{translate("admin.planPayment.accessTerms")}</p>}
        </div>
        <div className="shrink-0 text-end">
          <p className="koda-admin-card-title">{paid ? displayPrice : translate("admin.planCard.free")}</p>
          {paid && <p className="text-xs text-ink/75">{translate("admin.planPayment.planPrice")}</p>}
        </div>
      </div>

      {paid && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-1 pt-2">
          <span className="koda-admin-card-title inline-flex items-center gap-2">
            <QrCode aria-hidden="true" className="koda-admin-icon-primary size-4 shrink-0" />
            ABA PayWay · KHQR
          </span>
          <UIBadge variant="neutral">
            {translate(sandbox ? "admin.planPayment.sandbox" : "admin.planPayment.comingSoon")}
          </UIBadge>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 text-sm text-indigo-700 dark:text-indigo-200">
        <a className="inline-flex items-center gap-1.5 underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
          <CircleHelp aria-hidden="true" className="size-4" />
          {translate("admin.planPayment.paymentHelp")}
        </a>
        <a className="underline underline-offset-4" href="/privacy" target="_blank" rel="noreferrer">
          {translate("admin.planPayment.privacy")}
        </a>
        <a className="underline underline-offset-4" href="/terms" target="_blank" rel="noreferrer">
          {translate("admin.planPayment.terms")}
        </a>
      </div>
    </section>
  );
}

export function SandboxPaymentCode({ checkout }: { checkout: SandboxCheckout }) {
  const price = `US${formatPrice(checkout.amountCents, checkout.currency)}`;
  return (
    <section className="mx-auto max-w-md space-y-3 text-center">
      <UIBadge variant="neutral">{translate("admin.planPayment.sandbox")}</UIBadge>
      <h4 className="koda-admin-section-title">{checkout.planName} · {price}</h4>
      {checkout.qrImage ? (
        <>
          <p className="text-sm text-ink/75">{translate("admin.planPayment.scanSandboxQr")}</p>
          <img className="mx-auto w-full max-w-64 rounded-xl" alt={translate("admin.planPayment.sandboxQrAlt")} src={checkout.qrImage} />
          {checkout.deepLink && (
            <a className="text-sm text-indigo-700 underline dark:text-indigo-200" href={checkout.deepLink}>
              {translate("admin.planPayment.openAba")}
            </a>
          )}
        </>
      ) : <p className="text-sm text-ink/75">{translate("admin.planPayment.checkoutChecking")}</p>}
      <p className="text-xs text-ink/75">{checkout.reference}</p>
    </section>
  );
}
