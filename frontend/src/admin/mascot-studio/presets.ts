import type { MascotAnimationClip, MascotBehavior, MascotGroup, MascotKeyframeEasing, MascotKeyframeTarget, MascotLayer, MascotPalette } from "./types";

interface MascotStyleGroupTemplate {
  id: string;
  name: string;
  memberAssetIds: string[];
  pivot: { x: number; y: number };
}

interface MascotStyleKeyframeTemplate {
  time: number;
  targetType: MascotKeyframeTarget;
  /** Asset ID for a layer target, or template group ID for a group target. */
  target: string;
  easing?: MascotKeyframeEasing;
  values: Partial<Pick<MascotLayer, "x" | "y" | "scale" | "scaleX" | "scaleY" | "rotation" | "opacity">>;
}

interface MascotStyleClipTemplate {
  id: string;
  name: string;
  duration: number;
  loop: boolean;
  keyframes: MascotStyleKeyframeTemplate[];
}

const eyeSwapBeat = (openEye: string, closedEye: string, at: number, hold = .1): MascotStyleKeyframeTemplate[] => [
  { time: at, targetType: "layer", target: openEye, values: { opacity: 1, scaleY: 1 } },
  { time: at, targetType: "layer", target: closedEye, values: { opacity: 0, scaleY: .75 } },
  { time: at + .035, targetType: "layer", target: openEye, easing: "easeOut", values: { opacity: 0, scaleY: .28 } },
  { time: at + .035, targetType: "layer", target: closedEye, easing: "easeOut", values: { opacity: 1, scaleY: 1 } },
  { time: at + .035 + hold, targetType: "layer", target: openEye, values: { opacity: 0, scaleY: .28 } },
  { time: at + .035 + hold, targetType: "layer", target: closedEye, values: { opacity: 1, scaleY: 1 } },
  { time: at + .07 + hold, targetType: "layer", target: openEye, easing: "easeOut", values: { opacity: 1, scaleY: 1 } },
  { time: at + .07 + hold, targetType: "layer", target: closedEye, easing: "easeOut", values: { opacity: 0, scaleY: .75 } },
];

export interface MascotStylePreset {
  id: string;
  name: string;
  palette: MascotPalette;
  assetIds: string[];
  layerOverrides?: Array<{ assetId: string; patch: Partial<MascotLayer> }>;
  groups?: MascotStyleGroupTemplate[];
  clips?: MascotStyleClipTemplate[];
  behavior?: MascotBehavior;
}

export const instantiateMascotStyle = (preset: MascotStylePreset, sourceLayers: MascotLayer[]): { layers: MascotLayer[]; groups: MascotGroup[]; clips: MascotAnimationClip[]; activeClipId: string; behavior?: MascotBehavior } => {
  const groupId = (templateId: string) => `group-${preset.id}-${templateId}`;
  const groups: MascotGroup[] = (preset.groups ?? []).map((group) => ({ id: groupId(group.id), name: group.name, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, pivot: group.pivot }));
  const layers = sourceLayers.map((source) => {
    const override = preset.layerOverrides?.find((entry) => entry.assetId === source.assetId)?.patch;
    const parent = preset.groups?.find((group) => group.memberAssetIds.includes(source.assetId));
    return { ...source, ...override, parentId: parent ? groupId(parent.id) : source.parentId };
  });
  const clips: MascotAnimationClip[] = (preset.clips ?? [{ id: "idle", name: "Idle", duration: 2, loop: true, keyframes: [] }]).map((clip) => ({
    ...clip,
    id: `clip-${preset.id}-${clip.id}`,
    keyframes: clip.keyframes.map((frame, index) => {
      const targetId = frame.targetType === "group" ? groupId(frame.target) : layers.find((layer) => layer.assetId === frame.target)?.id ?? frame.target;
      return { id: `keyframe-${preset.id}-${clip.id}-${index}`, time: frame.time, targetType: frame.targetType, targetId, easing: frame.easing ?? "easeInOut", values: frame.values };
    }),
  }));
  return { layers, groups, clips, activeClipId: clips[0].id, behavior: preset.behavior };
};

