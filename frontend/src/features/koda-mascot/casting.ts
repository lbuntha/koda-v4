/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Where a slide's casting is kept, and how the two halves read it.
 *
 * Casting has two ends — a panel writes it, a canvas draws it — and until this
 * module the config keys were spelled out at both, plus once more in the
 * generator schema. Three literals for one contract is a rename waiting to go
 * half-done, and the failure it produces is silent: the panel keeps saving, the
 * board keeps drawing the built-ins, and nothing anywhere says why.
 *
 * So the keys are named once, here, and both ends come through this file.
 *
 * ## Adding casting to a component
 *
 * Two lines, one at each end:
 *
 * ```tsx
 * // its panel — src/components/studio/panels/YourPanel.tsx
 * <ActorCastField config={config} updateConfig={updateConfig} />
 *
 * // its canvas — the props go straight onto SharedCanvasLayout
 * <SharedCanvasLayout {...guidePropsFor(question)} guideRole={…} … />
 * ```
 *
 * `guideRole` stays the canvas's own call: it is the beat the board is *on*,
 * which only the canvas knows — see `SharedCanvasLayout` for why `talking` is
 * not worth passing.
 */

import type { GuideCast } from "./useStudioMascot";

/** The two config keys casting lives in. Nothing else should spell them. */
const ACTOR_KEY = "mascotStyle";
const CAST_KEY = "mascotStyles";

/** A slide, as much of one as casting needs to see. */
export interface CastableQuestion {
  config?: Record<string, unknown>;
  technique?: string;
}

/** This slide's per-moment casting. Always an object, so a caller can index it. */
export const readGuideCast = (config: Record<string, unknown> | undefined): GuideCast =>
  (config?.[CAST_KEY] as GuideCast | undefined) ?? {};

/**
 * The slide-wide actor, from before casting was per-moment.
 *
 * Still read, never written: a slide authored against the old panel keeps its
 * character, and `ActorCastField` reports one rather than letting it act under
 * four pickers that all say "Auto".
 */
export const readLegacyActor = (config: Record<string, unknown> | undefined): string | undefined => {
  const actor = config?.[ACTOR_KEY];
  return typeof actor === "string" && actor ? actor : undefined;
};

/**
 * A moment set back to Auto is *removed*, so the slide stores only real choices
 * — and the last one leaving takes the whole key with it, so a slide nobody
 * cast about is a slide with nothing written on it.
 */
export const writeGuideCast = (
  config: Record<string, unknown>,
  role: keyof GuideCast,
  style: string,
): Record<string, unknown> => {
  const next: GuideCast = { ...readGuideCast(config) };
  if (style) next[role] = style;
  else delete next[role];
  return { [CAST_KEY]: Object.keys(next).length ? next : undefined };
};

/** Clears the legacy actor. The one write this module makes to that key. */
export const clearLegacyActor = (): Record<string, unknown> => ({ [ACTOR_KEY]: undefined });

/** Everything `SharedCanvasLayout` needs to cast a slide, ready to spread. */
export interface GuideProps {
  guideStyle?: string;
  guideCast?: GuideCast;
  guideComponent?: string;
}

export const guidePropsFor = (question: CastableQuestion): GuideProps => ({
  guideStyle: readLegacyActor(question.config),
  guideCast: question.config?.[CAST_KEY] as GuideCast | undefined,
  guideComponent: question.technique,
});
