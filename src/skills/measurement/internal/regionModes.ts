import type { Region } from "../../region";

/**
 * Modes that only one region's lessons teach.
 *
 * A teaching lesson for these carries `regions: ["US"]` and is never shown
 * elsewhere. A practice lesson mixes a whole stage, so it lists every mode and
 * drops the ones the learner's region never met: a child in Phnom Penh is not
 * asked to read pounds and ounces in a practice round.
 */
export const US_ONLY_MODES: ReadonlySet<string> = new Set(["read_lb", "customary", "read_f", "read_inch", "read_inch_fraction"]);

export const modeShown = (mode: string, region: Region) => region === "US" || !US_ONLY_MODES.has(mode);

/** The lesson's params with `question.modes` narrowed to the region. A teaching lesson (one `mode`) is untouched. */
export function forRegion<P extends { question?: { modes?: string[] } }>(params: P, region: Region): P {
  const modes = params.question?.modes;
  if (!modes?.length) return params;
  const kept = modes.filter((m) => modeShown(m, region));
  if (kept.length === modes.length || kept.length === 0) return params;
  return { ...params, question: { ...params.question, modes: kept } };
}
