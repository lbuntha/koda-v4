export type ObservationMode =
  | "exact"
  | "silhouette"
  | "near_decoys"
  | "rotation"
  | "scale"
  | "occluded"
  | "clutter"
  | "mixed";

export type ObservationRegion = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface ObservationObject {
  id: string;
  name: string;
  aliases: string[];
  theme: string;
  tags: string[];
  silhouetteFamily: string;
  decoyGroup?: string;
  dominantColorRole: string;
  orientationSafe: boolean;
  minimumVisibleFraction: number;
}

export interface SceneObject {
  id: string;
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  z: number;
  hitPadding: number;
  visibleFraction: number;
  tags: string[];
  region: ObservationRegion;
}

export interface ObservationScene {
  id: string;
  name: string;
  place: string;
  backdrop: string;
  objects: SceneObject[];
}

export interface ObjectHuntSetup {
  level?: number;
  mode?: ObservationMode;
  modes?: ObservationMode[];
  sceneId?: string;
  objectCount?: number | [number, number];
  targetCount?: number | [number, number];
  questionsPerRound?: number;
  seed?: string;
  practice?: boolean;
  targetScale?: number;
  camouflageStrength?: number;
}
