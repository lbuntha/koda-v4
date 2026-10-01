import React, { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, ShieldCheck, Sliders, XCircle } from "lucide-react";

import { ApiError, accessToken, refreshSystem, request, usePermissions } from "../../lib/sync";
import { tutorHeaders } from "../../lib/tutorApi";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIFlashMessage, UIInput, UILinkButton, UISectionHeader, UISelect } from "../ui";
import { NoAccess } from "./NoAccess";

import { translate } from "../../lib/i18n";
interface Setting {
  id: string;
  group: string;
  label: string;
  description: string;
  type: "bool" | "text" | "secret";
  value: boolean | string | null;
  isSet: boolean;
  hint: string | null;
  options?: string[] | null;
  env?: string | null;
}

/** What the tutor server would call with, per credential — never the value. */
interface Source {
  id: string;
  setting: string;
  env: string;
  source: "saved" | "env" | null;
  envSet: boolean;
}

interface TestResult {
  ok: boolean;
  message: string;
}

/**
 * One card per company, whatever feature spends the key. `fields` are the
 * settings the card edits — Vox needs an address as well as a key.
 */
const PROVIDERS: Array<{ id: "gemini" | "openai" | "anthropic" | "vox"; name: string; fields: string[]; usedBy: string[]; example: string }> = [
  { id: "gemini", name: "Gemini", fields: ["ai.geminiApiKey"], usedBy: ["Ask Koda", "Question drafts", "Book pictures", "Art", "Voices"], example: "AIzaSy..." },
  { id: "openai", name: "OpenAI (ChatGPT)", fields: ["ai.openaiApiKey"], usedBy: ["Question drafts", "Book pictures", "Art", "Voices"], example: "sk-..." },
  { id: "anthropic", name: "Claude (Anthropic)", fields: ["ai.anthropicApiKey"], usedBy: ["Question drafts", "Art"], example: "sk-ant-..." },
  { id: "vox", name: "Vox voices", fields: ["ai.voxApiUrl", "ai.voxApiKey"], usedBy: ["Voices"], example: "Paste the key" },
];

const COMPANY: Record<string, string> = { gemini: "Gemini", openai: "OpenAI (ChatGPT)", claude: "Claude" };

/**
 * Admin → API keys: every credential Koda's AI calls out with, and which model
 * does each job by default.
 *
 * Two services answer this screen. The data API holds the saved keys (and only
 * ever says whether one is set, and its last four characters). The tutor server
 * is the process that actually calls the models, so it is the one that knows
 * whether a blank setting falls back to an environment variable, and the one
 * that can try a key.
 */
