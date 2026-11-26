import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ReceiptText } from "lucide-react";

import { Billing, formatPrice, type BillingPayment, type PaymentHistory } from "../../lib/billing";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton, UIDataTable, UISectionHeader } from "../ui";
import type { UIDataTableColumn } from "../ui/UIDataTable";
import { PlanCard } from "./PlanCard";

export function FamilyBillingPage() {
  const { t, language } = useT();
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<PaymentHistory | null>(null);
  const [failed, setFailed] = useState(false);
  const refreshHistory = useCallback(() => {
    setFailed(false);
    setPage(1);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Billing.paymentHistory(page, controller.signal).then(
      (result) => { if (!controller.signal.aborted) setHistory(result); },
      () => { if (!controller.signal.aborted) setFailed(true); },
    );
    return () => controller.abort();
  }, [page, attempt]);

  const changePage = (next: number) => {
    setHistory(null);
    setFailed(false);
    setPage(next);
  };

  const date = new Intl.DateTimeFormat(language, { dateStyle: "medium" });
  const columns: UIDataTableColumn<BillingPayment>[] = [
    { key: "date", header: t("admin.familyBilling.date"), render: (row) => date.format(new Date(row.paidAt)), nowrap: true },
    {
      key: "payment",
      header: t("admin.familyBilling.payment"),
      render: (row) => (
        <>
          <span className="koda-admin-card-title block">{row.planName}</span>
          <span className="block break-all text-xs text-muted">{row.reference}</span>
        </>
      ),
    },
    {
      key: "status",
      header: t("admin.familyBilling.status"),
      render: (row) => row.status === "paid"
        ? <UIBadge variant={row.sandbox ? "neutral" : "success"}>
            {t(row.sandbox ? "admin.familyBilling.testPayment" : "admin.familyBilling.paid")}
          </UIBadge>
        : <UIBadge variant="neutral">{t("admin.familyBilling.refunded")}</UIBadge>,
    },
    {
      key: "amount",
      header: t("admin.familyBilling.amount"),
      align: "right",
      numeric: true,
      nowrap: true,
      render: (row) => {
        const price = formatPrice(row.amountCents, row.currency);
        return row.currency === "USD" ? `US${price}` : price;
      },
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="hidden rail:block">
        <h1 className="koda-admin-page-title">{t("nav.family-billing")}</h1>
        <p className="mt-1 text-sm text-ink/75">{t("admin.familyBilling.subtitle")}</p>
      </header>
      <PlanCard onPaymentConfirmed={refreshHistory} />
      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <UISectionHeader
          title={t("admin.familyBilling.history")}
          icon={<ReceiptText aria-hidden="true" className="size-5 text-indigo-600 dark:text-indigo-300" />}
        />
        {failed ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="alert" className="text-sm text-ink/75">{t("admin.familyBilling.loadError")}</p>
            <UIButton variant="secondary" size="sm" onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}>
              {t("admin.familyBilling.retry")}
            </UIButton>
          </div>
        ) : history ? (
          history.payments.length > 0 ? (
            <UIDataTable
              columns={columns}
              rows={history.payments}
              rowKey={(row) => row.reference}
              caption={t("admin.familyBilling.history")}
            />
          ) : (
            <div className="rounded-2xl border border-line bg-surface-muted p-5 text-center">
              <p className="koda-admin-card-title">{t("admin.familyBilling.empty")}</p>
              <p className="mt-1 text-sm text-ink/75">{t("admin.familyBilling.emptyHelp")}</p>
            </div>
          )
        ) : <p role="status" className="text-sm text-ink/75">{t("admin.familyBilling.loading")}</p>}
        {(page > 1 || history?.hasMore) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <UIButton variant="secondary" size="sm" icon={<ChevronLeft />} disabled={page === 1} onClick={() => changePage(page - 1)}>
              {t("admin.familyBilling.previous")}
            </UIButton>
            <UIButton variant="secondary" size="sm" iconRight={<ChevronRight />} disabled={!history?.hasMore} onClick={() => changePage(page + 1)}>
              {t("admin.familyBilling.next")}
            </UIButton>
          </div>
        )}
      </section>
    </div>
  );
}
