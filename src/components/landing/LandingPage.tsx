import React from "react";
import { ArrowRight } from "lucide-react";

import { SvgMarkup, getSvgAsset, type SvgAssetId } from "../../assets/svg";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { LanguageSwitch } from "../account/SignInScreen";
import { KodaShowcase } from "./KodaShowcase";

/**
 * Icons in the sidebar's own style — flat, theme colours, one highlight —
 * drawn for this page or borrowed from the menu set, so the front door and
 * the app look like one product.
 */
const art = (id: SvgAssetId) => getSvgAsset(id) ?? "";
const menuArt = art;
const Icon: React.FC<{ markup: string; size?: string }> = ({ markup, size = "h-12 w-12" }) => (
  <span aria-hidden className={`block shrink-0 ${size}`}>
    <SvgMarkup markup={markup} size="100%" />
  </span>
);

/**
 * The front door, for a family who has never seen Koda — in Cambodia or abroad.
 *
 * Khmer is the headline: most city kids grow up with English, and reading and
 * writing Khmer is what their parents worry about first. Math and English
 * reading are mentioned, not sold.
 *
 * Short on purpose — hero, the Khmer path, four parent worries, screen time,
 * Start, footer. The first screen on a 390px phone is the headline and the
 * button.
 *
 * Nothing here promises more than the app does: the time limit and play hours
 * are real settings, the report is the real report, and the international
 * curriculum is marked as coming.
 */

/* The first four consonants, each in a theme tone — the picture says "Khmer" before a word is read. */
const LETTERS: { glyph: string; tone: string }[] = [
  { glyph: "ក", tone: "text-indigo-600" },
  { glyph: "ខ", tone: "text-pink-600" },
  { glyph: "គ", tone: "text-emerald-600" },
  { glyph: "ឃ", tone: "text-purple-600" },
];

const PATH: { key: string; icon: string }[] = [
  { key: "letters", icon: art("kit-letters") },
  { key: "words", icon: art("kit-words") },
  { key: "read", icon: menuArt("menu-library") },
  { key: "write", icon: menuArt("menu-trace") },
];

const WORRIES: { key: string; icon: string }[] = [
  { key: "khmer", icon: art("kit-languages") },
  { key: "fees", icon: art("kit-piggy") },
  { key: "records", icon: art("kit-report") },
  { key: "motivate", icon: menuArt("menu-learn") },
];

const SAFE: { key: string; icon: string }[] = [
  { key: "limit", icon: art("kit-timer") },
  { key: "hours", icon: art("kit-hours") },
  { key: "offline", icon: art("kit-offline") },
  { key: "curriculum", icon: art("kit-curriculum") },
];

const StartButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    type="button"
    onClick={() => {
      playSound("pop");
      onClick();
    }}
    className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-8 text-lg font-black text-indigo-700 shadow-xl shadow-indigo-900/25 transition hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0"
  >
    {label}
    <ArrowRight className="h-5 w-5" aria-hidden />
  </button>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-center text-2xl font-black tracking-tight text-ink sm:text-3xl">{children}</h2>
);

