import React from "react";
import { ArrowLeft } from "lucide-react";

import { useT } from "../../lib/i18n";
import { LanguageSwitch } from "../account/SignInScreen";
import { CONTACT_EMAIL, UPDATED, legalDoc, type LegalKind } from "./legalText";

/**
 * Koda's Privacy Policy or Terms, at `/privacy` and `/terms`.
 *
 * Reachable signed in or not — Google's sign-in screen links here, and a parent
 * deciding whether to trust Koda has not made an account yet. A plain reading
 * page: one column, the document's own headings, the contact address at the
 * end, and a way back to Koda.
 */
export const LegalPage: React.FC<{ kind: LegalKind }> = ({ kind }) => {
  const { t, language } = useT();
  const doc = legalDoc(kind, language);
  const other: LegalKind = kind === "privacy" ? "terms" : "privacy";
  const updated = new Date(`${UPDATED}T00:00:00`).toLocaleDateString(language === "km" ? "km-KH" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  React.useEffect(() => {
    document.title = `${doc.title} · Koda`;
  }, [doc.title]);

  return (
    <div className="min-h-dvh bg-surface text-body">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-indigo-600 hover:underline dark:text-indigo-400">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <img src="/favicon.svg" alt="" width={24} height={24} className="h-6 w-6 rounded-md" />
            {t("legal.back")}
          </a>
          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted">{t("legal.updated", { date: updated })}</p>
        <p className="mt-6 text-base leading-relaxed">{doc.intro}</p>

        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-lg font-extrabold text-ink">{section.heading}</h2>
            {section.body.some((line) => line.startsWith("• ")) ? (
              <>
                {section.body.filter((line) => !line.startsWith("• ")).map((line) => (
                  <p key={line} className="mt-3 leading-relaxed">{line}</p>
                ))}
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed marker:text-indigo-500">
                  {section.body.filter((line) => line.startsWith("• ")).map((line) => (
                    <li key={line}>{line.slice(2)}</li>
                  ))}
                </ul>
              </>
            ) : (
              section.body.map((line) => <p key={line} className="mt-3 leading-relaxed">{line}</p>)
            )}
          </section>
        ))}

        <section className="mt-10 rounded-2xl border border-line bg-surface-muted p-5">
          <h2 className="text-lg font-extrabold text-ink">{t("legal.contact")}</h2>
          <p className="mt-2 leading-relaxed">
            {t("legal.contactNote")}{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-bold text-indigo-600 hover:underline dark:text-indigo-400">{CONTACT_EMAIL}</a>
          </p>
        </section>

        <p className="mt-8 text-sm">
          <a href={`/${other}`} className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">{t(`legal.${other}`)}</a>
        </p>
      </main>
    </div>
  );
};
