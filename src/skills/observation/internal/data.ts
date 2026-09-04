import type { ObservationObject } from "./types";

const PACKS = {
  beach: ["shell", "sunglasses", "crab", "bucket", "sunscreen", "sun hat", "beach ball", "sandal", "camera", "kite"],
  park: ["leaf", "daisy", "butterfly", "robin", "acorn", "watering can", "picnic basket", "bench", "ladybug", "umbrella"],
  home: ["sock", "teddy bear", "pencil", "building block", "toy car", "key", "toy star", "hairbrush", "alarm clock", "slipper"],
  market: ["apple", "banana", "carrot", "bread loaf", "teacup", "spoon", "shopping bag", "cheese wedge", "jam jar", "rolling pin"],
  farm: ["rooster", "sheep", "piglet", "horseshoe", "tractor", "milk pail", "corn cob", "straw bale", "windmill", "rubber boot"],
  forest: ["pinecone", "mushroom", "owl", "lantern", "tent", "compass", "backpack", "camp mug", "binoculars", "marshmallow"],
  school: ["notebook", "ruler", "scissors", "paintbrush", "glue bottle", "globe", "calculator", "crayon", "lunchbox", "paper plane"],
  harbor: ["clownfish", "seahorse", "octopus", "starfish", "pearl", "anchor", "treasure chest", "snorkel", "coral branch", "submarine"],
  museum: ["rocket", "planet", "astronaut helmet", "satellite", "telescope", "robot", "moon boot", "comet", "control panel", "wrench"],
  town: ["bicycle", "balloon", "ticket", "cupcake", "drum", "crown", "gift box", "traffic cone", "toy train", "pinwheel"],
} as const;

const slug = (value: string) => value.replace(/\s+/g, "-");

/** Frozen curriculum inventory. Phase 0 fixes these IDs before progress exists. */
export const OBJECT_CATALOG: ObservationObject[] = Object.entries(PACKS).flatMap(
  ([theme, names]) => names.map((name, index) => ({
    id: `${theme}-${slug(name)}`,
    name,
    aliases: [],
    theme,
    tags: [theme, index < 5 ? "natural-or-common" : "made-object"],
    silhouetteFamily: `${theme}-${index}`,
    dominantColorRole: ["amber", "cyan", "rose", "emerald", "violet"][index % 5],
    orientationSafe: !["sunscreen", "kite", "robin", "watering can", "alarm clock", "windmill"].includes(name),
    minimumVisibleFraction: index < 3 ? 0.7 : 0.6,
  })),
);

export const OBJECT_BY_ID = new Map(OBJECT_CATALOG.map((object) => [object.id, object]));

export const BEACH_OBJECT_IDS = PACKS.beach.map((name) => `beach-${slug(name)}`);
