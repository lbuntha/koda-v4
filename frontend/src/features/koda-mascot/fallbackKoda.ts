import { DEFAULT_PALETTE, MASCOT_ASSETS } from "./catalog";
import type { MascotAnimation, MascotDocument, MascotLayer } from "./types";
import type { KodaMascotState } from "./stateMachine";

const CREATED_AT = "2026-01-01T00:00:00.000Z";
const PLACEMENT = {
  body: { x: 128, y: 143, scale: 1.25 },
  head: { x: 128, y: 137, scale: 0.72 },
  pattern: { x: 128, y: 151, scale: 0.82 },
  accessory: { x: 128, y: 72, scale: 0.82 },
  eyes: { x: 128, y: 126, scale: 0.72 },
  mouth: { x: 128, y: 164, scale: 0.6 },
} as const;

interface LayerChoice {
  assetId: string;
  animation?: MascotAnimation;
  duration?: number;
  delay?: number;
}

const makeLayer = (choice: LayerChoice, index: number): MascotLayer => {
  const asset = MASCOT_ASSETS.find((candidate) => candidate.id === choice.assetId);
  if (!asset) throw new Error(`Unknown built-in Koda asset: ${choice.assetId}`);
  return {
    id: `builtin-${choice.assetId}-${index}`,
    assetId: asset.id,
    category: asset.category,
    name: asset.name,
    ...PLACEMENT[asset.category],
    rotation: 0,
    opacity: 1,
    visible: true,
    animation: choice.animation ?? (asset.category === "eyes" ? "blink" : "none"),
    duration: choice.duration ?? (asset.category === "eyes" ? 4 : 1.5),
    delay: choice.delay ?? 0,
  };
};

const documentFor = (state: KodaMascotState, choices: LayerChoice[]): MascotDocument => ({
  schemaVersion: 1,
  id: `builtin-koda-${state}`,
  name: `Koda ${state}`,
  slug: `koda-${state}`,
  purpose: state === "idle" || state === "talking" || state === "listening" || state === "thinking" || state === "hint" || state === "oops" || state === "goodbye" ? "custom" : state,
  description: `Built-in lightweight fallback for Koda's ${state} state.`,
  tags: ["builtin", state],
  canvas: { width: 256, height: 256, viewBox: "0 0 256 256" },
  palette: { ...DEFAULT_PALETTE },
  layers: choices.map(makeLayer),
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
});

const classic = (eyes: string, mouth: string, accessory = "accessory-antenna", extras: LayerChoice[] = []): LayerChoice[] => [
  { assetId: "body-boulder" },
  ...extras,
  { assetId: accessory },
  { assetId: eyes },
  { assetId: mouth },
];

export const BUILTIN_KODA_DOCUMENTS: Record<KodaMascotState, MascotDocument> = {
  idle: documentFor("idle", classic("eyes-even", "mouth-smile")),
  welcome: documentFor("welcome", classic("eyes-happy", "mouth-laugh", "accessory-antenna", [{ assetId: "pattern-freckles", animation: "pulse", duration: 1.2 }])),
  talking: documentFor("talking", classic("eyes-even", "mouth-open", "accessory-antenna", [{ assetId: "pattern-freckles", animation: "pulse", duration: 0.7 }])),
  listening: documentFor("listening", classic("eyes-inward", "mouth-smile")),
  waiting: documentFor("waiting", classic("eyes-side", "mouth-line", "accessory-antenna", [{ assetId: "pattern-buttons", animation: "pulse", duration: 1.8 }])),
  thinking: documentFor("thinking", classic("eyes-up", "mouth-smirk", "accessory-curl")),
  hint: documentFor("hint", classic("eyes-wink", "mouth-smile", "accessory-peak")),
  happy: documentFor("happy", classic("eyes-happy", "mouth-smile-big", "accessory-antenna", [{ assetId: "pattern-freckles", animation: "bounce", duration: 0.8 }])),
  excited: documentFor("excited", classic("eyes-googly", "mouth-laugh", "accessory-spikes", [{ assetId: "pattern-pellets", animation: "bounce", duration: 0.55 }])),
  oops: documentFor("oops", classic("eyes-down", "mouth-o", "accessory-nub")),
  sad: documentFor("sad", classic("eyes-down", "mouth-frown", "accessory-ears")),
  loading: documentFor("loading", classic("eyes-dots", "mouth-line", "accessory-swirl", [{ assetId: "pattern-spiral", animation: "spin", duration: 1.4 }])),
  goodbye: documentFor("goodbye", classic("eyes-wink", "mouth-smile-big", "accessory-antenna")),
};

export const getBuiltinKodaDocument = (state: KodaMascotState): MascotDocument => BUILTIN_KODA_DOCUMENTS[state];
