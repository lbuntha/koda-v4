import React, { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Pencil, Plus, Users } from "lucide-react";

import { ApiError, accessToken, request, usePermissions } from "../../lib/sync";
import { formatPrice } from "../../lib/billing";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIModal, UISectionHeader, UISearchInput, UITabs } from "../ui";
import { NoAccess } from "./NoAccess";
import { PayWayCredentialsPanel } from "./PayWayCredentialsPanel";

import { translate, useT } from "../../lib/i18n";
interface Feature {
  featureId: string;
  label: string;
  description: string;
}

interface Plan {
  planId: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  learnerLimit: number;
  features: string[];
  order: number;
}

interface Subscription {
  familyId: string;
  familyName: string;
  /** Whose account this family is. The only handle an operator usually has. */
  ownerEmail: string | null;
  ownerName: string | null;
  planId: string;
  planName: string;
  status: string;
  renewsAt: string | null;
  learnersUsed: number;
  learnerLimit: number;
  live: boolean;
  /** A plan this family asked for and has not been given. */
  wantsPlanId: string | null;
  wantsPlanName: string | null;
  requestedAt: string | null;
  requestedByName: string | null;
  requestedByEmail: string | null;
}

type SubscriptionView = "all" | "pending";

interface SubscriptionPage {
  subscriptions: Subscription[];
  hasMore: boolean;
}

function RequestDetails({ subscription }: { subscription: Subscription }) {
  const { language, t } = useT();
  const { requestedAt, requestedByName, requestedByEmail } = subscription;
  const name = [requestedByName, requestedByEmail].filter(Boolean).join(" · ");
  const date = requestedAt ? new Date(requestedAt) : null;
  const formatted = date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(date)
    : null;

  return (
    <div className="space-y-0.5 text-xs text-ink/75">
      <p className="break-words">
        {t("admin.billingPage.requestedBy", { name: name || t("admin.billingPage.unknownRequester") })}
      </p>
      {formatted && (
        <p>
          {t("admin.billingPage.requestedOn")} <time dateTime={requestedAt ?? undefined}>{formatted}</time>
        </p>
      )}
    </div>
  );
}

const field =
  themeSystem.field("lg", "w-full");

const when = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(iso),
      )
    : "no end date";

/**
 * Plans, and who is on them.
 *
 * Two things an operator does, kept apart because they carry different risk.
 * **Editing a plan** re-prices it for every family already on it, and changing
 * its child limit downward can leave a family over the line — nothing deletes a
 * child, they simply cannot add another. **Granting a subscription** touches one
 * family and expires by itself.
 *
 * What is deliberately not here is a card. A grant is a date, and it lapses when
 * the date passes; when a processor is wired in it writes the same row with a
 * different `source`, and nothing on this page or behind it has to change.
 */
