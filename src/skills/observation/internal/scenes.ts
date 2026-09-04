import beachJson from "./scenes/beach-sandcastle-shore.json";
import type { ObservationScene } from "./types";

export const SCENES = [beachJson as ObservationScene];
export const SCENE_BY_ID = new Map(SCENES.map((scene) => [scene.id, scene]));
