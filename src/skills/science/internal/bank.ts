/**
 * Wonder Lab, Grade 1 — the facts, as data.
 *
 * Every word a child reads lives in `locales/<lang>.json` under the same ids,
 * so this file holds only shape: which picture, which choices, which answer.
 * `science.content.test.ts` checks the shape; the words were written against
 * the sources named on each set, and a set's standard is the NGSS performance
 * expectation it assesses (lessons.json carries the codes).
 *
 * Wrong choices are chosen on purpose. Each one is either plainly wrong for a
 * six-year-old to rule out, or a misconception children really hold ("the Moon
 * makes its own light", "a fish does not need air", "a tadpole is a fish"). A
 * misconception choice carries its own explanation (`no.<choice>` in the
 * locale), so a wrong tap teaches the specific thing that was wrong.
 */

export type PickSetId =
  | "needs"
  | "senses"
  | "plantparts"
  | "animalparts"
  | "young"
  | "care"
  | "sound"
  | "see"
  | "sky"
  | "seasons";

export interface Choice {
  id: string;
  /** A picture id from `activities/pics.tsx`; text-only when absent. */
  pic?: string;
}

export interface PickItem {
  id: string;
  /** The picture the question is about. */
  pic?: string;
  choices: Choice[];
  answer: string;
  /** Wrong choices that have their own explanation in the locale. */
  explained?: string[];
}

const c = (id: string, pic?: string): Choice => (pic ? { id, pic } : { id });
const part = (id: string): Choice => ({ id, pic: `plant-${id}` });

