import { ta } from "../i18n";
import { skillArtId } from "../../../../assets/svg/skillArt";

/**
 * The things this skill asks a child to count and combine.
 *
 * Six, and chosen the way counting chose its eight: no two share a silhouette
 * class — round, spherical, blocky, tall, radial, peaked — because two objects
 * of the same outline sitting in two bins turns "how many altogether" into a
 * discrimination task. They also carry the same optical weight, so five apples
 * and five beads read as the same quantity; perceived density is exactly the
 * confound an addition question is trying to hold still.
 *
 * Addition ships its own artwork rather than pointing at `counting-rocket`.
 * The ids in the shared registry belong to the skill that registered them, and
 * a family who disables counting would take addition's objects with it.
 */
const art = (name: string) => skillArtId("addition", name);

export interface Countable {
  id: string;
  /** Plural, for prompts: "Touch each apple." In the language on screen. */
  readonly name: string;
  /** Singular, for a hint that names one: "one more apple". */
  readonly one: string;
  /** One of them, with its article: "an apple". */
  readonly aOne: string;
  /** Silhouette class, so a lesson can ask for two that cannot be confused. */
  shape: "round" | "sphere" | "blocky" | "tall" | "radial" | "peaked";
}

/** Names come from the catalog (`objects.*`), so each language writes its own. */
const countable = (key: string, shape: Countable["shape"]): Countable => ({
  id: art(key),
  get name() {
    return ta(`objects.${key}.many`);
  },
  get one() {
    return ta(`objects.${key}.one`);
  },
  get aOne() {
    return ta(`objects.${key}.aOne`);
  },
  shape,
});

export const COUNTABLES: Countable[] = [
  countable("apple", "round"),
  countable("bead", "sphere"),
  countable("block", "blocky"),
  countable("balloon", "tall"),
  countable("shell", "radial"),
  countable("star", "peaked"),
];
