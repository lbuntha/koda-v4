import React from "react";

import { askKoda, type KodaAskMode } from "../lib/koda";
import { useKoda } from "../lib/useKoda";
import { playSound } from "../utils/audio";
import { themeSystem } from "../lib/themeSystem";
import { KodaBuddy } from "./KodaBuddy";

/**
 * Ask Koda, floating where a child can always find it — and draggable to
 * wherever that turns out to be.
 *
 * This file is the *gate* and nothing else: who may see the button, what a tap
 * opens, and where it starts. The character, the dragging and the way it turns
 * to face the screen are `KodaBuddy`, so a second floating helper does not have
 * to reimplement any of it.
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
 *
 * It is the character rather than a microphone glyph because it is a character
 * everywhere else in the app — the voice modal, the roster, the profile — and a
 * mic meant a child had to be told the icon was Koda. It wears the brand colour
 * rather than a teacher's, because this is the way *in* to Koda and should look
 * the same for every child on every device; the character a child was actually
 * given still greets them inside, where the conversation is.
 */
export const KodaFab: React.FC<{ onAsk: (mode: KodaAskMode) => void }> = ({ onAsk }) => {
  const koda = useKoda();
  const mode = koda.mode;
  if (!mode) return null;

  return (
    <KodaBuddy
      storageKey="koda.fab.place"
      onPress={() => {
        playSound("pop");
        // One line, and the plan, the wording and the dialog are handled. Asked
        // of the mode this tap is actually going to open, so a voice-only Koda
        // explains an unpaid plan rather than refusing on a switch nobody set.
        askKoda(mode, () => onAsk(mode));
      }}
      className={[
        // Above the page, below every modal — a dialog must never have to argue
        // with a button for the top of the screen.
        "fixed right-4 sm:right-6 z-40",
        // Where it starts, not where it stays. Sits above the tab bar rather
        // than on it, and clears the iOS home indicator with it. One token, so
        // moving the dock moves this too.
        themeSystem.appShell.aboveTabBar,
      ].join(" ")}
    />
  );
};