export const ApiKeysPanel: React.FC = () => {
  const { can } = usePermissions();
  const allowed = can("system:write");
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [sources, setSources] = useState<Record<string, Source>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [error, setError] = useState<string | null>(null);

  const loadSources = async () => {
    try {
      const res = await fetch("/api/ai/providers", { headers: await tutorHeaders() });
      if (!res.ok) return;
      const body = (await res.json()) as { providers: Source[] };
      setSources(Object.fromEntries(body.providers.map((p) => [p.setting, p])));
    } catch {
      /* the badges fall back to what the data API alone knows */
    }
  };

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
    void loadSources();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return <NoAccess title={translate("admin.apiKeysPanel.apiKeys")} permission="system:write" what={translate("admin.apiKeysPanel.theseKeysAreWhatEveryFamily")} />;
  }

  const row = (id: string) => settings?.find((s) => s.id === id);

  const write = async (id: string, value: string) => {
    setBusy(id);
    setError(null);
    try {
      const token = await accessToken();
      const updated = await request<Setting>(`/system/settings/${id}`, { method: "PATCH", token, body: { value } });
      setSettings((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
      // Never leave a credential sitting in React state.
      setDrafts((d) => ({ ...d, [id]: "" }));
      setTests({});
      void loadSources();
      void refreshSystem();
      playSound("pop");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const test = async (provider: string) => {
    setBusy(`test:${provider}`);
    try {
      const res = await fetch(`/api/ai/providers/${provider}/test`, { method: "POST", headers: await tutorHeaders() });
      const body = (await res.json().catch(() => null)) as (TestResult & { error?: { message?: string } }) | null;
      setTests((t) => ({ ...t, [provider]: res.ok && body ? body : { ok: false, message: body?.error?.message ?? "The test could not run." } }));
    } finally {
      setBusy(null);
    }
  };

  const defaults = settings?.filter((s) => s.group === "AI defaults") ?? [];

  return (
    <div className="space-y-6">
      {error && <UIFlashMessage type="error" message={error} />}

      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <UISectionHeader
          title={translate("admin.apiKeysPanel.aiProviders")}
          subtitle={translate("admin.apiKeysPanel.everyKeyKodaSAiCalls")}
          icon={<KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        />

        {!settings ? (
          <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" aria-label={translate("admin.apiKeysPanel.loadingApiKeys")} aria-busy="true" />
        ) : (
          <div className="space-y-3">
            {PROVIDERS.map((provider) => {
              const result = tests[provider.id];
              return (
                <article key={provider.id} className="space-y-3 rounded-2xl border border-line bg-surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-ink">{provider.name}</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {result && (
                        <UIBadge variant={result.ok ? "success" : "danger"}>
                          {result.ok ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
                          {result.ok ? translate("admin.apiKeysPanel.works") : translate("admin.apiKeysPanel.failed")}
                        </UIBadge>
                      )}
                      <UIButton type="button" variant="secondary" size="sm" isLoading={busy === `test:${provider.id}`} disabled={busy !== null} onClick={() => void test(provider.id)}>
                        {translate("admin.apiKeysPanel.test")}
                      </UIButton>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5" aria-label={translate("admin.apiKeysPanel.usedBy")}>
                    {provider.usedBy.map((use) => <UIBadge key={use} variant="primary">{use}</UIBadge>)}
                  </div>
                  {result && !result.ok && <UIFlashMessage type="error" message={result.message} />}

                  {provider.fields.map((id) => {
                    const setting = row(id);
                    if (!setting) return null;
                    const source = sources[id];
                    const from = source?.source ?? (setting.isSet ? "saved" : null);
                    const env = setting.env ?? source?.env;
                    return (
                      <div key={id} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {provider.fields.length > 1 && <span className="text-xs font-bold uppercase tracking-wider text-muted">{setting.label.replace(/^.*— /, "")}</span>}
                          {from === "saved" ? (
                            <UIBadge variant="success">{translate("admin.apiKeysPanel.savedHint", { hint: setting.hint })}</UIBadge>
                          ) : from === "env" ? (
                            <UIBadge variant="info">{translate("admin.apiKeysPanel.fromTheDeploymentEnv", { env: env })}</UIBadge>
                          ) : (
                            <UIBadge variant="warning">{translate("admin.apiKeysPanel.notSet")}</UIBadge>
                          )}
                          {from === "saved" && source?.envSet && (
                            <span className="text-xs text-muted">{translate("admin.apiKeysPanel.overridesTheDeploymentSEnv", { env: env })}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <UIInput
                            type="password"
                            autoComplete="off"
                            aria-label={setting.label}
                            className="font-mono text-sm"
                            value={drafts[id] ?? ""}
                            onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                            placeholder={setting.isSet ? translate("admin.apiKeysPanel.enterANewValueToReplace") : id === "ai.voxApiUrl" ? "https://vox.example.com" : provider.example}
                          />
                          <UIButton type="button" size="sm" isLoading={busy === id} disabled={busy !== null || !(drafts[id] ?? "").trim()} onClick={() => void write(id, drafts[id] ?? "")}>
                            {translate("admin.apiKeysPanel.save")}
                          </UIButton>
                        </div>
                        {setting.isSet && (
                          <UILinkButton type="button" disabled={busy !== null} onClick={() => void write(id, "")}>
                            {translate("admin.apiKeysPanel.removeTheSavedValueValue2", { value: provider.fields.length > 1 ? setting.label.replace(/^.*— /, "") : translate("admin.apiKeysPanel.key"), value2: env ? translate("admin.apiKeysPanel.fallsBackToEnv", { env: env }) : "" })}
                          </UILinkButton>
                        )}
                      </div>
                    );
                  })}
                </article>
              );
            })}
            <p className="flex items-start gap-1.5 text-xs text-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {translate("admin.apiKeysPanel.aSavedKeyReplacesTheDeployment")}
            </p>
          </div>
        )}
      </section>

      {defaults.length > 0 && (
        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title={translate("admin.apiKeysPanel.defaultModels")}
            subtitle={translate("admin.apiKeysPanel.whichCompanyDoesEachJobWhen")}
            icon={<Sliders className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {defaults.map((setting) => (
              <label key={setting.id} className="grid gap-1.5">
                <span className="text-sm font-bold text-ink">{setting.label}</span>
                <UISelect
                  value={String(setting.value ?? "")}
                  disabled={busy !== null}
                  onChange={(e) => void write(setting.id, e.target.value)}
                >
                  {(setting.options ?? []).map((o) => <option key={o} value={o}>{COMPANY[o] ?? o}</option>)}
                  {/* A value saved before options existed stays visible rather than silently changing. */}
                  {!(setting.options ?? []).includes(String(setting.value)) && <option value={String(setting.value)}>{String(setting.value)}</option>}
                </UISelect>
                <span className="text-xs text-muted">{setting.description}</span>
              </label>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
