import { registerCommonVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";
import voiceJson from "./voice.json";

/**
 * The app's own voice, registered once at start-up.
 *
 * Everything here is said identically by every skill: the number words and the
 * digits 0-60, the two place-value facts, and praise that names no subject.
 * They used to live in counting's folder and be reached by accident — the clip
 * registry is keyed by phrase text, so addition's "seven" resolved to
 * counting's recording only because counting was installed. That made a shared
 * asset the property of one skill, and removing that skill would have taken
 * every other skill's numbers with it.
 *
 * Imported for its side effect, like a skill's own registration. It fills gaps
 * rather than overwriting: a skill that records a line its own way keeps it.
 */
export const commonVoiceClips = registerCommonVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", {
    query: "?url",
    import: "default",
    eager: true,
  }) as Record<string, string>,
  voiceJson.groups,
);
