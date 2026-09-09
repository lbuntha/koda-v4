import { skillArtId } from "../../../../assets/svg/skillArt";

const art = (name: string) => skillArtId("multiplication", name);

export interface Countable {
  id: string;
  /** Plural, for "six apples". */
  name: string;
  /** Singular, for one object's label. */
  one: string;
  shape: "round" | "oval" | "tall" | "star" | "disc" | "leafy";
}

/**
 * Equal-weight, distinct silhouettes so object choice never changes difficulty.
 *
 * This skill's own rather than counting's: the ids in the shared registry belong
 * to the skill that registered them, and a family who turned counting off would
 * otherwise take multiplication's objects away with it.
 */
export const COUNTABLES: Countable[] = [
  { id: art("apple"), name: "apples", one: "apple", shape: "round" },
  { id: art("egg"), name: "eggs", one: "egg", shape: "oval" },
  { id: art("pencil"), name: "pencils", one: "pencil", shape: "tall" },
  { id: art("sticker"), name: "stickers", one: "sticker", shape: "star" },
  { id: art("coin"), name: "coins", one: "coin", shape: "disc" },
  { id: art("leaf"), name: "leaves", one: "leaf", shape: "leafy" },
];

/** What the bins are called, so a prompt can say "four baskets of three". */
export interface Container {
  /** Plural. */
  name: string;
  one: string;
}

export const CONTAINERS: Container[] = [
  { name: "baskets", one: "basket" },
  { name: "boxes", one: "box" },
  { name: "plates", one: "plate" },
  { name: "bags", one: "bag" },
  { name: "trays", one: "tray" },
];
