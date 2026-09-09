import type { KodaSDK } from "../../../types";

export const tagLabelsFrom = (koda: KodaSDK) => ({
  warmup: koda.config.get("warmupLabel", "") || undefined,
  activity: koda.config.get("activityLabel", "") || undefined,
  guided: koda.config.get("guidedLabel", "") || undefined,
  milestone: koda.config.get("milestoneLabel", "") || undefined,
});

export const speechRate = (koda: KodaSDK): { rate: number } => ({
  rate: koda.config.get("speechRate", 0.95),
});

/** Four choices, or a pad to type on. Declared in the manifest, read here. */
export const answerInput = (koda: KodaSDK): "choices" | "pad" =>
  koda.config.get<string>("answerInput", "choices") === "pad" ? "pad" : "choices";

/**
 * How far the times table runs, and how far generated factors go with it.
 *
 * The benchmark's clearest split: the UK curriculum requires 12 × 12 by the end
 * of Year 4, the US Common Core stops at 10 × 10. One setting serves both, and
 * it has to reach the *numbers* as well as the chart — a chart that stops at
 * ten beside a question asking for 11 × 7 is worse than either choice alone.
 */
export const tableCeiling = (koda: KodaSDK): 10 | 12 =>
  koda.config.get<string>("tableCeiling", "12") === "10" ? 10 : 12;
