/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Who plays each moment when nobody has been cast.
 *
 * The role → style-name mapping only pays off for an account that has drawn a
 * style under each of those names. Until then every role resolved down the same
 * fallback chain and landed on the same artwork, so a board read the question,
 * waited, and got an answer wrong wearing one face throughout. The mapping was
 * real and bought nothing — which is indistinguishable, from the outside, from
 * being broken.
 *
 * So the fallback is cast too. Every role has a **built-in character**, drawn
 * from Mascot Studio's own presets, and it is what a canvas gets before anybody
 * saves anything. The four are siblings on purpose — same soft pentagon, same
 * eyes, changing palette, expression and motion — because a child has to read
 * them as Koda feeling something rather than as four mascots taking turns.
 *
 * ## Per component
 *
 * `COMPONENT_CAST` lets one activity break from the house cast without
 * disturbing the others: a story canvas might want a narrator where Count wants
 * a coach. It is keyed by technique and starts empty, which is the honest
 * default — a component that has no opinion should not have to state one.
 */

import { createLayersFromAssetIds } from "../../admin/mascot-studio/model";
import { instantiateMascotStyle, MASCOT_STYLE_PRESETS } from "../../admin/mascot-studio/presets";
import type { MascotDocument } from "./types";
import type { ActorRole } from "./useStudioMascot";

/** The house cast: which Mascot Studio preset plays each moment. */
export const DEFAULT_CAST: Record<ActorRole, string> = {
  talking: "shape-talker",
  waiting: "shape-waiting",
  oops: "shape-oops",
  celebrating: "quiz-hero",
};

/**
 * Per-component overrides, keyed by technique. Empty is the normal state.
 *
 * An entry here only has to name the roles it disagrees about; everything else
 * falls through to `DEFAULT_CAST`.
 */
export const COMPONENT_CAST: Record<string, Partial<Record<ActorRole, string>>> = {};

/** Which preset plays this role, for this component. */
export const castPresetId = (component: string | undefined, role: ActorRole): string =>
  (component ? COMPONENT_CAST[component]?.[role] : undefined) ?? DEFAULT_CAST[role];

/*
  Built once and kept. A preset is a template — layers have to be created from
  its asset ids and composed with its groups and clips — and doing that on every
  render of every Koda would rebuild the same document dozens of times a second
  during a jump.
*/
const built = new Map<string, MascotDocument | undefined>();

/** A preset as a finished document, ready for `KodaMascot`. */
export const presetDocument = (presetId: string): MascotDocument | undefined => {
  if (built.has(presetId)) return built.get(presetId);

  const preset = MASCOT_STYLE_PRESETS.find(candidate => candidate.id === presetId);
  const document = preset
    ? ({
        schemaVersion: 1,
        id: `cast-${preset.id}`,
        name: preset.name,
        slug: preset.id,
        purpose: "custom",
        description: `Built-in cast member: ${preset.name}.`,
        tags: ["cast", preset.id],
        canvas: { width: 256, height: 256, viewBox: "0 0 256 256" },
        palette: preset.palette,
        ...instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds)),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      } as MascotDocument)
    : undefined;

  built.set(presetId, document);
  return document;
};

/** The character that plays this role here, with nothing saved and nothing cast. */
export const defaultActorDocument = (component: string | undefined, role: ActorRole): MascotDocument | undefined =>
  presetDocument(castPresetId(component, role));
