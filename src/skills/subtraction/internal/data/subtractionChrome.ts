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
