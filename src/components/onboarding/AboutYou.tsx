/**
 * "A little about you" — asked once, right after sign-up.
 *
 * Someone learning on their own gives the year they were born (it picks their
 * lessons, Word Guess word length and how Home looks) and their country. A
 * parent gives only their country; each child's birth year is asked when the
 * child is added. One screen, then gone: "Not now" is allowed and the screen
 * does not come back by itself on this device.
 */

import React, { useState } from "react";
import { Globe2 } from "lucide-react";
import { SessionAPI, accessToken, request, useSession } from "../../lib/sync";
import type { Session } from "../../lib/sync/session";
import { guessCountry } from "../../lib/countries";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../ui";
import { useT } from "../../lib/i18n";
import { CountryPicker } from "./CountryPicker";

/** Birth years offered: from five years old back to ninety. */
export const birthYears = (now = new Date().getFullYear()): number[] => Array.from({ length: 86 }, (_, i) => now - 5 - i);

export const aboutYouKey = (userId: string) => `koda.aboutYou.${userId}`;

type Who = Pick<Session, "role" | "userId" | "learnerId" | "learnerBirthYear" | "country">;

const needsYear = (s: Who) => s.role === "student" && Boolean(s.learnerId) && !s.learnerBirthYear;
const needsCountry = (s: Who) => Boolean(s.userId) && s.role !== "child" && !s.country;

/** Whether to ask: a signed-in person missing a birth year (learning on their own) or a country, not asked on this device. */
export const shouldAskAboutYou = (s: Who | null): boolean => {
  if (!s?.userId || !(needsYear(s) || needsCountry(s))) return false;
  try {
    return !localStorage.getItem(aboutYouKey(s.userId));
  } catch {
    return false;
  }
};

export const AboutYou: React.FC<{ onClose(): void }> = ({ onClose }) => {
  const { t } = useT();
  const session = useSession();
  const askYear = session ? needsYear(session) : false;
  const askCountry = session ? needsCountry(session) : false;
  const [year, setYear] = useState("");
  const [country, setCountry] = useState<string | null>(() => (askCountry ? guessCountry() : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    try {
      if (session?.userId) localStorage.setItem(aboutYouKey(session.userId), "1");
    } catch {
      /* asked again next launch at worst */
    }
    onClose();
  };

  const ready = (!askYear || year !== "") && (!askCountry || country !== null);

  const save = async () => {
    if (!session || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (askYear && session.learnerId) {
        await request(`/learners/${session.learnerId}`, {
          method: "PATCH",
          token: await accessToken(),
          body: { displayName: session.learnerName || session.displayName || "Me", birthYear: Number(year) },
        });
      }
      if (askCountry && country) await SessionAPI.updateProfile({ country });
      await SessionAPI.verify();
      close();
    } catch {
      setError(typeof navigator !== "undefined" && navigator.onLine === false ? t("aboutYou.offline") : t("aboutYou.failed"));
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("aboutYou.title")}
      className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-canvas animate-fadeIn"
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-6 pt-8 sm:px-6 sm:pb-10 sm:pt-14">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Globe2 className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-black leading-tight text-ink sm:text-3xl">{t("aboutYou.title")}</h1>
        <p className="mt-2 text-base text-muted">{askYear ? t("aboutYou.bodyLearner") : t("aboutYou.bodyParent")}</p>

        {askYear && (
          <label className="mt-6 block">
            <span className="text-sm font-bold text-ink">{t("aboutYou.year")}</span>
            <select
              className={`${themeSystem.field("lg", "w-full")} mt-1.5`}
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="" disabled>
                {t("aboutYou.yearPick")}
              </option>
              {birthYears().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}

        {askCountry && (
          <div className="mt-6">
            <span className="text-sm font-bold text-ink">{t("aboutYou.country")}</span>
            <div className="mt-1.5">
              <CountryPicker value={country} onChange={setCountry} label={t("aboutYou.country")} />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm font-bold text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-8 sm:mt-8">
          <UIButton variant="primary" size="lg" className="w-full" isLoading={busy} disabled={!ready} onClick={() => void save()}>
            {t("aboutYou.save")}
          </UIButton>
          <UIButton variant="ghost" className="w-full" disabled={busy} onClick={close}>
            {t("aboutYou.later")}
          </UIButton>
        </div>
      </div>
    </div>
  );
};
