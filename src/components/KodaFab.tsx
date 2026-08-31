import React from "react";

import { askKoda, type KodaAskMode } from "../lib/koda";
import { useKoda } from "../lib/useKoda";
import { useSystem } from "../lib/sync";
import { playSound } from "../utils/audio";
import { themeSystem } from "../lib/themeSystem";
import { KodaBuddy } from "./KodaBuddy";
import { paletteFor } from "./KodaMascot";
import { usePersona } from "../lib/usePersona";

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
  // Whose Koda this is. The button and the conversation must agree.
  const character = usePersona();
  /* Appearance, so it is asked of the switchboard rather than of the plan: an
     operator turning the tile off is a look, not an entitlement. Unknown ids
     read as allowed, so a deployment that has never heard of this setting gets
     the tile — which is the intended default. */
  const { allows } = useSystem();
  if (!mode) return null;

  return (
    <KodaBuddy
      /*
       * The key is retired whenever the anchor moves, which is why this is at
       * `.v3` for a control that has only ever sat in two corners. What is
       * remembered is an *offset from the anchor*, so an offset saved against
       * one corner is a different place against another — restoring it would
       * fling Koda a screen-width away and leave the clamp to flatten it
       * against an edge. Dropping the old offsets is the honest reading.
       */
      /*
       * The character the child will actually meet, not the brand one.
       *
       * The button drew `KODA_BRAND` purple while the conversation behind it
       * drew the family's chosen teacher — so a child tapped a purple Koda and
       * a green one answered. Two colours for one character is the app telling
       * a child there are two of them.
       *
       * The brand face still exists for places that point at Koda as a product
       * — a toolbar, a marketing tile — where no teacher has been chosen yet.
       * This is not one of those: it opens the conversation.
       */
      palette={paletteFor(character.personaId)}
      storageKey="koda.fab.place.v3"
      backdrop={allows("ui.kodaBackdrop")}
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
        //
        // Bottom-right, at every width — one class, not three rules, so the
        // phone, the tablet and the laptop cannot drift apart. `KodaBuddy`
        // mirrors on whichever side of the middle it sits, so from this corner
        // it turns to look back across the page.
        "fixed right-4 sm:right-6 z-40",
        // Where it starts, not where it stays. Sits above the tab bar rather
        // than on it, and clears the iOS home indicator with it. One token, so
        // moving the dock moves this too.
        themeSystem.appShell.aboveTabBar,
      ].join(" ")}
    />
  );
};
