/**
 * Haptic Vibration Utility using Web Navigator.vibrate() API
 * Designed to provide physical tactile feedback when children interact with manipulatives,
 * perfectly synchronized with the 'tap-pop-anim' spring bounce sequence.
 */

import { SkillStoreAPI } from "../lib/skillStore";

/** Skill whose flags currently gate haptics. See the note in triggerHaptic. */
const HAPTICS_OWNER = "counting";

export type HapticType =
  | "pop"
  | "tap-pop"
  | "clink"
  | "snap"
  | "hint"
  | "light"
  | "heavy"
  | "success"
  | "levelup"
  | "error";

/**
 * Checks if the Web Vibration API is supported in current client environment.
 */
export function isHapticsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "vibrate" in navigator &&
    typeof navigator.vibrate === "function"
  );
}

/**
 * Dispatches a vibration pattern corresponding to the manipulative interaction.
 *
 * @param type The semantic haptic feedback type (default: "pop")
 * @param customPattern Optional custom vibration duration (ms) or pattern array
 * @returns boolean indicating if the vibration call succeeded
 */
export function triggerHaptic(
  type: HapticType = "pop",
  customPattern?: number | number[]
): boolean {
  if (!isHapticsSupported()) {
    return false;
  }

  // A shared util should not know a skill id — a skill that wants haptics
  // gated by its own flag should check `koda.config.isEnabled()` and call this
  // only when enabled. Kept pointing at the counting skill for now so existing
  // behaviour is preserved; it defaults to on when the skill is absent.
  if (
    typeof SkillStoreAPI !== "undefined" &&
    !SkillStoreAPI.isFeatureEnabled(HAPTICS_OWNER, "haptic_feedback", true)
  ) {
    return false;
  }

  try {
    if (customPattern !== undefined) {
      return navigator.vibrate(customPattern);
    }

    // Retrieve configured haptic intensity setting if available
    const intensity =
      typeof SkillStoreAPI !== "undefined"
        ? SkillStoreAPI.getSkillSetting<string>(HAPTICS_OWNER, "hapticIntensity", "crisp")
        : "crisp";

    // Duration multipliers based on intensity setting
    let popDuration = 18; // default "crisp"
    if (intensity === "subtle") popDuration = 10;
    if (intensity === "strong") popDuration = 32;

    switch (type) {
      case "pop":
      case "tap-pop":
        // Crisp, bouncy pulse coinciding with the apex of the tap-pop-anim bounce
        return navigator.vibrate([popDuration]);

      case "clink":
      case "light":
        // Soft micro-tick for secondary button or grid selection
        return navigator.vibrate([Math.max(8, Math.round(popDuration * 0.6))]);

      case "snap":
        // Double micro-pulse simulating magnetic docking into a Ten-Frame fuel cell
        return navigator.vibrate([12, 20, 15]);

      case "heavy":
        return navigator.vibrate([Math.round(popDuration * 1.8)]);

      case "success":
        // Melodic celebratory double pulse [25ms pulse, 40ms silence, 35ms pulse]
        return navigator.vibrate([25, 40, 35]);

      case "levelup":
        // Energizing triple crescendo pulse pattern
        return navigator.vibrate([30, 35, 45, 40, 65]);

      case "error":
        // Alert double buzz
        return navigator.vibrate([50, 45, 50]);

      default:
        return navigator.vibrate([popDuration]);
    }
  } catch (err) {
    // Fail silently if browser policy blocks vibration (e.g. background tab or non-gesture)
    return false;
  }
}

/**
 * Triggers a synchronized 'tap-pop' haptic pulse for manipulative interactions.
 */
export function triggerTapPopHaptic(): boolean {
  return triggerHaptic("pop");
}
