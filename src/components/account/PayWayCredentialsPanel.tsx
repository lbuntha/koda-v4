import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";

import { translate, useT } from "../../lib/i18n";
import { ApiError, accessToken, request } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton, UISectionHeader } from "../ui";

interface CredentialStatus {
  available: boolean;
  configured: boolean;
  merchantId: string | null;
  expiresOn: string | null;
}

const CREDENTIALS_PATH = "/billing/payway/sandbox";

export function PayWayCredentialsPanel() {
  const { t, language } = useT();
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void accessToken().then((token) => request<CredentialStatus>(CREDENTIALS_PATH, {
      token,
      signal: controller.signal,
    })).then(
      (result) => { if (!controller.signal.aborted) setStatus(result); },
      () => { if (!controller.signal.aborted) setError(translate("admin.paywayCredentials.loadError", undefined, language)); },
    );
    return () => controller.abort();
  }, [attempt, language]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setSaving(true);
    setError("");
    try {
      const token = await accessToken();
      setStatus(await request<CredentialStatus>(CREDENTIALS_PATH, { method: "PUT", token, body }));
      form.reset();
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "payway_invalid_rsa_public") {
        setError(t("admin.paywayCredentials.invalidRsaPublic"));
      } else if (err instanceof ApiError && err.code === "payway_invalid_rsa_private") {
        setError(t("admin.paywayCredentials.invalidRsaPrivate"));
      } else {
        setError(err instanceof Error ? err.message : t("admin.paywayCredentials.saveError"));
      }
    } finally {
      setSaving(false);
    }
  };

  const field = "mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink";

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title={t("admin.paywayCredentials.title")}
        subtitle={t("admin.paywayCredentials.subtitle")}
        icon={<KeyRound aria-hidden="true" className="koda-admin-icon-primary size-5" />}
        action={status?.available && !editing ? (
          <UIButton variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {t(status.configured ? "admin.paywayCredentials.replace" : "admin.paywayCredentials.add")}
          </UIButton>
        ) : undefined}
      />
      {error && <p role="alert" className={themeSystem.flash("error")}>{error}</p>}
      {!status && error && (
        <UIButton variant="secondary" size="sm" onClick={() => {
          setError("");
          setAttempt((value) => value + 1);
        }}>
          {t("admin.familyBilling.retry")}
        </UIButton>
      )}
      {!status && !error && <p role="status" className="text-sm text-ink/75">{t("admin.paywayCredentials.loading")}</p>}
      {status && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink/75">
          <UIBadge variant={status.configured ? "success" : "neutral"}>
            {t(status.configured ? "admin.paywayCredentials.configured" : "admin.paywayCredentials.unconfigured")}
          </UIBadge>
          {status.merchantId && <span>{t("admin.paywayCredentials.merchantId")} {status.merchantId}</span>}
          {status.expiresOn && <span>{t("admin.paywayCredentials.expiresOn")} {status.expiresOn}</span>}
        </div>
      )}
      {status && !status.available && (
        <p className="text-sm text-ink/75">{t("admin.paywayCredentials.unavailable")}</p>
      )}
      {editing && (
        <form className="grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={(event) => void save(event)}>
          <label className="koda-admin-label">
            {t("admin.paywayCredentials.merchantId")}
            <input className={field} name="merchantId" required maxLength={50} defaultValue={status?.merchantId ?? ""} disabled={saving} />
          </label>
          <label className="koda-admin-label">
            {t("admin.paywayCredentials.expiresOn")}
            <input className={field} name="expiresOn" type="date" required disabled={saving} />
          </label>
          <label className="koda-admin-label sm:col-span-2">
            {t("admin.paywayCredentials.apiKey")}
            <input className={field} name="apiKey" type="password" autoComplete="new-password" spellCheck={false} required maxLength={1024} disabled={saving} />
          </label>
          <p className="text-sm text-ink/75 sm:col-span-2">{t("admin.paywayCredentials.rsaHelp")}</p>
          <label className="koda-admin-label">
            {t("admin.paywayCredentials.rsaPublicKey")}
            <textarea className={field} name="rsaPublicKey" rows={4} maxLength={12000} spellCheck={false} disabled={saving} />
          </label>
          <label className="koda-admin-label">
            {t("admin.paywayCredentials.rsaPrivateKey")}
            <textarea className={field} name="rsaPrivateKey" rows={4} maxLength={12000} spellCheck={false} disabled={saving} />
          </label>
          {status?.configured && <p className="text-sm text-ink/75 sm:col-span-2">{t("admin.paywayCredentials.replaceHelp")}</p>}
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <UIButton type="button" variant="secondary" disabled={saving} onClick={() => {
              setEditing(false);
              setError("");
            }}>
              {t("common.cancel")}
            </UIButton>
            <UIButton type="submit" variant="primary" isLoading={saving}>
              {t("admin.paywayCredentials.save")}
            </UIButton>
          </div>
        </form>
      )}
    </section>
  );
}
