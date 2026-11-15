import type { SvgAssetId } from "../../assets/svg";

/**
 * The art-library icon for each notification kind — one map, so the
 * Notifications inbox and the Settings switches always draw the same picture
 * for the same kind. Unknown kinds fall back to their category's mark.
 */
const KIND_ART: Record<string, SvgAssetId> = {
  "device.new_signin": "kit-shield",
  "family.invite_redeemed": "kit-family",
  "family.child_device_joined": "kit-family",
  "plan.request_decided": "kit-card",
  "learn.weekly_summary": "kit-report",
  "learn.daily_digest": "kit-calendar",
  "learn.goal_met": "kit-party",
  "learn.skill_published": "kit-sparkle",
  "learn.practice_reminder": "kit-clock",
  "learn.streak_ending": "streak",
  "learn.absence": "kit-recent",
  "learn.time_limit": "kit-timer",
  "learn.mastered": "kit-star",
  "learn.voice_note": "kit-sound",
  "learn.stuck": "kit-hand",
  "system.broadcast": "kit-alert",
  "system.announcement": "kit-alert",
};

export const notifyKindArt = (kind: string): SvgAssetId =>
  KIND_ART[kind] ?? (kind.startsWith("learn.") ? "kit-report" : "kit-shield");
