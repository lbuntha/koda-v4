import React from "react";

import { FALLBACK_CHARACTER } from "../lib/personas";
import { KodaMascot, type MascotPalette, type MascotState } from "./KodaMascot";

/**
 * Koda's colour when it is standing in for the product rather than for a
 * teacher.
 *
 * Literal hexes because DiceBear needs a concrete colour to draw with; they are
 * `--color-indigo-600` and `--color-indigo-400` from `index.css`, which are
 * brand constants and the same in both themes.
 */
export const KODA_BRAND: MascotPalette = { head: "#6B46C1", accent: "#9F7AEA" };

export interface KodaFaceProps {
  size?: number;
  state?: MascotState;
  palette?: MascotPalette;
  className?: string;
}

/**
 * The canonical Koda: one face, one colour, wherever the app points at Koda
 * itself rather than at a child's own teacher.
 *
 * It exists so that "which Koda, and what colour" is decided once. Every
 * entry point to Koda — the floating buddy, the Ask Koda buttons in a lesson —
 * draws the same character, which is the whole reason a child recognises it as
 * a character rather than as an assortment of icons.
 *
 * Purely decorative: no pointer events of its own, so it never eats the press
 * meant for the control it sits inside. `KodaBuddy` wraps it in a drag; a
 * toolbar button just renders it.
 *
 * The teacher a child was actually given is a different question, and
 * `usePersona` answers it — inside the conversation, where it belongs.
 */
export const KodaFace: React.FC<KodaFaceProps> = ({
  size = 24,
  state = "idle",
  palette = KODA_BRAND,
  className = "",
}) => (
  <KodaMascot
    state={state}
    personaId={FALLBACK_CHARACTER.personaId}
    avatarSeed={FALLBACK_CHARACTER.avatarSeed}
    palette={palette}
    size={size}
    className={`pointer-events-none ${className}`}
  />
);