export const MASCOT_STYLE_PRESETS: MascotStylePreset[] = [
  {
    id: "classic",
    name: "Classic",
    palette: { primary: "#534AB7", secondary: "#7C6DD8", accent: "#EF9F27", ink: "#0E0B55", white: "#FFFFFF" },
    assetIds: ["body-boulder", "pattern-freckles", "accessory-antenna", "eyes-even", "mouth-laugh"],
  },
  {
    id: "galaxy",
    name: "Galaxy",
    palette: { primary: "#312E81", secondary: "#8B5CF6", accent: "#EC4899", ink: "#171247", white: "#FFFFFF" },
    assetIds: ["body-cube", "pattern-spiral", "accessory-spikes", "eyes-googly", "mouth-smile-big"],
  },
  {
    id: "sunny",
    name: "Sunny",
    palette: { primary: "#F5B942", secondary: "#F97316", accent: "#EF4444", ink: "#4A2A13", white: "#FFFFFF" },
    assetIds: ["body-gumdrop", "pattern-zig", "accessory-crest", "eyes-happy", "mouth-smile"],
  },
  {
    id: "mint",
    name: "Mint",
    palette: { primary: "#34D399", secondary: "#0D9488", accent: "#FB7185", ink: "#134E4A", white: "#FFFFFF" },
    assetIds: ["body-blob", "pattern-checker", "accessory-tuft", "eyes-tiny", "mouth-cat"],
  },
  {
    id: "berry",
    name: "Berry",
    palette: { primary: "#C026D3", secondary: "#7E22CE", accent: "#F59E0B", ink: "#3B0764", white: "#FFFFFF" },
    assetIds: ["body-pear", "pattern-buttons", "accessory-curl", "eyes-inward", "mouth-smile-tongue"],
  },
  {
    id: "ocean",
    name: "Ocean",
    palette: { primary: "#3B82F6", secondary: "#06B6D4", accent: "#F97316", ink: "#172554", white: "#FFFFFF" },
    assetIds: ["body-loaf", "pattern-coil", "accessory-horns-small", "eyes-side", "mouth-grin"],
  },
  {
    id: "shape-talker",
    name: "Shape Talker",
    palette: { primary: "#5B50ED", secondary: "#4338CA", accent: "#F9A8D4", ink: "#111827", white: "#FFFFFF" },
    assetIds: ["body-soft-pentagon", "eyes-white-round", "pupil-round", "eyes-closed-friendly", "mouth-talk-rest", "mouth-talk-small", "mouth-talk-wide", "mouth-talk-o"],
    layerOverrides: [
      { assetId: "body-soft-pentagon", patch: { name: "Soft Pentagon", outline: false, rotation: -7 } },
      { assetId: "eyes-white-round", patch: { name: "White Eyes Open", animation: "none", opacity: 1 } },
      { assetId: "pupil-round", patch: { name: "Moving Black Pupils", animation: "look", animationIntensity: 4, animationFeel: "smooth", duration: 3.8, opacity: 1 } },
      { assetId: "eyes-closed-friendly", patch: { name: "Eyes Closed", animation: "none", opacity: 0 } },
      { assetId: "mouth-talk-rest", patch: { name: "Talk Rest", opacity: 1 } },
      { assetId: "mouth-talk-small", patch: { name: "Talk Small", opacity: 0 } },
      { assetId: "mouth-talk-wide", patch: { name: "Talk Wide", opacity: 0 } },
      { assetId: "mouth-talk-o", patch: { name: "Talk O", opacity: 0 } },
    ],
    groups: [{ id: "shape", name: "Shape Character", memberAssetIds: ["body-soft-pentagon", "eyes-white-round", "pupil-round", "eyes-closed-friendly", "mouth-talk-rest", "mouth-talk-small", "mouth-talk-wide", "mouth-talk-o"], pivot: { x: 128, y: 145 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 210, damping: 22, mass: .8 } },
    clips: [{
      id: "friendly-talk", name: "Friendly Talk", duration: 2, loop: true,
      keyframes: [
        { time: 0, targetType: "group", target: "shape", values: { y: 0, rotation: 0 } },
        { time: 0, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 1 } },
        { time: 0, targetType: "layer", target: "mouth-talk-small", values: { opacity: 0 } },
        { time: 0, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 0 } },
        { time: 0, targetType: "layer", target: "mouth-talk-o", values: { opacity: 0 } },
        { time: .19, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 1 } },
        { time: .19, targetType: "layer", target: "mouth-talk-small", values: { opacity: 0 } },
        { time: .2, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 0 } },
        { time: .2, targetType: "layer", target: "mouth-talk-small", values: { opacity: 1, scaleY: .75 } },
        { time: .37, targetType: "layer", target: "mouth-talk-small", values: { opacity: 1, scaleY: .75 } },
        { time: .37, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 0 } },
        { time: .38, targetType: "layer", target: "mouth-talk-small", values: { opacity: 0 } },
        { time: .38, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 1, scaleY: 1 } },
        { time: .61, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 1, scaleY: 1 } },
        { time: .61, targetType: "layer", target: "mouth-talk-o", values: { opacity: 0 } },
        { time: .62, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 0 } },
        { time: .62, targetType: "layer", target: "mouth-talk-o", values: { opacity: 1, scaleY: .72 } },
        { time: .83, targetType: "layer", target: "mouth-talk-o", values: { opacity: 1, scaleY: .72 } },
        { time: .83, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 0 } },
        { time: .84, targetType: "layer", target: "mouth-talk-o", values: { opacity: 0 } },
        { time: .84, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 1 } },
        ...eyeSwapBeat("eyes-white-round", "eyes-closed-friendly", 1.12, .08),
        { time: 1.12, targetType: "layer", target: "pupil-round", values: { opacity: 1 } },
        { time: 1.155, targetType: "layer", target: "pupil-round", easing: "easeOut", values: { opacity: 0 } },
        { time: 1.235, targetType: "layer", target: "pupil-round", values: { opacity: 0 } },
        { time: 1.27, targetType: "layer", target: "pupil-round", easing: "easeOut", values: { opacity: 1 } },
        { time: 1.42, targetType: "group", target: "shape", values: { y: -2, rotation: 1.5 } },
        { time: 1.44, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 1 } },
        { time: 1.44, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 0 } },
        { time: 1.45, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 0 } },
        { time: 1.45, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 1, scaleY: .82 } },
        { time: 1.71, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 1, scaleY: .82 } },
        { time: 1.71, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 0 } },
        { time: 1.72, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 0 } },
        { time: 1.72, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 1 } },
        { time: 2, targetType: "group", target: "shape", values: { y: 0, rotation: 0 } },
      ],
    }],
  },
  /*
    ── The question cast ────────────────────────────────────────────────────

    A question has four moments — read out, waited on, got wrong, got right —
    and a canvas asks for them by role (see `ACTOR_ROLES`). These are the
    characters that answer, and they are siblings on purpose: the same soft
    pentagon, the same white eyes, the same mouth set as Shape Talker, changing
    only palette, expression and how they move. A child has to read them as one
    character in four moods, not four mascots taking turns — so the shape stays
    and the face does the work.

    Saved styles win over these, which is the point of shipping them: an author
    who wants their own waiting Koda saves one called "Waiting Style" and it
    takes over everywhere, with no wiring. These exist so the cast works before
    anybody does that.
  */
  {
    id: "shape-waiting",
    name: "Shape Waiting",
    palette: { primary: "#6366F1", secondary: "#4F46E5", accent: "#C7D2FE", ink: "#1E1B4B", white: "#FFFFFF" },
    assetIds: ["body-soft-pentagon", "eyes-white-round", "pupil-round", "mouth-talk-rest"],
    layerOverrides: [
      { assetId: "body-soft-pentagon", patch: { name: "Soft Pentagon", outline: false, rotation: -7 } },
      // The eyes wander. A guide who is waiting has to look like they are
      // waiting for *something*, and a fixed stare reads as a frozen render.
      { assetId: "pupil-round", patch: { name: "Wandering Pupils", animation: "look", animationIntensity: 6, animationFeel: "smooth", duration: 4.6 } },
      { assetId: "mouth-talk-rest", patch: { name: "Resting Mouth" } },
    ],
    behavior: { animation: "float", duration: 3.6, intensity: 3, loop: true, spring: { stiffness: 180, damping: 24, mass: .8 } },
  },
  {
    id: "shape-oops",
    name: "Shape Oops",
    palette: { primary: "#FB7185", secondary: "#E11D48", accent: "#FECDD3", ink: "#4C0519", white: "#FFFFFF" },
    // Eyes down and a small round mouth: caught out, not told off. A wrong
    // answer is a thing to try again, so the character must not look angry.
    assetIds: ["body-soft-pentagon", "eyes-white-round", "pupil-curious", "mouth-talk-o"],
    layerOverrides: [
      { assetId: "body-soft-pentagon", patch: { name: "Soft Pentagon", outline: false, rotation: -7 } },
      { assetId: "pupil-curious", patch: { name: "Downcast Pupils", animation: "none", y: 132 } },
      { assetId: "mouth-talk-o", patch: { name: "Oh", opacity: 1 } },
    ],
    behavior: { animation: "wiggle", duration: 1.1, intensity: 3, loop: true, spring: { stiffness: 260, damping: 18, mass: .7 } },
  },
  {
    id: "shape-happy",
    name: "Shape Happy",
    palette: { primary: "#34D399", secondary: "#0D9488", accent: "#FDE68A", ink: "#064E3B", white: "#FFFFFF" },
    assetIds: ["body-soft-pentagon", "eyes-happy", "mouth-talk-wide"],
    layerOverrides: [
      { assetId: "body-soft-pentagon", patch: { name: "Soft Pentagon", outline: false, rotation: -7 } },
      { assetId: "eyes-happy", patch: { name: "Delighted Eyes", animation: "none" } },
      { assetId: "mouth-talk-wide", patch: { name: "Big Grin", opacity: 1 } },
    ],
    behavior: { animation: "bounce", duration: 1.1, intensity: 7, loop: true, spring: { stiffness: 300, damping: 16, mass: .6 } },
  },
  {
    id: "quiz-hero",
    name: "Quiz Hero",
    palette: { primary: "#5B5CEB", secondary: "#3435A8", accent: "#A3E635", ink: "#17164A", white: "#FFFFFF" },
    assetIds: ["body-sitting-cub", "pattern-patch", "accessory-baseball-cap", "accessory-wave-paw", "eyes-open-friendly", "eyes-wink", "mouth-talk-rest", "mouth-talk-wide"],
    layerOverrides: [
      { assetId: "body-sitting-cub", patch: { name: "Quiz Hero Body", outline: false } },
      { assetId: "pattern-patch", patch: { name: "Hero Badge", x: 128, y: 162, scale: .42, rotation: -5 } },
      { assetId: "accessory-baseball-cap", patch: { name: "Hero Cap", x: 128, y: 75, scale: .8, rotation: -7 } },
      { assetId: "accessory-wave-paw", patch: { name: "High-five Hand", x: 187, y: 150, scale: .5, rotation: -18 } },
      { assetId: "eyes-open-friendly", patch: { name: "Bright Eyes", opacity: 1, animation: "none" } },
      { assetId: "eyes-wink", patch: { name: "Victory Wink", opacity: 0, animation: "none" } },
      { assetId: "mouth-talk-rest", patch: { name: "Ready Smile", opacity: 1 } },
      { assetId: "mouth-talk-wide", patch: { name: "Victory Grin", opacity: 0 } },
    ],
    groups: [{
      id: "hero",
      name: "Quiz Hero",
      memberAssetIds: ["body-sitting-cub", "pattern-patch", "accessory-baseball-cap", "accessory-wave-paw", "eyes-open-friendly", "eyes-wink", "mouth-talk-rest", "mouth-talk-wide"],
      pivot: { x: 128, y: 218 },
    }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: false, spring: { stiffness: 300, damping: 17, mass: .65 } },
    clips: [{
      id: "answer-power-up", name: "Answer Power-up", duration: 2.35, loop: false,
      keyframes: [
        { time: 0, targetType: "group", target: "hero", values: { y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
        { time: 0, targetType: "layer", target: "eyes-open-friendly", values: { opacity: 1 } },
        { time: 0, targetType: "layer", target: "eyes-wink", values: { opacity: 0 } },
        { time: 0, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 1 } },
        { time: 0, targetType: "layer", target: "mouth-talk-wide", values: { opacity: 0 } },
        { time: 0, targetType: "layer", target: "accessory-wave-paw", values: { rotation: -18, y: 150 } },

        // Anticipation makes the launch feel physical rather than like a tween.
        { time: .24, targetType: "group", target: "hero", easing: "easeIn", values: { y: 5, rotation: -8, scaleX: 1.09, scaleY: .88 } },
        { time: .5, targetType: "group", target: "hero", easing: "easeOut", values: { y: -25, rotation: 48, scaleX: .94, scaleY: 1.08 } },
        { time: .76, targetType: "group", target: "hero", values: { y: -37, rotation: 198, scaleX: .98, scaleY: 1.03 } },
        { time: 1.02, targetType: "group", target: "hero", easing: "easeIn", values: { y: -17, rotation: 350, scaleX: 1, scaleY: 1 } },
        { time: 1.16, targetType: "group", target: "hero", easing: "easeOut", values: { y: 3, rotation: 360, scaleX: 1.12, scaleY: .84 } },
        { time: 1.38, targetType: "group", target: "hero", values: { y: -4, rotation: 356, scaleX: .97, scaleY: 1.05 } },
        { time: 1.58, targetType: "group", target: "hero", values: { y: 0, rotation: 360, scaleX: 1, scaleY: 1 } },

        // The landing resolves into a readable high-five, wink and grin.
        { time: 1.32, targetType: "layer", target: "eyes-open-friendly", values: { opacity: 1 } },
        { time: 1.34, targetType: "layer", target: "eyes-open-friendly", easing: "easeOut", values: { opacity: 0 } },
        { time: 1.34, targetType: "layer", target: "eyes-wink", easing: "easeOut", values: { opacity: 1 } },
        { time: 1.32, targetType: "layer", target: "mouth-talk-rest", values: { opacity: 1 } },
        { time: 1.34, targetType: "layer", target: "mouth-talk-rest", easing: "easeOut", values: { opacity: 0 } },
        { time: 1.34, targetType: "layer", target: "mouth-talk-wide", easing: "easeOut", values: { opacity: 1 } },
        { time: 1.38, targetType: "layer", target: "accessory-wave-paw", easing: "easeOut", values: { rotation: -54, y: 140 } },
        { time: 1.62, targetType: "layer", target: "accessory-wave-paw", values: { rotation: 18, y: 142 } },
        { time: 1.84, targetType: "layer", target: "accessory-wave-paw", values: { rotation: -42, y: 140 } },
        { time: 2.08, targetType: "layer", target: "accessory-wave-paw", values: { rotation: -20, y: 147 } },
        { time: 2.35, targetType: "group", target: "hero", values: { y: 0, rotation: 360, scaleX: 1, scaleY: 1 } },
        { time: 2.35, targetType: "layer", target: "accessory-wave-paw", values: { rotation: -20, y: 147 } },
      ],
    }],
  },
  {
    id: "pebble-pal",
    name: "Pebble Pal",
    palette: { primary: "#38BDF8", secondary: "#0284C7", accent: "#FBBF24", ink: "#0C4A6E", white: "#FFFFFF" },
    assetIds: ["body-wide-pebble", "eyes-closed-friendly", "mouth-talk-rest"],
    behavior: { animation: "float", duration: 3, intensity: 3, loop: true, spring: { stiffness: 180, damping: 24, mass: .8 } },
  },
  {
    id: "diamond-pal",
    name: "Diamond Pal",
    palette: { primary: "#A78BFA", secondary: "#7C3AED", accent: "#F9A8D4", ink: "#312E81", white: "#FFFFFF" },
    assetIds: ["body-rounded-diamond", "eyes-open-curious", "mouth-talk-small"],
    behavior: { animation: "wiggle", duration: 2.8, intensity: 2, loop: true, spring: { stiffness: 200, damping: 22, mass: .75 } },
  },
  {
    id: "triangle-pal",
    name: "Triangle Pal",
    palette: { primary: "#FB7185", secondary: "#E11D48", accent: "#FDE68A", ink: "#881337", white: "#FFFFFF" },
    assetIds: ["body-soft-triangle", "eyes-open-friendly", "mouth-talk-rest"],
    behavior: { animation: "bounce", duration: 2.2, intensity: 3, loop: true, spring: { stiffness: 230, damping: 20, mass: .7 } },
  },
  {
    id: "talking-bear",
    name: "Talking Bear",
    palette: { primary: "#A96F45", secondary: "#70452F", accent: "#E9A56F", ink: "#2F211B", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "mouth-bear-smile", "mouth-bear-open"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Bear Body", outline: true } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Short Muzzle", x: 128, y: 143, scale: .72 } },
      { assetId: "eyes-bear", patch: { name: "Bear Eyes", animation: "blink", duration: 4.6 } },
      { assetId: "mouth-bear-smile", patch: { name: "Mouth Closed", animation: "none", opacity: 1 } },
      { assetId: "mouth-bear-open", patch: { name: "Mouth Open", animation: "none", opacity: 0 } },
    ],
    groups: [{ id: "face", name: "Face", memberAssetIds: ["eyes-bear", "mouth-bear-smile", "mouth-bear-open"], pivot: { x: 128, y: 145 } }],
    behavior: { animation: "float", duration: 2.8, intensity: 3, loop: true, spring: { stiffness: 220, damping: 22, mass: .8 } },
    clips: [{
      id: "talking",
      name: "Talking",
      duration: 1.6,
      loop: true,
      keyframes: [
        { time: 0, targetType: "layer", target: "mouth-bear-smile", values: { opacity: 1, scale: .6, scaleX: 1, scaleY: 1 } },
        { time: 0, targetType: "layer", target: "mouth-bear-open", values: { opacity: 0, scale: .6, scaleX: .82, scaleY: .2 } },
        { time: 0, targetType: "group", target: "face", values: { y: 0, rotation: 0 } },
        { time: .14, targetType: "layer", target: "mouth-bear-smile", values: { opacity: 1, scaleY: 1 } },
        { time: .14, targetType: "layer", target: "mouth-bear-open", values: { opacity: 0, scaleX: .82, scaleY: .2 } },
        { time: .17, targetType: "layer", target: "mouth-bear-smile", easing: "easeOut", values: { opacity: 0, scaleY: .75 } },
        { time: .17, targetType: "layer", target: "mouth-bear-open", easing: "easeOut", values: { opacity: 1, scaleX: .88, scaleY: .55 } },
        { time: .25, targetType: "group", target: "face", values: { y: -1.2, rotation: -.35 } },
        { time: .29, targetType: "layer", target: "mouth-bear-open", easing: "easeOut", values: { opacity: 1, scaleX: 1, scaleY: 1.06 } },
        { time: .4, targetType: "layer", target: "mouth-bear-open", values: { opacity: 1, scaleX: .9, scaleY: .5 } },
        { time: .43, targetType: "layer", target: "mouth-bear-smile", easing: "easeOut", values: { opacity: 1, scaleY: 1 } },
        { time: .43, targetType: "layer", target: "mouth-bear-open", easing: "easeOut", values: { opacity: 0, scaleX: .82, scaleY: .2 } },
        { time: .48, targetType: "group", target: "face", values: { y: 0, rotation: .2 } },

        { time: .61, targetType: "layer", target: "mouth-bear-smile", values: { opacity: 1, scaleY: 1 } },
        { time: .61, targetType: "layer", target: "mouth-bear-open", values: { opacity: 0, scaleX: .82, scaleY: .2 } },
        { time: .64, targetType: "layer", target: "mouth-bear-smile", easing: "easeOut", values: { opacity: 0, scaleY: .78 } },
        { time: .64, targetType: "layer", target: "mouth-bear-open", easing: "easeOut", values: { opacity: 1, scaleX: 1.02, scaleY: .72 } },
        { time: .72, targetType: "group", target: "face", values: { y: -1.5, rotation: .3 } },
        { time: .78, targetType: "layer", target: "mouth-bear-open", values: { opacity: 1, scaleX: .92, scaleY: 1.12 } },
        { time: .9, targetType: "layer", target: "mouth-bear-smile", easing: "easeOut", values: { opacity: 1, scaleY: 1 } },
        { time: .9, targetType: "layer", target: "mouth-bear-open", easing: "easeOut", values: { opacity: 0, scaleX: .82, scaleY: .2 } },
        { time: .96, targetType: "group", target: "face", values: { y: 0, rotation: 0 } },

        { time: 1.08, targetType: "layer", target: "mouth-bear-smile", values: { opacity: 1, scaleY: 1 } },
        { time: 1.08, targetType: "layer", target: "mouth-bear-open", values: { opacity: 0, scaleX: .82, scaleY: .2 } },
        { time: 1.11, targetType: "layer", target: "mouth-bear-smile", easing: "easeOut", values: { opacity: 0, scaleY: .82 } },
        { time: 1.11, targetType: "layer", target: "mouth-bear-open", easing: "easeOut", values: { opacity: 1, scaleX: .9, scaleY: .48 } },
        { time: 1.2, targetType: "group", target: "face", values: { y: -.8, rotation: -.2 } },
        { time: 1.25, targetType: "layer", target: "mouth-bear-open", values: { opacity: 1, scaleX: .94, scaleY: .78 } },
        { time: 1.34, targetType: "layer", target: "mouth-bear-smile", easing: "easeOut", values: { opacity: 1, scaleY: 1 } },
        { time: 1.34, targetType: "layer", target: "mouth-bear-open", easing: "easeOut", values: { opacity: 0, scaleX: .82, scaleY: .2 } },
        { time: 1.42, targetType: "group", target: "face", values: { y: 0, rotation: 0 } },
        { time: 1.6, targetType: "layer", target: "mouth-bear-smile", values: { opacity: 1, scale: .6, scaleX: 1, scaleY: 1 } },
        { time: 1.6, targetType: "layer", target: "mouth-bear-open", values: { opacity: 0, scale: .6, scaleX: .82, scaleY: .2 } },
        { time: 1.6, targetType: "group", target: "face", values: { y: 0, rotation: 0 } },
      ],
    }],
  },
  {
    id: "teddy-bear",
    name: "Teddy Bear",
    palette: { primary: "#C98B5B", secondary: "#8B593B", accent: "#F3B886", ink: "#3A281F", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "mouth-bear-smile"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Plush Bear Body", outline: true } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Short Muzzle", x: 128, y: 143, scale: .72 } },
      { assetId: "eyes-bear", patch: { name: "Teddy Eyes", animation: "blink", duration: 4.2 } },
      { assetId: "mouth-bear-smile", patch: { name: "Teddy Smile" } },
    ],
    groups: [{ id: "teddy", name: "Teddy", memberAssetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "mouth-bear-smile"], pivot: { x: 128, y: 218 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 260, damping: 18, mass: .75 } },
    clips: [
      {
        id: "happy-jump", name: "Happy Jump", duration: 1.8, loop: true,
        keyframes: [
          { time: 0, targetType: "group", target: "teddy", values: { y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
          { time: .28, targetType: "group", target: "teddy", easing: "easeIn", values: { y: 3, scaleX: 1.07, scaleY: .92, rotation: -1 } },
          { time: .54, targetType: "group", target: "teddy", easing: "easeOut", values: { y: -21, scaleX: .96, scaleY: 1.06, rotation: 2 } },
          { time: .78, targetType: "group", target: "teddy", values: { y: -28, scaleX: .98, scaleY: 1.03, rotation: 0 } },
          { time: 1.04, targetType: "group", target: "teddy", easing: "easeIn", values: { y: -8, scaleX: 1, scaleY: 1, rotation: -1 } },
          { time: 1.16, targetType: "group", target: "teddy", easing: "easeOut", values: { y: 2, scaleX: 1.1, scaleY: .86, rotation: 0 } },
          { time: 1.38, targetType: "group", target: "teddy", values: { y: -2, scaleX: .98, scaleY: 1.03, rotation: .5 } },
          { time: 1.58, targetType: "group", target: "teddy", values: { y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
          { time: 1.8, targetType: "group", target: "teddy", values: { y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
        ],
      },
      {
        id: "cozy-idle", name: "Cozy Idle", duration: 3.2, loop: true,
        keyframes: [
          { time: 0, targetType: "group", target: "teddy", values: { y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
          { time: 1.6, targetType: "group", target: "teddy", values: { y: -2, scaleX: 1.015, scaleY: 1.025, rotation: .5 } },
          { time: 3.2, targetType: "group", target: "teddy", values: { y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
        ],
      },
    ],
  },
  {
    id: "panda",
    name: "Panda",
    palette: { primary: "#FFFDF7", secondary: "#2E2A2A", accent: "#E8E1D8", ink: "#242020", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-panda-patches", "accessory-panda-ears", "accessory-wave-paw", "eyes-bear", "mouth-bear-smile"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Panda Bear Body", outline: true } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Panda Muzzle", x: 128, y: 143, scale: .72 } },
      { assetId: "pattern-panda-patches", patch: { name: "Eye Patches", x: 128, y: 126, scale: .72 } },
      { assetId: "accessory-wave-paw", patch: { name: "Wave Paw", x: 188, y: 151, scale: .52, rotation: -16 } },
      { assetId: "eyes-bear", patch: { name: "Panda Eyes", animation: "blink", duration: 3.8 } },
    ],
    groups: [{ id: "panda", name: "Panda", memberAssetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-panda-patches", "accessory-panda-ears", "accessory-wave-paw", "eyes-bear", "mouth-bear-smile"], pivot: { x: 128, y: 210 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 220, damping: 20, mass: .8 } },
    clips: [{
      id: "welcome-wave", name: "Welcome Wave", duration: 2.2, loop: true,
      keyframes: [
        { time: 0, targetType: "group", target: "panda", values: { y: 0, rotation: 0 } },
        { time: 0, targetType: "layer", target: "accessory-wave-paw", values: { rotation: -16, y: 151 } },
        { time: .35, targetType: "group", target: "panda", values: { y: -2, rotation: -1.2 } },
        { time: .38, targetType: "layer", target: "accessory-wave-paw", easing: "easeOut", values: { rotation: -38, y: 145 } },
        { time: .68, targetType: "layer", target: "accessory-wave-paw", values: { rotation: 16, y: 143 } },
        { time: .98, targetType: "layer", target: "accessory-wave-paw", values: { rotation: -34, y: 145 } },
        { time: 1.28, targetType: "layer", target: "accessory-wave-paw", values: { rotation: 12, y: 144 } },
        { time: 1.58, targetType: "layer", target: "accessory-wave-paw", values: { rotation: -20, y: 149 } },
        { time: 1.7, targetType: "group", target: "panda", values: { y: 0, rotation: .4 } },
        { time: 2.2, targetType: "layer", target: "accessory-wave-paw", values: { rotation: -16, y: 151 } },
        { time: 2.2, targetType: "group", target: "panda", values: { y: 0, rotation: 0 } },
      ],
    }],
  },
  {
    id: "sleepy-bear",
    name: "Sleepy Bear",
    palette: { primary: "#A9A4D6", secondary: "#706AAB", accent: "#E8C6D7", ink: "#312F55", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear-closed", "mouth-bear-smile", "mouth-bear-open"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Sleepy Bear Body", outline: true } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Short Muzzle", x: 128, y: 143, scale: .72 } },
      { assetId: "eyes-bear-closed", patch: { name: "Sleepy Bear Eyes", animation: "none" } },
      { assetId: "mouth-bear-smile", patch: { name: "Sleepy Smile", opacity: 1 } },
      { assetId: "mouth-bear-open", patch: { name: "Yawn", opacity: 0, scaleX: .75, scaleY: .25 } },
    ],
    groups: [{ id: "sleepy", name: "Sleepy Bear", memberAssetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear-closed", "mouth-bear-smile", "mouth-bear-open"], pivot: { x: 128, y: 210 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 160, damping: 26, mass: 1 } },
    clips: [{
      id: "sleepy-yawn", name: "Sleepy Yawn", duration: 4.4, loop: true,
      keyframes: [
        { time: 0, targetType: "group", target: "sleepy", values: { y: 0, rotation: -1, scaleY: 1 } },
        { time: 1.1, targetType: "group", target: "sleepy", values: { y: 3, rotation: 2, scaleY: .985 } },
        { time: 1.5, targetType: "layer", target: "mouth-bear-smile", values: { opacity: 1 } },
        { time: 1.5, targetType: "layer", target: "mouth-bear-open", values: { opacity: 0, scaleX: .75, scaleY: .25 } },
        { time: 1.62, targetType: "layer", target: "mouth-bear-smile", values: { opacity: 0 } },
        { time: 1.62, targetType: "layer", target: "mouth-bear-open", values: { opacity: 1, scaleX: .82, scaleY: .5 } },
        { time: 2.15, targetType: "layer", target: "mouth-bear-open", easing: "easeOut", values: { opacity: 1, scaleX: 1.05, scaleY: 1.18 } },
        { time: 2.7, targetType: "layer", target: "mouth-bear-open", values: { opacity: 1, scaleX: .85, scaleY: .45 } },
        { time: 2.82, targetType: "layer", target: "mouth-bear-smile", values: { opacity: 1 } },
        { time: 2.82, targetType: "layer", target: "mouth-bear-open", values: { opacity: 0, scaleX: .75, scaleY: .25 } },
        { time: 3.2, targetType: "group", target: "sleepy", values: { y: 1, rotation: -2, scaleY: 1 } },
        { time: 4.4, targetType: "group", target: "sleepy", values: { y: 0, rotation: -1, scaleY: 1 } },
      ],
    }],
  },
  {
    id: "gummy-bear",
    name: "Gummy Bear",
    palette: { primary: "#F26AA5", secondary: "#D94286", accent: "#FFD2E6", ink: "#5C1740", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-jelly-shine", "accessory-gummy-ears", "eyes-bear", "mouth-bear-smile"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Jelly Bear Body", outline: true, opacity: .88 } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Gummy Muzzle", x: 128, y: 143, scale: .72, opacity: .72 } },
      { assetId: "eyes-bear", patch: { name: "Gummy Bear Eyes", animation: "blink", duration: 3.4 } },
      { assetId: "mouth-bear-smile", patch: { name: "Gummy Bear Smile" } },
    ],
    groups: [{ id: "gummy", name: "Gummy Bear", memberAssetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-jelly-shine", "accessory-gummy-ears", "eyes-bear", "mouth-bear-smile"], pivot: { x: 128, y: 214 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 180, damping: 14, mass: .65 } },
    clips: [{
      id: "jelly-wobble", name: "Jelly Wobble", duration: 1.65, loop: true,
      keyframes: [
        { time: 0, targetType: "group", target: "gummy", values: { y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
        { time: .26, targetType: "group", target: "gummy", easing: "easeOut", values: { y: 2, scaleX: 1.09, scaleY: .91, rotation: -1.5 } },
        { time: .52, targetType: "group", target: "gummy", values: { y: -5, scaleX: .93, scaleY: 1.08, rotation: 2 } },
        { time: .78, targetType: "group", target: "gummy", values: { y: 0, scaleX: 1.05, scaleY: .96, rotation: -1.4 } },
        { time: 1.04, targetType: "group", target: "gummy", values: { y: -2, scaleX: .97, scaleY: 1.04, rotation: .8 } },
        { time: 1.3, targetType: "group", target: "gummy", values: { y: 0, scaleX: 1.015, scaleY: .99, rotation: -.3 } },
        { time: 1.65, targetType: "group", target: "gummy", values: { y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
      ],
    }],
  },
  {
    id: "blinking-bear",
    name: "Blinking Bear",
    palette: { primary: "#E1A66F", secondary: "#9A6544", accent: "#F5C9A2", ink: "#3D2A21", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "eyes-bear-closed", "mouth-bear-smile"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Blink Bear Body", outline: true } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Short Muzzle", x: 128, y: 143, scale: .72 } },
      { assetId: "eyes-bear", patch: { name: "Bear Eyes Open", animation: "none", opacity: 1, scaleY: 1 } },
      { assetId: "eyes-bear-closed", patch: { name: "Bear Eyes Closed", animation: "none", opacity: 0, scaleY: .75 } },
    ],
    groups: [{ id: "bear", name: "Blinking Bear", memberAssetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "eyes-bear-closed", "mouth-bear-smile"], pivot: { x: 128, y: 210 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 210, damping: 22, mass: .8 } },
    clips: [{
      id: "soft-double-blink", name: "Soft Double Blink", duration: 4.2, loop: true,
      keyframes: [
        { time: 0, targetType: "group", target: "bear", values: { y: 0, rotation: 0 } },
        ...eyeSwapBeat("eyes-bear", "eyes-bear-closed", 1.05, .08),
        ...eyeSwapBeat("eyes-bear", "eyes-bear-closed", 1.42, .06),
        { time: 2.7, targetType: "group", target: "bear", values: { y: -1.5, rotation: .5 } },
        ...eyeSwapBeat("eyes-bear", "eyes-bear-closed", 3.15, .11),
        { time: 4.2, targetType: "group", target: "bear", values: { y: 0, rotation: 0 } },
      ],
    }],
  },
  {
    id: "winking-bear",
    name: "Winking Bear",
    palette: { primary: "#E8B65B", secondary: "#A66C2E", accent: "#F58A9D", ink: "#3C2919", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "eyes-bear-wink", "mouth-bear-smile"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Wink Bear Body", outline: true } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Short Muzzle", x: 128, y: 143, scale: .72 } },
      { assetId: "eyes-bear", patch: { name: "Both Bear Eyes Open", animation: "none", opacity: 1 } },
      { assetId: "eyes-bear-wink", patch: { name: "Bear Wink Pose", animation: "none", opacity: 0 } },
    ],
    groups: [{ id: "bear", name: "Winking Bear", memberAssetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "eyes-bear-wink", "mouth-bear-smile"], pivot: { x: 128, y: 210 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 230, damping: 20, mass: .75 } },
    clips: [{
      id: "friendly-wink", name: "Friendly Wink", duration: 3.4, loop: true,
      keyframes: [
        { time: 0, targetType: "group", target: "bear", values: { y: 0, rotation: 0 } },
        { time: .82, targetType: "group", target: "bear", values: { y: -1, rotation: -2.5 } },
        ...eyeSwapBeat("eyes-bear", "eyes-bear-wink", .92, .46),
        { time: 1.7, targetType: "group", target: "bear", values: { y: 0, rotation: 1 } },
        { time: 2.25, targetType: "group", target: "bear", values: { y: -1, rotation: -1 } },
        ...eyeSwapBeat("eyes-bear", "eyes-bear-wink", 2.35, .16),
        { time: 3.4, targetType: "group", target: "bear", values: { y: 0, rotation: 0 } },
      ],
    }],
  },
  {
    id: "sleepy-blink-bear",
    name: "Sleepy Blink Bear",
    palette: { primary: "#95A6D8", secondary: "#596AAB", accent: "#D8DDF5", ink: "#292F59", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "eyes-bear-closed", "mouth-bear-smile"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Drowsy Bear Body", outline: true } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Short Muzzle", x: 128, y: 143, scale: .72 } },
      { assetId: "eyes-bear", patch: { name: "Drowsy Bear Eyes Open", animation: "none", opacity: 1, scaleY: .82 } },
      { assetId: "eyes-bear-closed", patch: { name: "Drowsy Bear Eyes Closed", animation: "none", opacity: 0 } },
    ],
    groups: [{ id: "bear", name: "Sleepy Blink Bear", memberAssetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear", "eyes-bear-closed", "mouth-bear-smile"], pivot: { x: 128, y: 210 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 150, damping: 28, mass: 1 } },
    clips: [{
      id: "slow-eye-close", name: "Slow Eye Close", duration: 5.2, loop: true,
      keyframes: [
        { time: 0, targetType: "group", target: "bear", values: { y: 0, rotation: -1 } },
        { time: .7, targetType: "layer", target: "eyes-bear", values: { opacity: 1, scaleY: .82 } },
        { time: .7, targetType: "layer", target: "eyes-bear-closed", values: { opacity: 0 } },
        { time: 1.45, targetType: "layer", target: "eyes-bear", values: { opacity: 0, scaleY: .18 } },
        { time: 1.45, targetType: "layer", target: "eyes-bear-closed", values: { opacity: 1 } },
        { time: 2.65, targetType: "group", target: "bear", values: { y: 3, rotation: 2 } },
        { time: 3.25, targetType: "layer", target: "eyes-bear", easing: "easeOut", values: { opacity: 1, scaleY: .82 } },
        { time: 3.25, targetType: "layer", target: "eyes-bear-closed", easing: "easeOut", values: { opacity: 0 } },
        { time: 4.15, targetType: "group", target: "bear", values: { y: 1, rotation: -2 } },
        { time: 5.2, targetType: "group", target: "bear", values: { y: 0, rotation: -1 } },
      ],
    }],
  },
  {
    id: "dizzy-bear",
    name: "Dizzy Bear",
    palette: { primary: "#71C7B8", secondary: "#328E82", accent: "#FFD36A", ink: "#173F3B", white: "#FFFFFF" },
    assetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear-dizzy", "mouth-bear-open"],
    layerOverrides: [
      { assetId: "body-bear-cub", patch: { name: "Dizzy Bear Body", outline: true } },
      { assetId: "pattern-bear-muzzle", patch: { name: "Short Muzzle", x: 128, y: 143, scale: .72 } },
      { assetId: "eyes-bear-dizzy", patch: { name: "Rotating Bear Eyes", animation: "none", rotation: 0 } },
      { assetId: "mouth-bear-open", patch: { name: "Dizzy Bear Mouth", scale: .58 } },
    ],
    groups: [{ id: "bear", name: "Dizzy Bear", memberAssetIds: ["body-bear-cub", "pattern-bear-muzzle", "pattern-belly-patch", "accessory-teddy-ears", "eyes-bear-dizzy", "mouth-bear-open"], pivot: { x: 128, y: 210 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 170, damping: 18, mass: .8 } },
    clips: [{
      id: "eye-roll", name: "Eye Roll", duration: 2.8, loop: true,
      keyframes: [
        { time: 0, targetType: "layer", target: "eyes-bear-dizzy", values: { rotation: 0, scale: .72 } },
        { time: .7, targetType: "layer", target: "eyes-bear-dizzy", values: { rotation: 90, scale: .74 } },
        { time: 1.4, targetType: "layer", target: "eyes-bear-dizzy", values: { rotation: 180, scale: .72 } },
        { time: 2.1, targetType: "layer", target: "eyes-bear-dizzy", values: { rotation: 270, scale: .74 } },
        { time: 2.8, targetType: "layer", target: "eyes-bear-dizzy", values: { rotation: 360, scale: .72 } },
        { time: 0, targetType: "group", target: "bear", values: { rotation: -1.5, y: 0 } },
        { time: .7, targetType: "group", target: "bear", values: { rotation: 1.5, y: -1 } },
        { time: 1.4, targetType: "group", target: "bear", values: { rotation: -1.5, y: 0 } },
        { time: 2.1, targetType: "group", target: "bear", values: { rotation: 1.5, y: -1 } },
        { time: 2.8, targetType: "group", target: "bear", values: { rotation: -1.5, y: 0 } },
      ],
    }],
  },
  {
    id: "story-reader",
    name: "Story Reader",
    palette: { primary: "#39BFA9", secondary: "#17897D", accent: "#F59AB8", ink: "#164E4A", white: "#FFFFFF" },
    assetIds: ["body-tall-story", "accessory-story-ears", "accessory-open-book", "eyes-open-friendly", "mouth-talk-rest"],
    layerOverrides: [
      { assetId: "body-tall-story", patch: { name: "Tall Story Body", outline: false } },
      { assetId: "accessory-story-ears", patch: { name: "Little Round Ears", x: 128, y: 76, scale: .7 } },
      { assetId: "accessory-open-book", patch: { name: "Open Book", x: 128, y: 179, scale: .6, rotation: 2 } },
      { assetId: "eyes-open-friendly", patch: { name: "Reader Eyes", x: 128, y: 119, scale: .55, animation: "blink", duration: 4.8 } },
      { assetId: "mouth-talk-rest", patch: { name: "Reader Smile", x: 128, y: 150, scale: .45 } },
    ],
    groups: [{ id: "reader", name: "Story Reader", memberAssetIds: ["body-tall-story", "accessory-story-ears", "accessory-open-book", "eyes-open-friendly", "mouth-talk-rest"], pivot: { x: 128, y: 218 } }],
    behavior: { animation: "none", duration: 2, intensity: 0, loop: true, spring: { stiffness: 170, damping: 25, mass: .9 } },
    clips: [{ id: "reading-sway", name: "Reading Sway", duration: 3.6, loop: true, keyframes: [
      { time: 0, targetType: "group", target: "reader", values: { y: 0, rotation: -1 } },
      { time: 1.8, targetType: "group", target: "reader", values: { y: -2, rotation: 1 } },
      { time: 0, targetType: "layer", target: "accessory-open-book", values: { y: 179, rotation: 2 } },
      { time: 1.8, targetType: "layer", target: "accessory-open-book", values: { y: 176, rotation: -1 } },
      { time: 3.6, targetType: "layer", target: "accessory-open-book", values: { y: 179, rotation: 2 } },
      { time: 3.6, targetType: "group", target: "reader", values: { y: 0, rotation: -1 } },
    ] }],
  },
  {
    id: "woodland-scout",
    name: "Woodland Scout",
    palette: { primary: "#F15F9A", secondary: "#B8326B", accent: "#83D3D7", ink: "#62143A", white: "#FFFFFF" },
    assetIds: ["body-little-story", "pattern-raccoon-mask", "accessory-story-ears", "accessory-striped-tail", "eyes-open-curious", "mouth-talk-rest"],
    layerOverrides: [
      { assetId: "body-little-story", patch: { name: "Little Scout Body", outline: false } },
      { assetId: "pattern-raccoon-mask", patch: { name: "Soft Eye Mask", x: 128, y: 125, scale: .66 } },
      { assetId: "accessory-story-ears", patch: { name: "Scout Ears", x: 128, y: 80, scale: .68 } },
      { assetId: "accessory-striped-tail", patch: { name: "Striped Tail", x: 77, y: 170, scale: .72, rotation: -10 } },
      { assetId: "eyes-open-curious", patch: { name: "Curious Eyes", x: 128, y: 125, scale: .48, animation: "blink", duration: 3.9 } },
      { assetId: "mouth-talk-rest", patch: { name: "Scout Smile", x: 128, y: 153, scale: .4 } },
    ],
    groups: [{ id: "scout", name: "Woodland Scout", memberAssetIds: ["body-little-story", "pattern-raccoon-mask", "accessory-story-ears", "accessory-striped-tail", "eyes-open-curious", "mouth-talk-rest"], pivot: { x: 128, y: 210 } }],
    clips: [{ id: "tail-wave", name: "Tail Wave", duration: 2.1, loop: true, keyframes: [
      { time: 0, targetType: "layer", target: "accessory-striped-tail", values: { rotation: -14, y: 170 } },
      { time: .7, targetType: "layer", target: "accessory-striped-tail", values: { rotation: 10, y: 166 } },
      { time: 1.4, targetType: "layer", target: "accessory-striped-tail", values: { rotation: -6, y: 168 } },
      { time: 2.1, targetType: "layer", target: "accessory-striped-tail", values: { rotation: -14, y: 170 } },
    ] }],
  },
  {
    id: "gentle-elephant",
    name: "Gentle Elephant",
    palette: { primary: "#87CED6", secondary: "#4297A3", accent: "#F2639B", ink: "#164E63", white: "#FFFFFF" },
    assetIds: ["body-gentle-giant", "accessory-elephant-ears", "accessory-elephant-trunk", "eyes-open-friendly"],
    layerOverrides: [
      { assetId: "body-gentle-giant", patch: { name: "Gentle Giant Body", outline: false } },
      { assetId: "accessory-elephant-ears", patch: { name: "Soft Elephant Ears", x: 128, y: 126, scale: 1.08 } },
      { assetId: "accessory-elephant-trunk", patch: { name: "Friendly Trunk", x: 137, y: 151, scale: .72, rotation: -4 } },
      { assetId: "eyes-open-friendly", patch: { name: "Gentle Eyes", x: 116, y: 119, scale: .43, animation: "blink", duration: 4.5 } },
    ],
    groups: [{ id: "elephant", name: "Gentle Elephant", memberAssetIds: ["body-gentle-giant", "accessory-elephant-ears", "accessory-elephant-trunk", "eyes-open-friendly"], pivot: { x: 128, y: 212 } }],
    clips: [{ id: "trunk-wave", name: "Trunk Wave", duration: 2.4, loop: true, keyframes: [
      { time: 0, targetType: "layer", target: "accessory-elephant-trunk", values: { rotation: -6, y: 151 } },
      { time: .8, targetType: "layer", target: "accessory-elephant-trunk", values: { rotation: 8, y: 147 } },
      { time: 1.6, targetType: "layer", target: "accessory-elephant-trunk", values: { rotation: -2, y: 149 } },
      { time: 2.4, targetType: "layer", target: "accessory-elephant-trunk", values: { rotation: -6, y: 151 } },
    ] }],
  },
  {
    id: "sunny-fox",
    name: "Sunny Fox",
    palette: { primary: "#F8C62D", secondary: "#D98B14", accent: "#F06292", ink: "#513314", white: "#FFFFFF" },
    assetIds: ["body-fox-friend", "accessory-fox-ears", "accessory-fox-tail", "eyes-closed-friendly", "mouth-talk-rest"],
    layerOverrides: [
      { assetId: "body-fox-friend", patch: { name: "Sunny Fox Body", outline: false } },
      { assetId: "accessory-fox-ears", patch: { name: "Pointed Fox Ears", x: 128, y: 76, scale: .82 } },
      { assetId: "accessory-fox-tail", patch: { name: "Fluffy Fox Tail", x: 79, y: 173, scale: .74, rotation: -12 } },
      { assetId: "eyes-closed-friendly", patch: { name: "Happy Fox Eyes", x: 128, y: 124, scale: .56, animation: "none" } },
      { assetId: "mouth-talk-rest", patch: { name: "Fox Smile", x: 128, y: 154, scale: .42 } },
    ],
    groups: [{ id: "fox", name: "Sunny Fox", memberAssetIds: ["body-fox-friend", "accessory-fox-ears", "accessory-fox-tail", "eyes-closed-friendly", "mouth-talk-rest"], pivot: { x: 128, y: 215 } }],
    clips: [{ id: "happy-hop", name: "Happy Hop", duration: 1.8, loop: true, keyframes: [
      { time: 0, targetType: "group", target: "fox", values: { y: 0, rotation: -1, scaleX: 1, scaleY: 1 } },
      { time: .35, targetType: "group", target: "fox", values: { y: 3, rotation: 1, scaleX: 1.06, scaleY: .94 } },
      { time: .7, targetType: "group", target: "fox", values: { y: -15, rotation: -2, scaleX: .97, scaleY: 1.04 } },
      { time: 1.15, targetType: "group", target: "fox", values: { y: 1, rotation: 1, scaleX: 1.05, scaleY: .95 } },
      { time: 1.8, targetType: "group", target: "fox", values: { y: 0, rotation: -1, scaleX: 1, scaleY: 1 } },
    ] }],
  },
  {
    id: "tiny-bird",
    name: "Tiny Bird",
    palette: { primary: "#34B7C8", secondary: "#168398", accent: "#F59E42", ink: "#124457", white: "#FFFFFF" },
    assetIds: ["body-tiny-bird", "accessory-bird-wing", "accessory-bird-beak", "eyes-open-friendly"],
    layerOverrides: [
      { assetId: "body-tiny-bird", patch: { name: "Tiny Bird Body", x: 128, y: 158, scale: .78, outline: false } },
      { assetId: "accessory-bird-wing", patch: { name: "Flutter Wing", x: 116, y: 158, scale: .55, rotation: -8 } },
      { assetId: "accessory-bird-beak", patch: { name: "Little Beak", x: 166, y: 145, scale: .32 } },
      { assetId: "eyes-open-friendly", patch: { name: "Bird Eyes", x: 127, y: 139, scale: .34, animation: "blink", duration: 3.5 } },
    ],
    groups: [{ id: "bird", name: "Tiny Bird", memberAssetIds: ["body-tiny-bird", "accessory-bird-wing", "accessory-bird-beak", "eyes-open-friendly"], pivot: { x: 128, y: 185 } }],
    clips: [{ id: "wing-flutter", name: "Wing Flutter", duration: 1.25, loop: true, keyframes: [
      { time: 0, targetType: "group", target: "bird", values: { y: 0, rotation: -1 } },
      { time: 0, targetType: "layer", target: "accessory-bird-wing", values: { rotation: -10, scaleY: 1 } },
      { time: .3, targetType: "layer", target: "accessory-bird-wing", values: { rotation: 18, scaleY: .72 } },
      { time: .6, targetType: "group", target: "bird", values: { y: -5, rotation: 2 } },
      { time: .62, targetType: "layer", target: "accessory-bird-wing", values: { rotation: -14, scaleY: 1.08 } },
      { time: .92, targetType: "layer", target: "accessory-bird-wing", values: { rotation: 12, scaleY: .78 } },
      { time: 1.25, targetType: "layer", target: "accessory-bird-wing", values: { rotation: -10, scaleY: 1 } },
      { time: 1.25, targetType: "group", target: "bird", values: { y: 0, rotation: -1 } },
    ] }],
  },
  {
    id: "thumb-calm",
    name: "Calm Arch",
    palette: { primary: "#63C8DE", secondary: "#43AFC8", accent: "#EF9F27", ink: "#101828", white: "#FFFFFF" },
    assetIds: ["body-tall-arch", "eyes-variant-02", "mouth-variant-03"],
  },
  {
    id: "thumb-friendly",
    name: "Friendly Arch",
    palette: { primary: "#12698E", secondary: "#0E5879", accent: "#EF9F27", ink: "#FFFFFF", white: "#FFFFFF" },
    assetIds: ["body-tall-arch", "eyes-variant-08", "mouth-variant-04"],
  },
  {
    id: "thumb-focus",
    name: "Focused Arch",
    palette: { primary: "#FF8650", secondary: "#F06D39", accent: "#EF9F27", ink: "#101828", white: "#FFFFFF" },
    assetIds: ["body-tall-arch", "eyes-variant-03", "mouth-variant-05"],
  },
  {
    id: "thumb-happy",
    name: "Happy Arch",
    palette: { primary: "#1B80A7", secondary: "#12698E", accent: "#EF9F27", ink: "#FFFFFF", white: "#FFFFFF" },
    assetIds: ["body-tall-arch", "head-default"],
  },
];
