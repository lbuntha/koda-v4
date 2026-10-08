import React, { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";

import { accessToken, ApiError, request, usePermissions } from "../../lib/sync";
import {
  availableLanguages,
  BASE_LANGUAGE,
  catalogMessages,
  overrideMessages,
  useT,
  type CatalogMessage,
} from "../../lib/i18n";
import { setLocalOverride } from "../../lib/i18n/overrides";
import { themeSystem } from "../../lib/themeSystem";
import { UISearchInput, UISelect, UITextarea } from "../ui";
import { NoAccess } from "./NoAccess";

/**
 * Correct the app's wording, one language at a time.
 *
 * Every message the app has is listed with the English beside it. A save goes
 * to the server and reaches every device on its next launch — no new release —
 * and shows here at once. Resetting a line deletes the correction and the
 * bundled text comes back.
 *
 * Content only: the app's own labels. Book text and lesson names are not in
 * these catalogs and are edited in their studios.
 */

const PAGE = 30;
type Filter = "all" | "missing" | "edited";
type Draft = Record<string, string>;

/** `{name}` tokens a message fills in. A translation must keep the same set. */
const tokensOf = (texts: string[]): string =>
  [...new Set(texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort().join(",");

const textsOf = (message: CatalogMessage | undefined): string[] =>
  message === undefined ? [] : typeof message === "string" ? [message] : Object.values(message).filter(Boolean) as string[];

/** The plural forms a language actually uses — Khmer has one, English two. */
const pluralForms = (lang: string): string[] => {
  try {
    return new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
  } catch {
    return ["other"];
  }
};

const toDraft = (message: CatalogMessage | undefined, forms: string[] | null): Draft => {
  if (!forms) return { text: typeof message === "string" ? message : "" };
  const set = (message && typeof message === "object" ? message : {}) as Record<string, string>;
  return Object.fromEntries(forms.map((form) => [form, set[form] ?? set.other ?? ""]));
};

const sameDraft = (a: Draft, b: Draft) => Object.keys(a).every((k) => a[k] === b[k]);

interface Row {
  key: string;
  english: CatalogMessage;
  bundled: CatalogMessage | undefined;
  override: CatalogMessage | undefined;
}

const RowEditor: React.FC<{ row: Row; lang: string; dir: "ltr" | "rtl" }> = ({ row, lang, dir }) => {
  const { t } = useT();
  const plural = typeof row.english === "object";
  const forms = plural ? pluralForms(lang) : null;
  const current = row.override ?? row.bundled;
  const saved = useMemo(() => toDraft(current, forms), [current, forms?.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState<Draft>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A save elsewhere (or a refresh) moves `saved`; follow it while untouched.
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) {
    setSeen(saved);
    if (sameDraft(draft, seen)) setDraft(saved);
  }

  const dirty = !sameDraft(draft, saved);
  const empty = Object.values(draft).some((text) => !text.trim());
  const tokensOk = tokensOf(Object.values(draft)) === tokensOf(textsOf(row.english));
  const englishTokens = tokensOf(textsOf(row.english));

  const save = async () => {
    setBusy(true);
    setError(null);
    const text: CatalogMessage = forms ? ({ ...draft, other: draft.other ?? "" } as CatalogMessage) : draft.text;
    try {
      await request(`/translations/${encodeURIComponent(lang)}/${encodeURIComponent(row.key)}`, {
        method: "PUT",
        body: { text },
        token: await accessToken(),
      });
      setLocalOverride(lang, row.key, text);
    } catch (err) {
      const problem = err as ApiError;
      setError(problem.isOffline ? t("admin.translations.offline") : problem.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      await request(`/translations/${encodeURIComponent(lang)}/${encodeURIComponent(row.key)}`, {
        method: "DELETE",
        token: await accessToken(),
      });
      setLocalOverride(lang, row.key, null);
    } catch (err) {
      const problem = err as ApiError;
      // Already gone on the server: drop the local copy all the same.
      if (problem.status === 404) setLocalOverride(lang, row.key, null);
      else setError(problem.isOffline ? t("admin.translations.offline") : problem.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border-2 border-line bg-surface p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 break-all text-xs text-muted">{row.key}</code>
        {row.override !== undefined && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {t("admin.translations.edited")}
          </span>
        )}
        {row.bundled === undefined && row.override === undefined && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {t("admin.translations.missing")}
          </span>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2 md:gap-4">
        <div className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-ink" lang={BASE_LANGUAGE}>
          {typeof row.english === "string"
            ? row.english
            : Object.entries(row.english).map(([form, text]) => (
                <div key={form}>
                  <span className="text-xs font-bold text-muted">{form}: </span>
                  {text}
                </div>
              ))}
        </div>

        <div className="space-y-2">
          {Object.keys(draft).map((form) => (
            <label key={form} className="block">
              {forms && forms.length > 1 && (
                <span className="mb-1 block text-xs font-bold text-muted">{form}</span>
              )}
              <UITextarea
                lang={lang}
                dir={dir}
                rows={Math.min(6, Math.max(1, Math.ceil((draft[form]?.length ?? 0) / 48)))}
                value={draft[form]}
                disabled={busy}
                aria-label={`${row.key}${forms ? ` (${form})` : ""}`}
                onChange={(event) => setDraft({ ...draft, [form]: event.target.value })}
                className="min-h-11 text-base"
              />
            </label>
          ))}
        </div>
      </div>

      {dirty && !tokensOk && (
        <p className={themeSystem.flash("error", "mt-2 flex items-start gap-2 text-sm")}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t("admin.translations.keepTokens", { tokens: englishTokens.split(",").filter(Boolean).map((x) => `{${x}}`).join(" ") })}
        </p>
      )}
      {error && <p role="alert" className={themeSystem.flash("error", "mt-2 text-sm")}>{error}</p>}

      {(dirty || row.override !== undefined) && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {row.override !== undefined && !dirty && (
            <button type="button" disabled={busy} onClick={() => void reset()} className={themeSystem.button("secondary", "sm")}>
              <RotateCcw />
              {t("admin.translations.reset")}
            </button>
          )}
          {dirty && (
            <>
              <button type="button" disabled={busy} onClick={() => setDraft(saved)} className={themeSystem.button("secondary", "sm")}>
                {t("admin.translations.cancel")}
              </button>
              <button
                type="button"
                disabled={busy || empty || !tokensOk}
                onClick={() => void save()}
                className={themeSystem.button("primary", "sm")}
              >
                <Save />
                {busy ? t("admin.translations.saving") : t("admin.translations.save")}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
};

export function TranslationsPage() {
  const { can } = usePermissions();
  const { t } = useT();
  const languages = availableLanguages();
  const others = languages.filter((lang) => lang.code !== BASE_LANGUAGE);
  const [lang, setLang] = useState(others[0]?.code ?? BASE_LANGUAGE);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);

  const english = catalogMessages(BASE_LANGUAGE);
  const bundled = catalogMessages(lang);
  const overrides = overrideMessages(lang);
  const meta = languages.find((item) => item.code === lang);

  const rows: Row[] = useMemo(
    () =>
      [...english.entries()].map(([key, message]) => ({
        key,
        english: message,
        bundled: bundled.get(key),
        override: overrides.get(key),
      })),
    [english, bundled, overrides],
  );

  const sections = useMemo(() => [...new Set(rows.map((row) => row.key.split(".")[0]))].sort(), [rows]);
  const counts = {
    all: rows.length,
    missing: rows.filter((row) => row.bundled === undefined && row.override === undefined).length,
    edited: rows.filter((row) => row.override !== undefined).length,
  };

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (section !== "all" && row.key.split(".")[0] !== section) return false;
    if (filter === "missing" && (row.bundled !== undefined || row.override !== undefined)) return false;
    if (filter === "edited" && row.override === undefined) return false;
    if (!needle) return true;
    return [row.key, ...textsOf(row.english), ...textsOf(row.override ?? row.bundled)]
      .some((text) => text.toLowerCase().includes(needle));
  });

  if (!can("content:write")) {
    return <NoAccess title={t("nav.translations")} permission="content:write" what={t("admin.translations.who")} />;
  }

  const filters: [Filter, string][] = [
    ["all", t("admin.translations.filterAll", { count: counts.all })],
    ["missing", t("admin.translations.filterMissing", { count: counts.missing })],
    ["edited", t("admin.translations.filterEdited", { count: counts.edited })],
  ];
  const resetPaging = () => setShown(PAGE);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="koda-admin-page-title">{t("nav.translations")}</h1>
        <p className="koda-admin-label mt-1 text-muted">{t("admin.translations.intro")}</p>
      </div>

      <div className="space-y-3 rounded-2xl border-2 border-line bg-surface p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">{t("admin.translations.language")}</span>
            <UISelect
              value={lang}
              onChange={(event) => {
                setLang(event.target.value);
                resetPaging();
              }}
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code} lang={item.code}>
                  {item.name === item.englishName ? item.name : `${item.name} · ${item.englishName}`}
                </option>
              ))}
            </UISelect>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">{t("admin.translations.section")}</span>
            <UISelect
              value={section}
              onChange={(event) => {
                setSection(event.target.value);
                resetPaging();
              }}
            >
              <option value="all">{t("admin.translations.allSections")}</option>
              {sections.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </UISelect>
          </label>
        </div>
        <UISearchInput
          label={t("admin.translations.search")}
          placeholder={t("admin.translations.search")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetPaging();
          }}
        />
        <div role="tablist" aria-label={t("admin.translations.show")} className="flex gap-1 rounded-xl bg-surface-muted p-1">
          {filters.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => {
                setFilter(id);
                resetPaging();
              }}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition cursor-pointer sm:text-sm ${
                filter === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {lang === BASE_LANGUAGE && (
        <p className={themeSystem.flash("info", "text-sm")}>{t("admin.translations.englishNote")}</p>
      )}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{t("admin.translations.nothing")}</p>
      ) : (
        <ul className="space-y-3">
          {visible.slice(0, shown).map((row) => (
            <RowEditor key={`${lang}:${row.key}`} row={row} lang={lang} dir={meta?.dir ?? "ltr"} />
          ))}
        </ul>
      )}

      {visible.length > shown && (
        <div className="flex flex-col items-center gap-2 pb-6">
          <p className="text-xs text-muted">{t("admin.translations.showing", { shown, total: visible.length })}</p>
          <button type="button" onClick={() => setShown(shown + PAGE)} className={themeSystem.button("secondary", "md")}>
            {t("admin.translations.more")}
          </button>
        </div>
      )}
    </div>
  );
}
