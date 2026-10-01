import React from "react";
import { ArrowLeft, Moon, Pause, Sun, Volume2 } from "lucide-react";
import { useT } from "../../lib/i18n";

export interface UIReaderToolbarProps {
  onBack(): void;
  smallerDisabled?: boolean;
  largerDisabled?: boolean;
  onSmallerText(): void;
  onLargerText(): void;
  audio?: { playing: boolean; onToggle(): void; disabled?: boolean; disabledTitle?: string; retryTitle?: string };
  dark: boolean;
  onToggleDark(): void;
  backLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * One quiet control: no border, no pushed-button edge, a soft fill on hover.
 *
 * The reader's controls sit around a page of a book, and a row of chunky
 * bordered buttons pulled the eye off the page and onto the chrome. They are
 * grouped in one pill instead, so they read as a single tool, and each keeps a
 * 44px target for a finger.
 */
const tool = "grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink transition-[background-color,color,transform] duration-150 hover:bg-surface-muted active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:active:scale-100 motion-reduce:transition-none [&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem]";

/** Shared reader controls: one mobile-safe toolbar for books and other readers. */
export const UIReaderToolbar: React.FC<UIReaderToolbarProps> = ({
  onBack,
  smallerDisabled = false,
  largerDisabled = false,
  onSmallerText,
  onLargerText,
  audio,
  dark,
  onToggleDark,
  backLabel,
  className = "",
  children,
}) => {
  const { t } = useT();
  return (
  <div className={`mobile-reader-toolbar ${className}`}>
    <div className="mobile-reader-toolbar-row flex items-center justify-between gap-2 py-1">
      <button type="button" onClick={onBack} aria-label={t("reader.backToBook")} className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full pl-2.5 pr-4 text-sm font-bold text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel ?? t("reader.back")}
      </button>
      <div className="flex items-center gap-0.5 rounded-full bg-surface-muted/60 p-0.5 dark:bg-surface-muted/50">
        <div role="group" aria-label={t("reader.textSize")} className="flex items-center">
          <button type="button" onClick={onSmallerText} disabled={smallerDisabled} aria-label={t("reader.smaller")} className={tool}>
            <span aria-hidden="true" className="font-serif text-sm font-bold leading-none">A</span>
          </button>
          <button type="button" onClick={onLargerText} disabled={largerDisabled} aria-label={t("reader.larger")} className={tool}>
            <span aria-hidden="true" className="font-serif text-xl font-bold leading-none">A</span>
          </button>
        </div>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
        {audio && (
          <button
            type="button"
            onClick={audio.onToggle}
            disabled={audio.disabled}
            aria-label={audio.playing ? t("reader.stop") : t("reader.play")}
            title={audio.disabled ? audio.disabledTitle ?? t("reader.preparingAudio") : audio.retryTitle ?? (audio.playing ? t("reader.stop") : t("reader.play"))}
            aria-pressed={audio.playing}
            className={`${tool} ${audio.playing ? "!bg-indigo-600 !text-white" : ""}`}
          >
            {audio.playing ? <Pause aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </button>
        )}
        <button type="button" onClick={onToggleDark} aria-label={dark ? t("reader.lightMode") : t("reader.darkMode")} aria-pressed={dark} title={dark ? t("reader.lightMode") : t("reader.darkMode")} className={tool}>
          {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
        {children}
      </div>
    </div>
  </div>
  );
};
