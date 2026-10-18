import { skillArtId } from "../../../../assets/svg/skillArt";
import { ts } from "../i18n";

const art = (name: string) => skillArtId("subtraction", name);

export interface Countable {
  id: string;
  /** Plural, in the language on screen. */
  readonly name: string;
  /** Singular, in the language on screen. */
  readonly one: string;
  shape: "round" | "angular" | "tall" | "long" | "radial" | "peaked";
}

/** Names come from the catalog (`objects.*`), so each language writes its own. */
function countable(key: string, shape: Countable["shape"]): Countable {
  return {
    id: art(key),
    get name() {
      return ts(`objects.${key}.many`);
    },
    get one() {
      return ts(`objects.${key}.one`);
    },
    shape,
  };
}

/** Equal-weight, distinct silhouettes so object choice never changes difficulty. */
export const COUNTABLES: Countable[] = [
  countable("cookie", "round"),
  countable("gem", "angular"),
  countable("kite", "tall"),
  countable("fish", "long"),
  countable("flower", "radial"),
  countable("crown", "peaked"),
];
