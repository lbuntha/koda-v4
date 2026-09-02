import React, { useEffect, useState } from "react";
import { AlertTriangle, BookX, KeyRound, Radio, ShieldCheck, Sliders, UserMinus } from "lucide-react";

import { ApiError, accessToken, refreshSystem, request, usePermissions } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import {
  applyMaintenanceVersions,
  type MaintenanceResult,
} from "../../lib/maintenanceReset";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIDialog, UISectionHeader, UITabs, UIToggle } from "../ui";
import { PushDiagnostics } from "./PushDiagnostics";
import { BadgesPage } from "./BadgesPage";
import { BillingPage } from "./BillingPage";
import { ScoringPage } from "./ScoringPage";
import { NoAccess } from "./NoAccess";

interface Setting {
  id: string;
  group: string;
  label: string;
  description: string;
  type: "bool" | "text" | "secret";
  /** Always `null` for a secret — see `isSet` and `hint` instead. */
  value: boolean | string | null;
  isSet: boolean;
  hint: string | null;
  updatedAt: string | null;
}

const SystemSettingsSkeleton: React.FC = () => (
  <div className="space-y-6" aria-label="Loading system settings" aria-busy="true">
    {["Artwork", "Accounts & sync"].map((group) => (
      <section key={group} className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <div className="space-y-2 animate-pulse">
          <div className="h-5 w-36 rounded-lg bg-surface-muted" />
          <div className="h-3 w-72 max-w-full rounded bg-surface-muted" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-muted p-4"
            >
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-44 rounded bg-surface" />
                <div className="h-3 w-64 max-w-[55vw] rounded bg-surface" />
              </div>
              <div className="h-7 w-12 shrink-0 rounded-full bg-surface animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);

/**
 * The deployment's switchboard.
 *
 * Everything else an adult can change in this app belongs to one family. This
 * does not: it is the operator's answer for the whole service, and it is a
 * **ceiling** — a family may switch a feature off for themselves, but nothing
 * they do switches on what is off here. That is the difference between this
 * page and Settings, and it is why `system:write` is a platform right that no
 * family role holds and no grant can hand out. An owner runs their family; an
 * operator runs the service.
 *
 * The switches are declared in `server/app/system_defaults.py`, because a
 * setting needs code behind it — the same rule the menu follows. This page
 * renders whatever the server says exists, so adding one is a server change and
 * no frontend change at all.
 */
/**
 * What a key of this kind looks like, so a paste into the wrong field is
 * obvious before it is saved rather than after the first refused call.
 */
const keyExample = (settingId: string): string =>
  settingId.includes("openai")
    ? "sk-..."
    : settingId.includes("anthropic")
      ? "sk-ant-..."
      : settingId.includes("gemini")
        ? "AIzaSy..."
        : "Paste the key";

const SystemPanel: React.FC<{
  embedded?: boolean;
  /**
   * Which rows this instance draws.
   *
   * Credentials and switches are the same collection and the same editor, but
   * not the same job: one is set once when a deployment is wired up, the other
   * is reached for on a bad day. Splitting them across two tabs is a filter
   * here rather than a second component, so a new secret in
   * `system_defaults.py` still needs no frontend change.
   */
  show?: "all" | "secrets" | "switches";
}> = ({ embedded = false, show = "all" }) => {
  const { can } = usePermissions();
  const allowed = can("system:write");

  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [resetTarget, setResetTarget] = useState<"learning" | "registrations" | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await accessToken();
        const body = await request<{ settings: Setting[] }>("/system/settings", { token });
        if (!cancelled) setSettings(body.settings);
      } catch (e) {
        if (!cancelled) setError((e as ApiError).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <NoAccess
        title="System"
        permission="system:write"
        what="These switches govern every family on this deployment, not just yours."
      />
    );
  }

  const write = async (setting: Setting, value: boolean | string) => {
    setBusy(setting.id);
    setError(null);
    try {
      const token = await accessToken();
      const updated = await request<Setting>(`/system/settings/${setting.id}`, {
        method: "PATCH",
        token,
        body: { value },
      });
      setSettings((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
      // Never leave a credential sitting in a React state field either.
      setDrafts((d) => ({ ...d, [setting.id]: "" }));
      // This device is subject to the ceiling too — adopt it immediately rather
      // than keeping a stale copy until the next load.
      void refreshSystem();
      playSound("pop");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const resetData = async (target: "learning" | "registrations") => {
    const operation = `reset:${target}`;
    setBusy(operation);
    setError(null);
    try {
      const token = await accessToken();
      const result = await request<MaintenanceResult>(
        `/system/maintenance/${target}/reset`,
        { method: "POST", token },
      );
      applyMaintenanceVersions(result.versions);
      playSound("pop");
      // Progress is also held in live React state; a clean reload guarantees
      // this operator sees the same empty state every other device will adopt.
      window.location.reload();
    } catch (e) {
      setError((e as ApiError).message);
      setBusy(null);
    }
  };

  const shown =
    settings
      ?.filter((setting) =>
        show === "all"
          ? true
          : show === "secrets"
            ? setting.type === "secret"
            : setting.type !== "secret",
      )
      // Ask Koda has a page of its own — the switches, the key and the plan
      // gate in the order the job is done. Drawing the switches here as well
      // would give an operator two places to change one thing and no way to
      // know which is authoritative. The key stays in the vault below, because
      // that tab is every credential this deployment holds.
      .filter((setting) => setting.group !== "Ask Koda" || setting.type === "secret") ?? null;

  const groups = shown
    ? [...new Set(shown.map((s) => s.group))].map((group) => ({
        group,
        items: shown.filter((s) => s.group === group),
      }))
    : [];

  const maintenance = settings?.find((s) => s.id === "system.readOnly")?.value === true;

  return (
    <div className={embedded ? "space-y-6" : "max-w-3xl mx-auto space-y-6"}>
      {!embedded && <div>
        <h2 className={themeSystem.typography("h2")}>System</h2>
        <p className={themeSystem.typography("body-sm", "mt-1")}>
          What this deployment offers, for every family on it. A family can switch these off for
          themselves — nothing they do switches on what is off here.
        </p>
      </div>}

      {error && <p className={themeSystem.flash("warning")}>{error}</p>}

      {maintenance && show !== "secrets" && (
        <p className={themeSystem.flash("warning")}>
          <AlertTriangle className="w-4 h-4 inline mr-1.5" />
          Maintenance mode is on. Every device is refusing writes — rounds still play and queue.
        </p>
      )}

      {!settings ? (
        <SystemSettingsSkeleton />
      ) : (
        <>
        {groups.map(({ group, items }) => (
          <section
            key={group}
            className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}
          >
            <UISectionHeader
              title={group}
              subtitle={
                show === "secrets"
                  ? "Credentials this deployment calls out with. Stored server-side; a browser never receives one"
                  : group === "Artwork"
                    ? "Drawing an SVG from a prompt on the Art page. Ask Koda has its own page"
                    : "The levers for a bad day"
              }
              icon={
                show === "secrets" ? (
                  <KeyRound className="w-5 h-5 text-amber-500" />
                ) : group === "Artwork" ? (
                  <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Radio className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                )
              }
            />

            <div className="space-y-3">
              {items.map((setting) =>
                setting.type === "bool" ? (
                  <div
                    key={setting.id}
                    className="bg-surface-muted border border-line rounded-2xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-ink font-mono">{setting.label}</h4>
                        {setting.value === false && <UIBadge variant="warning">Off</UIBadge>}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{setting.description}</p>
                    </div>
                    <UIToggle
                      checked={setting.value === true}
                      disabled={busy === setting.id}
                      onChange={() => void write(setting, setting.value !== true)}
                      label={setting.label}
                      tone="emerald"
                    />
                  </div>
                ) : setting.type === "secret" ? (
                  <div
                    key={setting.id}
                    className="bg-surface-muted border border-line rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                      <h4 className="text-sm font-bold text-ink font-mono">{setting.label}</h4>
                      {setting.isSet ? (
                        <UIBadge variant="success">Set ····{setting.hint}</UIBadge>
                      ) : (
                        <UIBadge variant="neutral">Not set</UIBadge>
                      )}
                    </div>
                    <p className="text-xs text-muted">{setting.description}</p>
                    <p className="text-xs text-muted flex items-start gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      Stored on the server and never sent back, so this can replace it but not
                      show it. Save an empty field to remove it.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        autoComplete="off"
                        value={drafts[setting.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [setting.id]: e.target.value }))
                        }
                        placeholder={
                          setting.isSet ? "Enter a new key to replace it" : keyExample(setting.id)
                        }
                        className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-3 py-2 text-sm font-mono text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        disabled={busy === setting.id}
                        onClick={() => void write(setting, drafts[setting.id] ?? "")}
                        className={themeSystem.button("primary", "sm")}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={setting.id}
                    className="bg-surface-muted border border-line rounded-2xl p-4 space-y-2"
                  >
                    <h4 className="text-sm font-bold text-ink font-mono">{setting.label}</h4>
                    <p className="text-xs text-muted">{setting.description}</p>
                    <div className="flex items-center gap-2">
                      <input
                        value={drafts[setting.id] ?? String(setting.value ?? "")}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [setting.id]: e.target.value }))
                        }
                        placeholder="Nothing is shown while this is blank"
                        className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        disabled={busy === setting.id}
                        onClick={() =>
                          void write(setting, drafts[setting.id] ?? String(setting.value ?? ""))
                        }
                        className={themeSystem.button("primary", "sm")}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
        ))}

        {/* The switchboard above says what this deployment *offers*. This says
            whether one of those things actually works — the only feature here
            whose failure is silence rather than an error. */}
        {show !== "secrets" && <PushDiagnostics />}

        {/* Erasing data is switchboard work, not credential work. */}
        {show !== "secrets" && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title="Data maintenance"
            subtitle="Clear test learning data without removing users, learners, published skills, or publisher defaults."
            icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 space-y-4">
              <div className="space-y-1">
                <h3 className="koda-admin-card-title flex items-center gap-2">
                  <BookX className="h-4 w-4 text-rose-600" />
                  Erase learning progress
                </h3>
                <p className="text-xs leading-5 text-muted">
                  Removes all learning events, mastery totals, completed levels, XP profile stats,
                  and queued learning progress from every device.
                </p>
              </div>
              <UIButton
                variant="danger"
                size="sm"
                icon={<BookX />}
                isLoading={busy === "reset:learning"}
                disabled={busy !== null}
                onClick={() => setResetTarget("learning")}
              >
                Erase all progress
              </UIButton>
            </article>

            <article className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 space-y-4">
              <div className="space-y-1">
                <h3 className="koda-admin-card-title flex items-center gap-2">
                  <UserMinus className="h-4 w-4 text-rose-600" />
                  Clear skill registrations
                </h3>
                <p className="text-xs leading-5 text-muted">
                  Unregisters every user and learner from every skill. Published skills, lessons,
                  thumbnails, and default settings remain unchanged.
                </p>
              </div>
              <UIButton
                variant="danger"
                size="sm"
                icon={<UserMinus />}
                isLoading={busy === "reset:registrations"}
                disabled={busy !== null}
                onClick={() => setResetTarget("registrations")}
              >
                Clear all registrations
              </UIButton>
            </article>
          </div>
        </section>
        )}
        </>
      )}

      <UIDialog
        isOpen={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        title={resetTarget === "learning" ? "Erase all learning progress?" : "Clear all skill registrations?"}
        description={
          resetTarget === "learning"
            ? "This permanently clears progress for every user and learner across the server and their offline devices. Accounts and skill content are kept."
            : "This unregisters every user and learner from all skills across the server and their offline devices. Published skills and publisher defaults are kept."
        }
        confirmText={resetTarget === "learning" ? "Erase all progress" : "Clear registrations"}
        variant="danger"
        onConfirm={() => {
          if (resetTarget) void resetData(resetTarget);
        }}
      />
    </div>
  );
};

type AdminTab = "scoring" | "badges" | "billing" | "keys" | "system";

/**
 * What runs Koda, rather than what a family uses it with.
 *
 * The XP rates, the badges, the plans and the deployment switchboard all share
 * one property: they are decided once, by whoever runs the service or owns the
 * family, and everybody else lives with the result. Preferences are the
 * opposite — one person's screen, one person's sound — so they stayed behind on
 * the Settings page every account can open.
 *
 * Each tab still carries its own right, and the strip is built from what this
 * account may actually change: an owner who has never been granted
 * `system:write` sees Scoring and Badges and no Billing, and never learns the
 * others exist.
 */
export const AdminPage: React.FC<{
  initialTab?: AdminTab;
}> = ({ initialTab = "scoring" }) => {
  const { can } = usePermissions();

  /*
   * Only the tabs this account can actually use.
   *
   * The sidebar used to carry a row per tab, each gated by its own right, so
   * nobody ever saw a section that was not theirs. One entry means that gating
   * moved here — and an account with none of these rights should not be able to
   * reach the page at all, so reaching it says so plainly rather than drawing
   * an empty strip.
   */
  // All four on one right, because all four are now one job: what every family
  // on this deployment gets. Scoring and Badges used to be a family owner's and
  // were gated on `scoring:write`; they became the deployment's, and the route
  // that saves them asks for `system:write` — so a strip that offered them on
  // the old right would draw an editable page whose saves quietly failed.
  const tabs = can("system:write")
    ? [
        { id: "scoring", label: "Scoring & XP" },
        { id: "badges", label: "Badges" },
        { id: "billing", label: "Billing" },
        { id: "keys", label: "API keys" },
        { id: "system", label: "System" },
      ]
    : [];

  const [tab, setTab] = useState<AdminTab>(initialTab);

  // A tab id can arrive from a stale sidebar, or from a right this account has
  // since lost. Falling back to the first tab they *do* have beats an empty
  // screen; having none at all is handled below.
  const active = (tabs.some((entry) => entry.id === tab) ? tab : tabs[0]?.id) as AdminTab | undefined;

  useEffect(() => setTab(initialTab), [initialTab]);

  if (tabs.length === 0) {
    return (
      <NoAccess
        title="Admin"
        permission="system:write"
        what="Rewards, badges, plans and deployment controls are set for everybody, not by one family."
      />
    );
  }

  return (
    <div className={"max-w-4xl mx-auto space-y-6"}>
      <UISectionHeader
        title="Admin"
        subtitle="What every family on this Koda gets: rewards, badges, plans and the deployment's own switches."
        icon={<Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      />
      {/* One tab is not a choice, so it is not drawn as one. */}
      {tabs.length > 1 && (
        <UITabs
          items={tabs}
          value={active ?? ""}
          onChange={(value) => setTab(value as AdminTab)}
          label="Admin sections"
        />
      )}
      <div hidden={active !== "scoring"}>
        <ScoringPage embedded />
      </div>
      <div hidden={active !== "badges"}>
        <BadgesPage embedded />
      </div>
      <div hidden={active !== "billing"}>
        <BillingPage embedded />
      </div>
      <div hidden={active !== "keys"}>
        <SystemPanel embedded show="secrets" />
      </div>
      <div hidden={active !== "system"}>
        <SystemPanel embedded show="switches" />
      </div>

    </div>
  );
};