export const PICK_SETS: Record<PickSetId, PickItem[]> = {
  /* What living things need — NGSS K-LS1-1. */
  needs: [
    { id: "dry-plant", pic: "plant-dry", choices: [c("water", "water"), c("dark", "night"), c("blanket", "blanket")], answer: "water", explained: ["dark"] },
    { id: "plant-food", pic: "sun", choices: [c("sunlight", "sun"), c("rice", "rice-bowl"), c("milk", "milk")], answer: "sunlight", explained: ["rice", "milk"] },
    { id: "fish-air", pic: "fish", choices: [c("yes"), c("no")], answer: "yes", explained: ["no"] },
    { id: "no-food", choices: [c("cat", "cat"), c("hen", "hen"), c("child", "child"), c("robot", "robot")], answer: "robot", explained: ["cat", "hen", "child"] },
    { id: "rice-water", pic: "rice-field", choices: [c("grow"), c("white"), c("shade")], answer: "grow", explained: ["white"] },
    { id: "puppy", pic: "dog", choices: [c("all"), c("sun"), c("toys")], answer: "all", explained: ["sun"] },
  ],

  /* The five senses and keeping them safe — Cambodian Grade 1 science and health. */
  senses: [
    { id: "hear", pic: "rooster", choices: [c("ear", "ear"), c("eye", "eye"), c("nose", "nose")], answer: "ear" },
    { id: "smell", pic: "durian", choices: [c("nose", "nose"), c("ear", "ear"), c("hand", "hand")], answer: "nose" },
    { id: "taste", pic: "mango", choices: [c("tongue", "tongue"), c("eye", "eye"), c("ear", "ear")], answer: "tongue" },
    { id: "see", pic: "rainbow", choices: [c("eye", "eye"), c("nose", "nose"), c("tongue", "tongue")], answer: "eye" },
    { id: "feel", pic: "ice", choices: [c("hand", "hand"), c("ear", "ear"), c("eye", "eye")], answer: "hand" },
    { id: "sun-safe", pic: "sun", choices: [c("no"), c("yes")], answer: "no", explained: ["yes"] },
    { id: "smoke", pic: "smoke", choices: [c("tell"), c("sleep")], answer: "tell", explained: ["sleep"] },
  ],

  /* Plant parts and what they do — NGSS 1-LS1-1. */
  plantparts: [
    { id: "water", choices: [part("root"), part("leaf"), part("flower")], answer: "root", explained: ["leaf"] },
    { id: "hold", choices: [part("stem"), part("flower"), part("leaf")], answer: "stem" },
    { id: "food", choices: [part("leaf"), part("root"), part("seed")], answer: "leaf", explained: ["root"] },
    { id: "fruit", choices: [part("flower"), part("root"), part("leaf")], answer: "flower" },
    { id: "new-tree", pic: "mango", choices: [part("seed"), part("leaf"), part("root")], answer: "seed" },
    { id: "lotus", pic: "lotus", choices: [part("root"), part("flower"), part("leaf")], answer: "root" },
  ],

  /* Animal body parts and what they are for — NGSS 1-LS1-1. */
  animalparts: [
    { id: "fish", pic: "fish", choices: [c("fins"), c("gills"), c("scales")], answer: "fins", explained: ["gills", "scales"] },
    { id: "bird", pic: "bird", choices: [c("wings"), c("beak"), c("feet")], answer: "wings", explained: ["beak"] },
    { id: "turtle", pic: "turtle", choices: [c("shell"), c("tail"), c("eyes")], answer: "shell" },
    { id: "duck", pic: "duck", choices: [c("webbed"), c("beak"), c("eyes")], answer: "webbed" },
    { id: "elephant", pic: "elephant", choices: [c("trunk"), c("ears"), c("tail")], answer: "trunk" },
    { id: "rabbit", pic: "rabbit", choices: [c("hear"), c("fly"), c("swim")], answer: "hear" },
  ],

  /* Young are like, but not exactly like, their parents — NGSS 1-LS3-1. */
  young: [
    { id: "tadpole", pic: "tadpole", choices: [c("frog", "frog"), c("fish", "fish"), c("bird", "bird")], answer: "frog", explained: ["fish"] },
    { id: "chick", pic: "chick", choices: [c("hen", "hen"), c("duck", "duck"), c("cat", "cat")], answer: "hen", explained: ["duck"] },
    { id: "caterpillar", pic: "caterpillar", choices: [c("butterfly", "butterfly"), c("snail", "snail"), c("bird", "bird")], answer: "butterfly" },
    { id: "kittens", pic: "kittens", choices: [c("alike"), c("same"), c("different")], answer: "alike", explained: ["same"] },
    { id: "mango-seed", pic: "seed", choices: [c("mango", "mango-tree"), c("banana", "banana-tree"), c("coconut", "coconut-tree")], answer: "mango" },
    { id: "puppies", pic: "puppies", choices: [c("can"), c("never")], answer: "can", explained: ["never"] },
  ],

  /* How parents help their young survive — NGSS 1-LS1-2. */
  care: [
    { id: "hen-eggs", pic: "hen-nest", choices: [c("warm"), c("break"), c("sleep")], answer: "warm" },
    { id: "bird-feed", pic: "nest", choices: [c("food"), c("away"), c("sing")], answer: "food" },
    { id: "cat-carry", pic: "cat-carry", choices: [c("safe"), c("play"), c("clean")], answer: "safe" },
    { id: "baby-cry", pic: "baby", choices: [c("needs"), c("leave")], answer: "needs", explained: ["leave"] },
    { id: "ducklings", pic: "ducklings", choices: [c("learn"), c("lost"), c("race")], answer: "learn" },
    { id: "crocodile", pic: "crocodile", choices: [c("guard"), c("more"), c("sun")], answer: "guard" },
  ],

  /* Sound is made by vibration, and sound makes things vibrate — NGSS 1-PS4-1. */
  sound: [
    { id: "hum", pic: "throat", choices: [c("shake"), c("hot"), c("nothing")], answer: "shake" },
    { id: "drum", pic: "drum", choices: [c("shakes"), c("melts"), c("still")], answer: "shakes", explained: ["still"] },
    { id: "bell", pic: "bell", choices: [c("stops"), c("louder"), c("same")], answer: "stops", explained: ["same"] },
    { id: "rice", pic: "drum-rice", choices: [c("jump"), c("grow"), c("melt")], answer: "jump" },
    { id: "harder", pic: "drum", choices: [c("louder"), c("quieter"), c("same")], answer: "louder", explained: ["quieter"] },
    { id: "string", pic: "guitar", choices: [c("stops"), c("look"), c("never")], answer: "stops", explained: ["never"] },
  ],

  /* We see only when there is light; light passes, bounces or is blocked — NGSS 1-PS4-2, 1-PS4-3. */
  see: [
    { id: "cave", pic: "cave", choices: [c("no"), c("yes")], answer: "no", explained: ["yes"] },
    { id: "moon", pic: "moon", choices: [c("sun"), c("own"), c("lamp")], answer: "sun", explained: ["own", "lamp"] },
    { id: "shadow", pic: "shadow-midday", choices: [c("block"), c("water"), c("wind")], answer: "block", explained: ["water"] },
    { id: "mirror", pic: "mirror", choices: [c("bounce"), c("through"), c("gone")], answer: "bounce", explained: ["through"] },
    { id: "dark-room", pic: "night", choices: [c("light"), c("close"), c("quiet")], answer: "light" },
    { id: "cat-dark", pic: "cat", choices: [c("no"), c("yes")], answer: "no", explained: ["yes"] },
  ],

  /* Patterns of the Sun, Moon and stars — NGSS 1-ESS1-1. */
  sky: [
    { id: "rise", pic: "sunrise", choices: [c("east"), c("west")], answer: "east" },
    { id: "set", pic: "sunset", choices: [c("west"), c("east")], answer: "west" },
    { id: "high", pic: "midday", choices: [c("midday"), c("morning"), c("evening")], answer: "midday" },
    { id: "stars", pic: "stars", choices: [c("bright"), c("away"), c("sleep")], answer: "bright", explained: ["away", "sleep"] },
    { id: "day-moon", pic: "day-moon", choices: [c("yes"), c("no")], answer: "yes", explained: ["no"] },
    { id: "short-shadow", pic: "shadow-midday", choices: [c("midday"), c("morning"), c("evening")], answer: "midday" },
    { id: "moon-shape", pic: "moon-half", choices: [c("changes"), c("round")], answer: "changes", explained: ["round"] },
  ],

  /* Weather and seasons in Cambodia (K-ESS2-1); daylight through the year (1-ESS1-2). */
  seasons: [
    { id: "rainy", pic: "rain", choices: [c("may"), c("dec"), c("never")], answer: "may" },
    { id: "dry", pic: "sun", choices: [c("jan"), c("aug"), c("sep")], answer: "jan" },
    { id: "rice", pic: "rice-field", choices: [c("rains"), c("dry")], answer: "rains", explained: ["dry"] },
    { id: "storm", pic: "storm", choices: [c("inside"), c("tree"), c("river")], answer: "inside", explained: ["tree", "river"] },
    { id: "long-day", pic: "sunset", choices: [c("june"), c("december")], answer: "june" },
    { id: "cool", pic: "sun", choices: [c("shade"), c("coat")], answer: "shade" },
  ],
};

