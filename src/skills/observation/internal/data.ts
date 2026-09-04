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
  // Pack 11 (Castle Kingdom) arrived with swarm mode. Its frog is the first
  // catalog object authored to be hidden many times in one scene.
  castle: ["frog", "royal crown", "castle key", "shield", "goblet", "scroll", "torch", "banner", "dragon", "chess knight"],
  // Pack 12: shapes with strong outlines that stay readable when they overlap.
  workshop: ["gear", "spring", "magnet", "screwdriver", "bolt", "oil can", "blueprint", "magnifier", "drive belt", "wind-up key"],
  // Pack 13: creatures and growths that plausibly wear the reef's own texture.
  reef: ["sea urchin", "kelp frond", "hermit crab", "angelfish", "sand dollar", "sea turtle", "jellyfish", "cowrie shell", "sea fan", "moray eel"],
} as const;

/**
 * What each object *is*, for the level that asks by category instead of by
 * picture. This is the first real semantic data the catalog carries: every
 * other level matches artwork, so nothing until now needed to know that a
 * banana and a cupcake are both food.
 */
const CATEGORY_MEMBERS: Record<string, string[]> = {
  food: ["apple", "banana", "carrot", "bread loaf", "cheese wedge", "jam jar", "cupcake", "corn cob", "marshmallow", "goblet"],
  animal: ["crab", "butterfly", "robin", "ladybug", "rooster", "sheep", "piglet", "owl", "clownfish", "seahorse",
           "octopus", "starfish", "frog", "dragon", "hermit crab", "angelfish", "sea turtle", "jellyfish", "moray eel", "sea urchin"],
  tool: ["watering can", "hairbrush", "spoon", "rolling pin", "scissors", "paintbrush", "wrench", "screwdriver",
         "magnet", "gear", "bolt", "spring", "drive belt", "wind-up key", "magnifier", "castle key", "key"],
  clothing: ["sun hat", "sandal", "sunglasses", "sock", "slipper", "rubber boot", "moon boot", "astronaut helmet", "snorkel", "crown"],
  toy: ["beach ball", "teddy bear", "building block", "toy car", "toy star", "kite", "paper plane", "toy train", "pinwheel", "drum", "chess knight", "balloon"],
  container: ["bucket", "picnic basket", "teacup", "shopping bag", "milk pail", "backpack", "camp mug", "lunchbox",
              "glue bottle", "treasure chest", "gift box", "oil can", "sunscreen"],
  nature: ["shell", "leaf", "daisy", "acorn", "pinecone", "mushroom", "coral branch", "pearl", "straw bale",
           "kelp frond", "sand dollar", "cowrie shell", "sea fan", "planet", "comet"],
};

const CATEGORY_OF: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MEMBERS).flatMap(([category, names]) => names.map((name) => [name, category])),
);

/**
 * Objects whose mirror image is visibly different.
 *
 * Flipping a frog, a crown, or a shield changes nothing a child could see, so
 * a mirror round built from symmetric art would be unanswerable. Only these
 * carry a left and a right.
 */
const MIRROR_SAFE = new Set([
  "banana", "spoon", "teacup", "cheese wedge", "carrot", "jam jar",
  "pencil", "crayon", "paintbrush", "scissors", "glue bottle", "paper plane",
  "key", "castle key", "hairbrush", "slipper", "sock", "sandal", "rubber boot", "moon boot",
  "watering can", "picnic basket", "shopping bag", "oil can", "magnifier", "screwdriver",
  "rooster", "piglet", "sheep", "robin", "owl", "tractor", "toy car", "toy train",
  "clownfish", "seahorse", "snorkel", "submarine", "angelfish", "moray eel", "hermit crab", "sea turtle",
  "banner", "dragon", "chess knight", "comet", "telescope", "wrench", "kelp frond", "sea fan",
]);

/** Child-facing wording for a category round's prompt. */
export const CATEGORY_LABELS: Record<string, string> = {
  food: "things you can eat",
  animal: "animals",
  tool: "tools",
  clothing: "things you can wear",
  toy: "toys",
  container: "things that hold something",
  nature: "things that grow or wash up",
};

