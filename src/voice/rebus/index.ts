import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";
import voiceJson from "./voice.json";

/** The id Rebus Rush files its recordings under. Not a skill: its own module. */
export const REBUS_VOICE = "rebus";

/**
 * Rebus Rush's own lines, registered when the game's sounds load.
 *
 * Filed under its own id, like a skill's, so its reactions are only ever
 * heard in Rebus Rush and never in a lesson. A pack with nothing recorded
 * registers nothing and the game stays silent where it would have spoken.
 */
export const rebusVoiceClips = registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", { query: "?url", import: "default", eager: true }) as Record<string, string>,
  voiceJson.groups,
  REBUS_VOICE,
);