/* -------------------------------------------------------------------------- */
/* Sorting                                                                     */
/* -------------------------------------------------------------------------- */

export type SortSetId = "living" | "lightsource" | "lightpath";

export interface SortSet {
  bins: Choice[];
  items: { id: string; pic: string; bin: string }[];
}

export const SORT_SETS: Record<SortSetId, SortSet> = {
  /* Living or not living — the idea under K-LS1-1: living things need food and water, grow, and have young. */
  living: {
    bins: [c("living", "sprout"), c("not", "rock")],
    items: [
      { id: "dog", pic: "dog", bin: "living" },
      { id: "car", pic: "car", bin: "not" },
      { id: "tree", pic: "tree", bin: "living" },
      { id: "ball", pic: "ball", bin: "not" },
      { id: "fish", pic: "fish", bin: "living" },
      { id: "robot", pic: "robot", bin: "not" },
      { id: "flower", pic: "flower", bin: "living" },
      { id: "rock", pic: "rock", bin: "not" },
      { id: "snail", pic: "snail", bin: "living" },
      { id: "book", pic: "book", bin: "not" },
      { id: "rice", pic: "rice-plant", bin: "living" },
      { id: "cup", pic: "cup", bin: "not" },
    ],
  },

  /* Makes its own light, or does not — supports 1-PS4-2 (we see by light from a source). */
  lightsource: {
    bins: [c("makes", "lamp"), c("none", "book")],
    items: [
      { id: "sun", pic: "sun", bin: "makes" },
      { id: "moon", pic: "moon", bin: "none" },
      { id: "lamp", pic: "lamp", bin: "makes" },
      { id: "mirror", pic: "mirror", bin: "none" },
      { id: "candle", pic: "candle", bin: "makes" },
      { id: "spoon", pic: "spoon", bin: "none" },
      { id: "torch", pic: "torch", bin: "makes" },
      { id: "book", pic: "book", bin: "none" },
      { id: "firefly", pic: "firefly", bin: "makes" },
      { id: "rock", pic: "rock", bin: "none" },
    ],
  },

  /* Light through materials: see-through, some light, blocks light — NGSS 1-PS4-3. */
  lightpath: {
    bins: [c("clear", "window"), c("some", "paper"), c("blocks", "door")],
    items: [
      { id: "window", pic: "window", bin: "clear" },
      { id: "paper", pic: "paper", bin: "some" },
      { id: "door", pic: "door", bin: "blocks" },
      { id: "glass", pic: "glass-water", bin: "clear" },
      { id: "cloth", pic: "cloth", bin: "some" },
      { id: "pot", pic: "pot", bin: "blocks" },
      { id: "bottle", pic: "bottle", bin: "clear" },
      { id: "bag", pic: "bag", bin: "some" },
      { id: "wall", pic: "wall", bin: "blocks" },
      { id: "book", pic: "book", bin: "blocks" },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Putting in order                                                            */
/* -------------------------------------------------------------------------- */

export type OrderSetId = "growth" | "sky";

export interface OrderSeq {
  id: string;
  /** Steps in their true order. Each step's picture id is `<seq>-<step>`. */
  steps: string[];
}

export const ORDER_SETS: Record<OrderSetId, OrderSeq[]> = {
  /* How living things grow and change — NGSS 1-LS3-1 (young become like their parents). */
  growth: [
    { id: "mango", steps: ["seed", "sprout", "young", "fruit"] },
    { id: "chicken", steps: ["egg", "chick", "hen"] },
    { id: "frog", steps: ["eggs", "tadpole", "froglet", "frog"] },
    { id: "butterfly", steps: ["egg", "caterpillar", "chrysalis", "butterfly"] },
    { id: "person", steps: ["baby", "child", "adult"] },
    { id: "rice", steps: ["seedling", "green", "golden", "harvest"] },
  ],
  /* The Sun's daily path, the Moon growing, shadows through the day — NGSS 1-ESS1-1. */
  sky: [
    { id: "sun", steps: ["sunrise", "midday", "sunset", "night"] },
    { id: "moon", steps: ["crescent", "half", "full"] },
    { id: "shadow", steps: ["morning", "midday", "evening"] },
  ],
};
