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
  /** Plural, for prompts: "Touch each apple." */
  name: string;
  /** Singular, for a hint that names one: "one more apple". */
  one: string;
  /** Silhouette class, so a lesson can ask for two that cannot be confused. */
  shape: "round" | "sphere" | "blocky" | "tall" | "radial" | "peaked";
}

export const COUNTABLES: Countable[] = [
  { id: art("apple"), name: "apples", one: "apple", shape: "round" },
  { id: art("bead"), name: "beads", one: "bead", shape: "sphere" },
  { id: art("block"), name: "blocks", one: "block", shape: "blocky" },
  { id: art("balloon"), name: "balloons", one: "balloon", shape: "tall" },
  { id: art("shell"), name: "shells", one: "shell", shape: "radial" },
  { id: art("star"), name: "stars", one: "star", shape: "peaked" },
];
