import React from "react";
import { WifiOff } from "lucide-react";

import { themeSystem } from "../../lib/themeSystem";
import { AccountForm } from "./AccountForm";
import { LanguagePicker } from "../LanguagePicker";
import { availableLanguages, useT } from "../../lib/i18n";
import { PreferencesAPI } from "../../lib/preferences";
import { playSound } from "../../utils/audio";

/**
 * The language switch, as buttons while there are few enough to show.
 *
 * Before the form, not in Settings: a family that cannot read English has to
 * be able to change it before they have an account to change it in. A select
 * hides the choice behind a tap and shows only the current language's name;
 * two or three buttons show every option in its own script at once. Past
 * that, the shared select takes over so the row never wraps.
 */
const LanguageSwitch: React.FC = () => {
  const { t, language } = useT();
  const languages = availableLanguages();
  if (languages.length > 3) return <LanguagePicker compact />;
  return (
    <div
      role="radiogroup"
      aria-label={t("settings.language.title")}
      className="inline-flex gap-1 rounded-xl bg-surface-muted p-1"
    >
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          role="radio"
          lang={lang.code}
          aria-checked={language === lang.code}
          onClick={() => {
            if (language === lang.code) return;
            playSound("pop");
            PreferencesAPI.update({ language: lang.code });
          }}
          className={`min-h-9 rounded-lg px-3 text-sm font-bold transition cursor-pointer ${
            language === lang.code ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {lang.name}
        </button>
      ))}
    </div>
  );
};

/**
 * The sign-in page.
 *
 * A page in its own right rather than a panel dropped into whatever is behind
 * it: it owns the full viewport and its own background.
 *
 * One column on a phone — the mark, one line of promise, then the form — and
 * two on a computer, the promise on the left and the form on the right. The
 * left side stays short on purpose: a headline, one sentence and the offline
 * note. What Koda teaches keeps growing; the front door should not have to be
 * rewritten every time it does.
 *
 * It offers no way past — signing in is required (App.tsx). Once a device has
 * signed in the session is local and lessons keep working with no connection;
 * this screen is the one thing that needs a network.
 */
export const SignInScreen: React.FC = () => {
  const { t } = useT();
  return (
    <div className="min-h-dvh w-full bg-canvas flex flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        {/* The product's own mark (public/favicon.svg), the same tile as the
            installed app's icon. Here only on a computer, where the intro
            column is laid out without it. */}
        <span className="hidden items-center gap-2 lg:inline-flex">
          <img src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-extrabold tracking-tight text-ink">Koda</span>
        </span>
        <span className="lg:hidden" />
        <LanguageSwitch />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-10">
        <section className="text-center lg:text-left">
          <img
            src="/favicon.svg"
            alt=""
            width={56}
            height={56}
            className="mx-auto mb-4 h-14 w-14 rounded-2xl shadow-lg shadow-indigo-600/25 lg:hidden"
          />
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-balance text-ink sm:text-3xl lg:text-5xl">
            {t("signIn.headline")}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted lg:mx-0 lg:mt-4 lg:max-w-md lg:text-lg">
            {t("signIn.tagline")}
          </p>
          {/* The offline promise: unusual for a tablet on a household's patchy
              wifi, and reassurance rather than a feature list. Under the form
              on a phone, where it does not push the fields down. */}
          <p className="mt-6 hidden items-center gap-2 text-sm font-semibold text-muted lg:inline-flex">
            <WifiOff className="h-4 w-4" aria-hidden />
            {t("signIn.offline")}
          </p>
        </section>

        <section className="mx-auto w-full max-w-[420px] lg:mr-0">
          <div className={themeSystem.card("default", "p-5 sm:p-6")}>
            <AccountForm autoFocus />
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-muted lg:hidden">
            {t("signIn.offline")}
          </p>
        </section>
      </main>
    </div>
  );
};