export const BillingPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { can } = usePermissions();
  const allowed = can("system:write");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [subs, setSubs] = useState<SubscriptionPage | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<{ query: string; page: number; view: SubscriptionView }>({
    query: "", page: 1, view: "all",
  });
  const [subsError, setSubsError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [granting, setGranting] = useState<Subscription | null>(null);
  const [grantPlan, setGrantPlan] = useState("family");
  const [grantMonths, setGrantMonths] = useState(1);

  const loadCatalogue = useCallback(async () => {
    const token = await accessToken();
    const body = await request<{ plans: Plan[]; features: Feature[] }>("/billing/plans", { token });
    setPlans(body.plans);
    setFeatures(body.features);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void loadCatalogue().catch((e: ApiError) => setError(e.message));
  }, [allowed, loadCatalogue]);

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      query: filters.query, page: String(filters.page), view: filters.view, limit: "25",
    });
    setSubs(null);
    setSubsError(null);
    void accessToken().then((token) => request<SubscriptionPage>(
      `/billing/subscriptions?${params}`, { token, signal: controller.signal },
    )).then(
      (result) => {
        if (controller.signal.aborted) return;
        if (result.subscriptions.length === 0 && filters.page > 1) {
          setFilters((current) => ({ ...current, page: current.page - 1 }));
          return;
        }
        setSubs(result);
      },
      (error: ApiError) => { if (!controller.signal.aborted) setSubsError(error.message); },
    );
    return () => controller.abort();
  }, [allowed, filters]);

  if (!allowed) {
    return (
      <NoAccess
        title={translate("admin.billingPage.billing")}
        permission="system:write"
        what={translate("admin.billingPage.plansAndSubscriptionsBelongToWhoever")}
      />
    );
  }

  const savePlan = async (plan: Plan, isNew: boolean) => {
    setBusy(`plan:${plan.planId}`);
    setError(null);
    try {
      const token = await accessToken();
      await request<Plan>(isNew ? "/billing/plans" : `/billing/plans/${plan.planId}`, {
        method: isNew ? "POST" : "PATCH",
        token,
        body: isNew
          ? plan
          : {
              name: plan.name,
              description: plan.description,
              priceCents: plan.priceCents,
              learnerLimit: plan.learnerLimit,
              features: plan.features,
            },
      });
      await loadCatalogue();
      setFilters((current) => ({ ...current }));
      setEditing(null);
      setCreating(false);
      setNotice(isNew ? translate("admin.billingPage.planAdded") : translate("admin.billingPage.planUpdated"));
      playSound("pop");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const grant = async () => {
    if (!granting) return;
    setBusy(`grant:${granting.familyId}`);
    setError(null);
    try {
      const token = await accessToken();
      await request<Subscription>(`/billing/subscriptions/${granting.familyId}`, {
        method: "PUT",
        token,
        body: { planId: grantPlan, months: grantMonths, status: "active" },
      });
      setFilters((current) => ({ ...current }));
      setGranting(null);
      setNotice(translate("admin.billingPage.subscriptionUpdated"));
      playSound("pop");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "max-w-4xl mx-auto space-y-6"}>
      {!embedded && (
        <div>
          <h2 className={themeSystem.typography("h2")}>{translate("admin.billingPage.billing")}</h2>
          <p className={themeSystem.typography("body-sm", "mt-1")}>
            {translate("admin.billingPage.whatEachPlanCostsAndIncludes")}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {notice}
        </div>
      )}

      <PayWayCredentialsPanel />

      {/* ---- PLANS ---- */}
      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <UISectionHeader
          title={translate("admin.billingPage.plans")}
          subtitle={translate("admin.billingPage.priceHowManyChildrenAndWhat")}
          icon={<CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          action={
            <UIButton
              variant="secondary"
              size="sm"
              icon={<Plus />}
              onClick={() => {
                setCreating(true);
                setEditing({
                  planId: "",
                  name: "",
                  description: "",
                  priceCents: 1000,
                  currency: "USD",
                  learnerLimit: 5,
                  features: [],
                  order: 100,
                });
              }}
            >
              {translate("admin.billingPage.addPlan")}
            </UIButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.planId} className="rounded-2xl border border-line bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-mono text-sm font-bold text-ink">{plan.name}</h4>
                  <p className="text-xs text-muted">{plan.description || translate("admin.billingPage.noDescription")}</p>
                </div>
                <span className="shrink-0 font-mono text-base font-black text-ink">
                  {plan.priceCents === 0 ? translate("admin.billingPage.free") : `${formatPrice(plan.priceCents, plan.currency)}/mo`}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <UIBadge variant="info">
                  {plan.learnerLimit} {plan.learnerLimit === 1 ? translate("admin.billingPage.child") : translate("admin.billingPage.children")}
                </UIBadge>
                {plan.features.length === 0 ? (
                  <UIBadge variant="neutral">{translate("admin.billingPage.noPaidFeatures")}</UIBadge>
                ) : (
                  plan.features.map((id) => (
                    <UIBadge key={id} variant="success">
                      {features.find((f) => f.featureId === id)?.label ?? id}
                    </UIBadge>
                  ))
                )}
              </div>
              <UIButton
                className="mt-3"
                variant="secondary"
                size="sm"
                icon={<Pencil />}
                onClick={() => {
                  setCreating(false);
                  setEditing({ ...plan });
                }}
              >
                {translate("admin.billingPage.edit")}
              </UIButton>
            </div>
          ))}
        </div>
      </section>

      {/* ---- WHO IS ON WHAT ---- */}
      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <UISectionHeader
          title={translate("admin.billingPage.subscriptions")}
          subtitle={translate("admin.billingPage.everyFamilyWhatTheyAreOn")}
          icon={<Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        />

        <UITabs<SubscriptionView>
          label={translate("admin.billingPage.subscriptions")}
          items={[
            { id: "all", label: translate("admin.billingPage.allFamilies") },
            { id: "pending", label: translate("admin.billingPage.pendingRequests") },
          ]}
          value={filters.view}
          onChange={(view) => setFilters((current) => ({ ...current, view, page: 1 }))}
        />

        <form className="flex items-center gap-2" onSubmit={(event) => {
          event.preventDefault();
          setFilters((current) => ({ ...current, query: query.trim(), page: 1 }));
        }}>
          <UISearchInput
              className="flex-1"
              label={translate("admin.billingPage.searchByNameEmailOrFamily")}
              value={query}
              maxLength={80}
              onChange={(event) => setQuery(event.target.value)}
            />
          <UIButton type="submit" variant="secondary" size="sm">
            {translate("admin.billingPage.search")}
          </UIButton>
        </form>

        {subsError ? (
          <p role="alert" className={themeSystem.flash("error")}>{subsError}</p>
        ) : !subs ? (
          <div role="status" aria-label={translate("admin.billingPage.loadingSubscriptions")} className="space-y-2">
            {[0, 1, 2].map((row) => <div key={row} className="h-16 animate-pulse rounded-2xl border border-line bg-surface-muted" />)}
          </div>
        ) : subs.subscriptions.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line bg-surface-muted p-6 text-center text-sm text-muted">
            {translate(filters.query
              ? "admin.billingPage.noMatchingSubscriptions"
              : filters.view === "pending" ? "admin.billingPage.noPendingRequests" : "admin.billingPage.noFamiliesYet")}
          </p>
        ) : (
          <div className="space-y-2">
            {subs.subscriptions.map((sub) => (
              <div
                key={sub.familyId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-4"
              >
                <div className="min-w-0">
                  <h4 className="truncate font-mono text-sm font-bold text-ink">{sub.familyName}</h4>
                  {/* Who this actually is. The family name is often something a
                      parent typed once and never thought about again, so two
                      "Smith Family" rows are told apart by nothing else — and an
                      operator arrives here holding a person's name or address,
                      never a family id. The address is the identifier, so it
                      gets the monospace and the name reads as the label. */}
                  {(sub.ownerName || sub.ownerEmail) && (
                    <p className="truncate text-xs text-body">
                      {sub.ownerName && <span className="font-medium">{sub.ownerName}</span>}
                      {sub.ownerName && sub.ownerEmail && <span className="text-muted"> · </span>}
                      {sub.ownerEmail && <span className="font-mono text-muted">{sub.ownerEmail}</span>}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    {translate("admin.billingPage.learnersusedOfLearnerlimitValueValue2", { learnersUsed: sub.learnersUsed, learnerLimit: sub.learnerLimit, value: sub.learnerLimit === 1 ? translate("admin.billingPage.child") : translate("admin.billingPage.children"), value2: when(sub.renewsAt) })}
                  </p>
                  {sub.wantsPlanName && <div className="mt-2"><RequestDetails subscription={sub} /></div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/*
                    * What is being honoured, not what the row says. An expired
                    * grant still reads "active" until somebody changes it, and
                    * an operator looking for why a family lost Koda needs to
                    * see that difference at a glance.
                    */}
                  <UIBadge variant={sub.live ? "success" : "neutral"}>
                    {sub.live ? sub.planName : translate("admin.billingPage.free")}
                  </UIBadge>
                  {!sub.live && sub.planId !== "free" && (
                    <UIBadge variant="warning">{translate("admin.billingPage.lapsed")}</UIBadge>
                  )}
                  {/*
                    * A family has asked for this and is waiting on a person.
                    * Until checkout exists, this badge is the whole delivery
                    * mechanism for an upgrade — a request nobody can see is a
                    * parent pressing a button into nothing.
                    */}
                  {sub.wantsPlanName && (
                    <UIBadge variant="primary">{translate("admin.billingPage.wantsWantsplanname", { wantsPlanName: sub.wantsPlanName })}</UIBadge>
                  )}
                  <UIButton
                    variant="secondary"
                    size="sm"
                    isLoading={busy === `grant:${sub.familyId}`}
                    onClick={() => {
                      setGranting(sub);
                      // What they asked for, when they asked for something.
                      // An operator opening this row is usually answering the
                      // request, and re-picking it by hand is how the wrong
                      // plan gets granted.
                      setGrantPlan(
                        sub.wantsPlanId ?? plans.find((p) => p.priceCents > 0)?.planId ?? "family",
                      );
                      setGrantMonths(1);
                    }}
                  >
                    {translate("admin.billingPage.change")}
                  </UIButton>
                </div>
              </div>
            ))}
          </div>
        )}
        {(filters.page > 1 || subs?.hasMore) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <UIButton type="button" variant="secondary" size="sm" disabled={filters.page === 1}
              onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>
              {translate("admin.familyBilling.previous")}
            </UIButton>
            <p className="koda-admin-label">{translate("admin.billingPage.pageNumber", { page: filters.page })}</p>
            <UIButton type="button" variant="secondary" size="sm" disabled={!subs?.hasMore}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>
              {translate("admin.familyBilling.next")}
            </UIButton>
          </div>
        )}
      </section>

      {/* ---- EDIT / ADD A PLAN ---- */}
      <UIModal
        isOpen={Boolean(editing)}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        title={creating ? translate("admin.billingPage.addPlan") : translate("admin.billingPage.editValue", { value: editing?.name ?? translate("admin.billingPage.plan") })}
        footer={
          <>
            <UIButton
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              {translate("admin.billingPage.cancel")}
            </UIButton>
            <UIButton
              variant="primary"
              isLoading={Boolean(editing && busy === `plan:${editing.planId}`)}
              disabled={!editing?.name.trim() || (creating && !editing?.planId.trim())}
              onClick={() => editing && void savePlan(editing, creating)}
            >
              {creating ? translate("admin.billingPage.addPlan") : translate("admin.billingPage.savePlan")}
            </UIButton>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            {creating && (
              <label className="block space-y-1.5">
                <span className="koda-admin-label text-ink">{translate("admin.billingPage.id")}</span>
                <input
                  className={field}
                  placeholder={translate("admin.billingPage.school")}
                  value={editing.planId}
                  onChange={(e) =>
                    setEditing({ ...editing, planId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                  }
                />
                <span className="text-xs text-muted">
                  {translate("admin.billingPage.permanentSubscriptionsPointAtItLowercase")}
                </span>
              </label>
            )}

            <label className="block space-y-1.5">
              <span className="koda-admin-label text-ink">{translate("admin.billingPage.name")}</span>
              <input
                className={field}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="koda-admin-label text-ink">{translate("admin.billingPage.description")}</span>
              <input
                className={field}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="koda-admin-label text-ink">{translate("admin.billingPage.pricePerMonthUsCents")}</span>
                <input
                  className={field}
                  type="number"
                  min={0}
                  step={100}
                  value={editing.priceCents}
                  onChange={(e) => setEditing({ ...editing, priceCents: Number(e.target.value) || 0 })}
                />
                <span className="text-xs text-muted">
                  {editing.priceCents === 0 ? translate("admin.billingPage.free") : translate("admin.billingPage.valueAMonth", { value: formatPrice(editing.priceCents) })}
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className="koda-admin-label text-ink">{translate("admin.billingPage.childrenIncluded")}</span>
                <input
                  className={field}
                  type="number"
                  min={1}
                  max={100}
                  value={editing.learnerLimit}
                  onChange={(e) =>
                    setEditing({ ...editing, learnerLimit: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </label>
            </div>

            <div className="space-y-2">
              <span className="koda-admin-label text-ink">{translate("admin.billingPage.includedFeatures")}</span>
              {editing.planId === "free" ? (
                <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted">
                  {translate("admin.billingPage.theFreePlanIsTheFloor")}
                </p>
              ) : (
                features.map((feature) => {
                  const on = editing.features.includes(feature.featureId);
                  return (
                    <button
                      key={feature.featureId}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          features: on
                            ? editing.features.filter((id) => id !== feature.featureId)
                            : [...editing.features, feature.featureId],
                        })
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${
                        on
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-line bg-surface-muted"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                          on ? "border-emerald-500 bg-emerald-500 text-white" : "border-line"
                        }`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink">{feature.label}</span>
                        <span className="block text-xs text-muted">{feature.description}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </UIModal>

      {/* ---- GRANT ---- */}
      <UIModal
        isOpen={Boolean(granting)}
        onClose={() => setGranting(null)}
        title={translate("admin.billingPage.subscriptionForValue", { value: granting?.familyName ?? "" })}
        footer={
          <>
            <UIButton variant="secondary" onClick={() => setGranting(null)}>
              {translate("admin.billingPage.cancel")}
            </UIButton>
            <UIButton
              variant="primary"
              isLoading={Boolean(granting && busy === `grant:${granting.familyId}`)}
              onClick={() => void grant()}
            >
              {translate("admin.billingPage.apply")}
            </UIButton>
          </>
        }
      >
        <div className="space-y-4">
          {/* What the family actually asked for, beside the control that
              answers it — so an operator granting something else is doing it
              on purpose rather than because the row did not say. */}
          {granting?.wantsPlanName && (
            <div className="space-y-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
              <p>{translate("admin.billingPage.thisFamilyAskedFor")}{" "}<strong>{granting.wantsPlanName}</strong>{translate("admin.billingPage.grantingItClearsTheRequest")}</p>
              <RequestDetails subscription={granting} />
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="koda-admin-label text-ink">{translate("admin.billingPage.plan2")}</span>
            <select className={field} value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)}>
              {plans.map((plan) => (
                <option key={plan.planId} value={plan.planId}>
                  {plan.name} — {plan.priceCents === 0 ? translate("admin.billingPage.free2") : `${formatPrice(plan.priceCents)}/mo`},{" "}
                  {plan.learnerLimit} {plan.learnerLimit === 1 ? translate("admin.billingPage.child") : translate("admin.billingPage.children")}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="koda-admin-label text-ink">{translate("admin.billingPage.months")}</span>
            <input
              className={field}
              type="number"
              min={0}
              max={120}
              value={grantMonths}
              onChange={(e) => setGrantMonths(Math.max(0, Number(e.target.value) || 0))}
            />
            <span className="text-xs text-muted">
              {grantMonths === 0
                ? translate("admin.billingPage.noEndDateRunsUntilSomebody")
                : translate("admin.billingPage.runsForGrantmonthsMonthValueThen", { grantMonths: grantMonths, value: grantMonths === 1 ? "" : "s" })}
            </span>
          </label>

          <p className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            {translate("admin.billingPage.puttingAFamilyOnFreeTakes")}
          </p>
        </div>
      </UIModal>
    </div>
  );
};
