/**
 * A skill's tags — see `src/lib/topics.ts`. Topics are declared in its
 * manifest; a skill names no units, since its numbers change with every round.
 */

import { cleanTopics, tags, type ContentTags } from "../lib/topics";
import type { SkillManifest } from "./types";

export const skillTags = (manifest: Pick<SkillManifest, "topics">): ContentTags => tags(cleanTopics(manifest.topics));
