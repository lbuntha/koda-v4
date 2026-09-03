import { skillArtId } from "../../../../assets/svg/skillArt";

const art = (name: string) => skillArtId("subtraction", name);

export interface Countable {
  id: string;
  name: string;
  one: string;
  shape: "round" | "angular" | "tall" | "long" | "radial" | "peaked";
}

/** Equal-weight, distinct silhouettes so object choice never changes difficulty. */
export const COUNTABLES: Countable[] = [
  { id: art("cookie"), name: "cookies", one: "cookie", shape: "round" },
  { id: art("gem"), name: "gems", one: "gem", shape: "angular" },
  { id: art("kite"), name: "kites", one: "kite", shape: "tall" },
  { id: art("fish"), name: "fish", one: "fish", shape: "long" },
  { id: art("flower"), name: "flowers", one: "flower", shape: "radial" },
  { id: art("crown"), name: "crowns", one: "crown", shape: "peaked" },
];