const slug = (value: string) => value.replace(/\s+/g, "-");
const DECOY_GROUPS: Record<string, string> = {
  "beach-shell": "beach-rounded", "beach-beach-ball": "beach-rounded", "beach-sunglasses": "beach-wear", "beach-sun-hat": "beach-wear",
  "beach-crab": "beach-wide", "beach-camera": "beach-wide", "beach-bucket": "beach-container", "beach-sunscreen": "beach-container", "beach-sandal": "beach-long", "beach-kite": "beach-long",
  "park-leaf": "park-nature", "park-daisy": "park-nature", "park-butterfly": "park-small-animal", "park-ladybug": "park-small-animal", "park-robin": "park-organic", "park-acorn": "park-organic",
  "park-watering-can": "park-container", "park-picnic-basket": "park-container", "park-bench": "park-structure", "park-umbrella": "park-structure",
  "home-sock": "home-footwear", "home-slipper": "home-footwear", "home-pencil": "home-long-tool", "home-hairbrush": "home-long-tool", "home-teddy-bear": "home-toy", "home-toy-car": "home-toy",
  "home-building-block": "home-shape", "home-toy-star": "home-shape", "home-key": "home-small-tool", "home-alarm-clock": "home-small-tool",
  "market-apple": "market-produce", "market-banana": "market-produce", "market-carrot": "market-produce", "market-bread-loaf": "market-food", "market-cheese-wedge": "market-food",
  "market-teacup": "market-container", "market-jam-jar": "market-container", "market-shopping-bag": "market-container", "market-spoon": "market-long-tool", "market-rolling-pin": "market-long-tool",
  "farm-rooster": "farm-animal", "farm-sheep": "farm-animal", "farm-piglet": "farm-animal", "farm-horseshoe": "farm-metal", "farm-milk-pail": "farm-metal",
  "farm-tractor": "farm-large", "farm-windmill": "farm-large", "farm-corn-cob": "farm-harvest", "farm-straw-bale": "farm-harvest", "farm-rubber-boot": "farm-wear",
  "forest-pinecone": "forest-natural", "forest-mushroom": "forest-natural", "forest-owl": "forest-animal", "forest-binoculars": "forest-viewing", "forest-compass": "forest-navigation",
  "forest-lantern": "forest-camp-gear", "forest-tent": "forest-camp-gear", "forest-backpack": "forest-container", "forest-camp-mug": "forest-container", "forest-marshmallow": "forest-food",
  "school-notebook": "school-paper", "school-paper-plane": "school-paper", "school-ruler": "school-long-tool", "school-paintbrush": "school-long-tool", "school-scissors": "school-hand-tool",
  "school-glue-bottle": "school-container", "school-lunchbox": "school-container", "school-globe": "school-round", "school-calculator": "school-device", "school-crayon": "school-drawing",
  "harbor-clownfish": "harbor-animal", "harbor-seahorse": "harbor-animal", "harbor-octopus": "harbor-many-points", "harbor-starfish": "harbor-many-points", "harbor-pearl": "harbor-round",
  "harbor-anchor": "harbor-equipment", "harbor-snorkel": "harbor-equipment", "harbor-treasure-chest": "harbor-container", "harbor-submarine": "harbor-vessel", "harbor-coral-branch": "harbor-organic",
  "museum-rocket": "museum-spacecraft", "museum-satellite": "museum-spacecraft", "museum-planet": "museum-round", "museum-astronaut-helmet": "museum-round", "museum-telescope": "museum-long-tool",
  "museum-robot": "museum-machine", "museum-control-panel": "museum-machine", "museum-moon-boot": "museum-wear", "museum-comet": "museum-space", "museum-wrench": "museum-tool",
  "town-bicycle": "town-vehicle", "town-toy-train": "town-vehicle", "town-balloon": "town-round", "town-pinwheel": "town-spinning", "town-ticket": "town-paper",
  "town-cupcake": "town-party", "town-drum": "town-party", "town-crown": "town-dress-up", "town-gift-box": "town-box", "town-traffic-cone": "town-cone",
  "castle-frog": "castle-creature", "castle-dragon": "castle-creature", "castle-royal-crown": "castle-regalia", "castle-goblet": "castle-regalia",
  "castle-castle-key": "castle-metal", "castle-chess-knight": "castle-metal", "castle-shield": "castle-heraldry", "castle-banner": "castle-heraldry",
  "castle-scroll": "castle-long", "castle-torch": "castle-long",
};

/** Frozen curriculum inventory. Phase 0 fixes these IDs before progress exists. */
export const OBJECT_CATALOG: ObservationObject[] = Object.entries(PACKS).flatMap(
  ([theme, names]) => names.map((name, index) => {
    const id = `${theme}-${slug(name)}`;
    return {
    id,
    name,
    aliases: [],
    theme,
    tags: [theme, index < 5 ? "natural-or-common" : "made-object"],
    silhouetteFamily: `${theme}-${index}`,
    decoyGroup: DECOY_GROUPS[id],
    dominantColorRole: ["amber", "cyan", "rose", "emerald", "violet"][index % 5],
    category: CATEGORY_OF[name],
    mirrorSafe: MIRROR_SAFE.has(name),
    orientationSafe: !["sunscreen", "kite", "robin", "watering can", "alarm clock", "windmill", "frog", "banner", "torch"].includes(name),
    minimumVisibleFraction: index < 3 ? 0.7 : 0.6,
  }}),
);

export const OBJECT_BY_ID = new Map(OBJECT_CATALOG.map((object) => [object.id, object]));

export const BEACH_OBJECT_IDS = PACKS.beach.map((name) => `beach-${slug(name)}`);

/** The character swarm rounds hide many times over. */
export const SWARM_OBJECT_ID = "castle-frog";

/** Objects grouped by what they are, for category rounds. */
export const OBJECTS_BY_CATEGORY = OBJECT_CATALOG.reduce<Record<string, string[]>>((all, object) => {
  if (object.category) all[object.category] = [...(all[object.category] ?? []), object.id];
  return all;
}, {});