export const LandingPage: React.FC<{ onStart: () => void; onSignIn: () => void }> = ({ onStart, onSignIn }) => {
  const { t } = useT();
  const fox = getSvgAsset("avatar-fox") ?? "";

  return (
    <div className="flex min-h-dvh w-full flex-col bg-canvas">
      {/* HERO — one colour band, the promise, and Start. */}
      <section className={`${themeSystem.heroGradient} relative overflow-hidden text-white`}>
        <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 right-[-4rem] h-72 w-72 rounded-full bg-pink-400/25" />

        <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <span className="inline-flex items-center gap-2">
            <img src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg ring-2 ring-white/40" />
            <span className="text-lg font-extrabold tracking-tight">Koda</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-white/90 dark:bg-surface/90">
              <LanguageSwitch />
            </div>
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-9 cursor-pointer rounded-xl px-3 text-sm font-bold text-white ring-1 ring-white/50 transition hover:bg-white/15"
            >
              {t("account.signIn")}
            </button>
          </div>
        </header>

        <div className="relative mx-auto grid w-full max-w-5xl items-center gap-8 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pb-20 lg:pt-14">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/30">
              <Icon markup={menuArt("menu-koda")} size="h-4 w-4" />
              {t("landing.hero.eyebrow")}
            </p>
            <h1 className="mt-4 text-[34px] font-black leading-[1.15] tracking-tight !text-white text-balance sm:text-5xl lg:text-[56px]">
              {t("landing.hero.title")}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/90 sm:text-lg lg:mx-0">
              {t("landing.hero.body")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-2 lg:items-start">
              <StartButton onClick={onStart} label={t("landing.start")} />
              <p className="text-sm font-bold text-white/90">{t("landing.hero.free")}</p>
            </div>
          </div>

          {/* A letter board with Koda's fox — Khmer at a glance, bundled art, no image requests. */}
          <div aria-hidden className="relative mx-auto w-full max-w-sm">
            <div className="grid grid-cols-4 gap-2 rounded-[2rem] bg-white/95 p-3 shadow-2xl shadow-indigo-900/30 lg:grid-cols-2 lg:gap-3 lg:p-5">
              {LETTERS.map(({ glyph, tone }, i) => (
                <span
                  key={glyph}
                  lang="km"
                  className={`koda-bob grid aspect-square place-items-center rounded-2xl bg-surface-muted text-4xl font-black sm:text-5xl lg:text-7xl ${tone}`}
                  style={{ animationDelay: `${i * 0.35}s` }}
                >
                  {glyph}
                </span>
              ))}
            </div>
            <span className="absolute -bottom-6 -right-3 h-16 w-16 rounded-full bg-white p-1.5 shadow-lg shadow-indigo-900/25 ring-4 ring-white/40 lg:-bottom-8 lg:-right-6 lg:h-24 lg:w-24">
              <SvgMarkup markup={fox} size="100%" />
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-12 px-4 py-12 sm:px-6 lg:space-y-16 lg:py-16">
        {/* SEE IT WORK — six moments on a phone, playing by themselves. */}
        <KodaShowcase />

        {/* KHMER PATH — four steps a parent can picture. */}
        <section>
          <SectionTitle>{t("landing.path.title")}</SectionTitle>
          <ol className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {PATH.map(({ key, icon }, i) => (
              <li key={key} className={themeSystem.card("default", "relative p-4 text-center sm:p-5")}>
                <span className="absolute left-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-xs font-black text-white">
                  {i + 1}
                </span>
                <span className="mx-auto block w-fit">
                  <Icon markup={icon} size="h-14 w-14" />
                </span>
                <p className="mt-3 text-base font-black text-ink">{t(`landing.path.${key}`)}</p>
                <p className="mt-1 text-xs leading-relaxed text-body sm:text-sm">{t(`landing.path.${key}Body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FOUR WORRIES — each one a parent's own words, answered. */}
        <section>
          <SectionTitle>{t("landing.worries.title")}</SectionTitle>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {WORRIES.map(({ key, icon }) => (
              <li key={key} className={themeSystem.card("default", "flex items-start gap-4 p-4 sm:p-5")}>
                <Icon markup={icon} />
                <div className="min-w-0">
                  <p className="text-base font-black leading-snug text-ink">{t(`landing.worries.${key}.q`)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-body">{t(`landing.worries.${key}.a`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* SMART HELPER, HEALTHY SCREEN TIME — the AI is a tool, and the parent holds the clock. */}
        <section className={themeSystem.card("default", "p-5 sm:p-8")}>
          <div className="flex items-start gap-4">
            <Icon markup={menuArt("menu-koda")} />
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">{t("landing.safe.title")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-body sm:text-base">{t("landing.safe.body")}</p>
            </div>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SAFE.map(({ key, icon }) => (
              <li
                key={key}
                className="flex items-center gap-2.5 rounded-2xl bg-surface-muted px-3 py-3 text-sm font-bold text-ink"
              >
                <Icon markup={icon} size="h-8 w-8" />
                <span className="min-w-0 leading-snug">{t(`landing.safe.${key}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* START — the same button, once more, for whoever scrolled. */}
        <section className={`${themeSystem.heroGradient} rounded-3xl px-5 py-8 text-center text-white sm:py-10`}>
          <h2 className="text-2xl font-black tracking-tight !text-white sm:text-3xl">{t("landing.cta.title")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">{t("landing.cta.body")}</p>
          <div className="mt-5">
            <StartButton onClick={onStart} label={t("landing.start")} />
          </div>
        </section>
      </main>

      {/* FOOTER — what Koda is, what it teaches, and the two ways in. No links to pages that do not exist yet. */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2">
              <img src="/favicon.svg" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
              <span className="text-base font-extrabold tracking-tight text-ink">Koda</span>
            </span>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{t("landing.footer.about")}</p>
          </div>
          <div>
            <p className={themeSystem.statTile.label}>{t("landing.footer.learn")}</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-body">
              <li>{t("landing.footer.khmer")}</li>
              <li>{t("landing.footer.math")}</li>
              <li>{t("landing.footer.english")}</li>
            </ul>
          </div>
          <div>
            <p className={themeSystem.statTile.label}>{t("landing.footer.parents")}</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-body">
              <li>{t("landing.footer.report")}</li>
              <li>{t("landing.footer.screenTime")}</li>
              <li>{t("landing.hero.free")}</li>
            </ul>
          </div>
          <div>
            <p className={themeSystem.statTile.label}>Koda</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold">
              <li>
                <button type="button" onClick={onStart} className="cursor-pointer text-indigo-600 hover:underline dark:text-indigo-400">
                  {t("landing.start")}
                </button>
              </li>
              <li>
                <button type="button" onClick={onSignIn} className="cursor-pointer text-indigo-600 hover:underline dark:text-indigo-400">
                  {t("account.signIn")}
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:px-6">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>© {new Date().getFullYear()} Koda</span>
              <a href="/privacy" className="font-semibold hover:text-ink hover:underline">{t("legal.privacy")}</a>
              <a href="/terms" className="font-semibold hover:text-ink hover:underline">{t("legal.terms")}</a>
            </span>
            <span>{t("landing.footer.made")}</span>
          </p>
        </div>
      </footer>
    </div>
  );
};
