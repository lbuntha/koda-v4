import React from "react";
import { ArrowLeft, Moon, Pause, Sun, Volume2 } from "lucide-react";
import { UIButton } from "./ThemeUI";

export interface UIReaderToolbarProps {
  onBack(): void;
  smallerDisabled?: boolean;
  largerDisabled?: boolean;
  onSmallerText(): void;
  onLargerText(): void;
  audio?: { playing: boolean; onToggle(): void };
  dark: boolean;
  onToggleDark(): void;
  backLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

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
  backLabel = "Back",
  className = "",
  children,
}) => (
  <div className={`mobile-reader-toolbar ${className}`}>
    <div className="mobile-reader-toolbar-row flex flex-wrap items-center justify-between gap-2">
      <UIButton type="button" variant="secondary" size="md" icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />} onClick={onBack} aria-label={`${backLabel} to book`}>
        {backLabel}
      </UIButton>
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Text size" className="flex items-center gap-1">
          <UIButton type="button" variant="secondary" size="icon" onClick={onSmallerText} disabled={smallerDisabled} aria-label="Smaller text" className="!h-11 !min-h-11 !w-11 !min-w-11 !p-0">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center font-serif text-sm font-bold leading-none">A</span>
          </UIButton>
          <UIButton type="button" variant="secondary" size="icon" onClick={onLargerText} disabled={largerDisabled} aria-label="Larger text" className="!h-11 !min-h-11 !w-11 !min-w-11 !p-0">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center font-serif text-xl font-bold leading-none">A</span>
          </UIButton>
        </div>
        {audio && (
          <UIButton type="button" variant="secondary" size="icon" onClick={audio.onToggle} aria-label={audio.playing ? "Stop reading" : "Play page recording"} title={audio.playing ? "Stop reading" : "Play page recording"} aria-pressed={audio.playing}>
            {audio.playing ? <Pause aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </UIButton>
        )}
        <UIButton type="button" variant="secondary" size="icon" onClick={onToggleDark} aria-label={dark ? "Use light mode" : "Use dark mode"} aria-pressed={dark} title={dark ? "Use light mode" : "Use dark mode"}>
          {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </UIButton>
        {children}
      </div>
    </div>
  </div>
);
