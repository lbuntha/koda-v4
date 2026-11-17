import React, { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { ApiError, accessToken, request } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UISectionHeader } from "../ui";
import { UIInput } from "../ui/UIForm";
import { translate } from "../../lib/i18n";

type Provider = "gemini" | "openai" | "anthropic";
interface SavedKey {
  provider: Provider;
  last4: string;
  updatedAt: string;
}

const PROVIDERS: { id: Provider; name: string; where: string }[] = [
  { id: "gemini", name: "Gemini", where: "aistudio.google.com/apikey" },
  { id: "openai", name: "OpenAI", where: "platform.openai.com/api-keys" },
  { id: "anthropic", name: "Claude", where: "console.anthropic.com/settings/keys" },
];

/**
 * Settings → My AI keys. A content maker's own Gemini, OpenAI or Claude key:
 * the Studio's AI (books, quizzes, Trace, art) calls with it instead of Koda's.
 *
 * The key goes to the server once and never comes back — this card only ever
 * holds its last four characters. The input is cleared the moment it is saved.
 */
export const MyAiKeysCard: React.FC = () => {
  const [keys, setKeys] = useState<SavedKey[] | null>(null);
  const [available, setAvailable] = useState(true);
  // Only the Koda owner falls back to Koda's keys; everyone else needs their own.
  const [shared, setShared] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<Provider, string>>>({});
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const reply = await request<{ keys: SavedKey[]; available: boolean; shared: boolean }>("/me/ai-keys", { token: await accessToken() });
      setKeys(reply.keys);
      setAvailable(reply.available);
      setShared(reply.shared);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (provider: Provider) => {
    const key = drafts[provider]?.trim();
    if (!key) return;
    setBusy(provider);
    setError(null);
    setNotice(null);
    try {
      await request(`/me/ai-keys/${provider}`, { method: "PUT", token: await accessToken(), body: { key } });
      setDrafts((d) => ({ ...d, [provider]: "" }));
      setNotice(translate("settings.aiKeys.saved"));
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (provider: Provider) => {
    setBusy(provider);
    setError(null);
    setNotice(null);
    try {
      await request(`/me/ai-keys/${provider}`, { method: "DELETE", token: await accessToken() });
      setNotice(translate("settings.aiKeys.removed"));
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title={translate("settings.aiKeys.title")}
        subtitle={translate("settings.aiKeys.subtitle")}
        icon={<KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
      />
      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {translate("settings.aiKeys.privacy")}
      </p>
      {keys && !shared && keys.length === 0 && <p className={themeSystem.flash("info")}>{translate("settings.aiKeys.required")}</p>}
      {!available && <p className={themeSystem.flash("warning")}>{translate("settings.aiKeys.unavailable")}</p>}
      {error && <p className={themeSystem.flash("error")}>{error}</p>}
      {notice && <p className={themeSystem.flash("success")}>{notice}</p>}
      <ul className="space-y-3">
        {PROVIDERS.map(({ id, name, where }) => {
          const saved = keys?.find((k) => k.provider === id);
          return (
            <li key={id} className="space-y-2 rounded-2xl border border-line bg-surface-muted p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">{name}</span>
                {saved ? (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {translate("settings.aiKeys.inUse", { last4: saved.last4 })}
                  </span>
                ) : (
                  <span className="text-xs text-muted">{translate(shared ? "settings.aiKeys.usingKoda" : "settings.aiKeys.noKey")}</span>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <UIInput
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={drafts[id] ?? ""}
                  onChange={(event) => setDrafts((d) => ({ ...d, [id]: event.target.value }))}
                  placeholder={saved ? translate("settings.aiKeys.replace") : translate("settings.aiKeys.paste", { name })}
                  aria-label={translate("settings.aiKeys.paste", { name })}
                  disabled={!available || busy !== null}
                  className="min-w-0 flex-1"
                />
                <div className="flex gap-2">
                  <UIButton
                    variant="primary"
                    size="sm"
                    disabled={!available || !drafts[id]?.trim() || busy !== null}
                    isLoading={busy === id && Boolean(drafts[id])}
                    onClick={() => void save(id)}
                  >
                    {translate("settings.aiKeys.save")}
                  </UIButton>
                  {saved && (
                    <UIButton variant="ghost" size="sm" icon={<Trash2 />} disabled={busy !== null} onClick={() => void remove(id)}>
                      {translate("settings.aiKeys.remove")}
                    </UIButton>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted">{translate("settings.aiKeys.getOne", { where })}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
