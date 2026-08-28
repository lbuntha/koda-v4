import React from "react";
import { Mic, MessageCircle } from "lucide-react";

import { askKoda, type KodaAskMode } from "../lib/koda";
import { useKoda } from "../lib/useKoda";
import { playSound } from "../utils/audio";
import { themeSystem } from "../lib/themeSystem";
import { SvgAsset } from "../assets/svg";

/**
 * Ask Koda, floating where a child can always find it.
 *
 * Shown to everybody, including families whose plan does not cover it — the
 * check happens on the tap, not on the render. That is a deliberate reversal of
 * how the sidebar tools work: a feature nobody can see is a feature nobody asks
 * for, and a parent who never learns Koda can talk has no reason to want it.
 * What a family without it gets is one plain sentence, from `UpgradePrompt`.
 *
 * Hidden entirely when the *deployment* offers neither talking nor writing:
 * that is not an upgrade away, it simply does not run here, and offering it
 * would be a promise no plan could keep. One mode off is not that case — the
 * button stays and opens whichever half is on. Which one that is comes from
 * `preferredKodaMode`, not from here, so every Koda button in the app opens the
 * same thing.
 */
export const KodaFab: React.FC<{ onAsk: (mode: KodaAskMode) => void }> = ({ onAsk }) => {
  const koda = useKoda();
  const mode = koda.mode;
  if (!mode) return null;

  return (
    <button
      onClick={() => {
        playSound("pop");
        // One line, and the plan, the wording and the dialog are handled. Asked
        // of the mode this tap is actually going to open, so a voice-only Koda
        // explains an unpaid plan rather than refusing on a switch nobody set.
        askKoda(mode, () => onAsk(mode));
      }}
      title="Ask Koda"
      aria-label="Ask Koda"
      className={[
        // Above the page, below every modal — a dialog must never have to argue
        // with a button for the top of the screen.
        "fixed right-4 sm:right-6 z-40",
        // Sits above the tab bar rather than on it, and clears the iOS home
        // indicator with it. One token, so moving the dock moves this too.
        themeSystem.appShell.aboveTabBar,
        // A circle on a phone, a labelled pill from `sm` up. The word costs
        // nothing on a laptop and costs a third of the screen on a 390px
        // handset — where a round button floating bottom-right is already the
        // most recognised control on the device.
        "flex items-center justify-center gap-2.5 rounded-full h-14 w-14 sm:h-auto sm:w-auto sm:py-3.5 sm:pl-4 sm:pr-5",
        "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30",
        "transition-transform hover:scale-105 active:scale-95",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300",
      ].join(" ")}
    >
      <span className="flex h-7 w-7 items-center justify-center">
        <SvgAsset
          id="koda-ask"
          size={28}
          fallback={mode === "voice" ? <Mic className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        />
      </span>
      <span className="hidden sm:inline font-mono text-sm font-black uppercase tracking-wide">
        Ask Koda
      </span>
    </button>
  );
};
