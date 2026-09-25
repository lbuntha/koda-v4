/**
 * The stories that ship inside the app.
 *
 * A device that has never been online still has a shelf: these are what it
 * plays. They are also the fixtures the rest of the module is tested against,
 * which is the point — content is judged by the same checks whether a person
 * wrote it or a model drafted it, and these are the ones a person wrote.
 *
 * The Khmer story carries a `provenance` that says it has not been read by a
 * native speaker. That is data rather than a comment so a publish gate can
 * refuse to ship it until someone has.
 */

import type { Passage } from "./passage";
import market from "./passages/starter-market.json";
import marketKm from "./passages/starter-market-km.json";
import rainyDay from "./passages/starter-rainy-day.json";

export const STARTER_PASSAGES: readonly Passage[] = [market, rainyDay, marketKm] as unknown as Passage[];
