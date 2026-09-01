import type { KodaSDK } from "../../../types";

/**
 * The framing chip's wording, which a family may reword in Settings.
 *
 * Blank means "no opinion", so the kit's own default applies — passing an empty
 * string through would replace "Warm-up Exercise" with nothing. Every engine
 * needs exactly this, and wrote exactly this, seven times.
 */
export const tagLabelsFrom = (koda: KodaSDK) => ({
  warmup: koda.config.get("warmupLabel", "") || undefined,
  activity: koda.config.get("activityLabel", "") || undefined,
  guided: koda.config.get("guidedLabel", "") || undefined,
  milestone: koda.config.get("milestoneLabel", "") || undefined,
});

/**
 * How fast this family wants Koda to speak.
 *
 * One reader, so a rate change in Settings reaches every line rather than the
 * ones somebody remembered to thread it through.
 */
export const speechRate = (koda: KodaSDK): { rate: number } => ({
  rate: koda.config.get("speechRate", 0.95),
});
