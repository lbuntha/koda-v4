import { skillArtId } from "../../../../assets/svg/skillArt";
import { tm } from "../i18n";

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
const countable = (key: string, shape: Countable["shape"]): Countable => ({
  id: art(key),
  get name() { return tm(`countables.${key}.many`); },
  get one() { return tm(`countables.${key}.one`); },
  shape,
});

export const COUNTABLES: Countable[] = [
  countable("apple", "round"),
  countable("egg", "oval"),
  countable("pencil", "tall"),
  countable("sticker", "star"),
  countable("coin", "disc"),
  countable("leaf", "leafy"),
];

export interface Container {
  /** Plural. */
  name: string;
  one: string;
}

const bin = (key: string): Container => ({
  get name() { return tm(`bins.${key}.many`); },
  get one() { return tm(`bins.${key}.one`); },
});

export const CONTAINERS: Container[] = ["basket", "box", "plate", "bag", "tray"].map(bin);
