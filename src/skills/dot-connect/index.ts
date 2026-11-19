import type { Skill } from "../types";
import { describeSkill } from "../describe";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as connect from "./activities/ConnectBoard";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";
import voiceJson from "./voice.json";

const info = describeSkill(manifestJson, lessonsJson);

// No `registerSkillArt`: the board is a grid of squares drawn from its size,
// so there is nothing to illustrate.
registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", { query: "?url", import: "default", eager: true }) as Record<string, string>,
  voiceJson.groups,
  info.manifest.id,
);

export const skill: Skill = {
  ...info,
  assets: [],
  activities: {
    // One engine: joining, filling, walls, step counts and bridges are all
    // configuration of the same board, not different screens.
    connect: {
      id: "connect",
      name: "Dot Connect",
      defaultParams: { spec: "one-pair", questionsPerRound: 3 },
      component: connect.ConnectBoard,
      // No worksheet: a paper board loses cutting and redrawing, which is how
      // the puzzle is worked out.
      worksheet: undefined,
    },
  },
};
