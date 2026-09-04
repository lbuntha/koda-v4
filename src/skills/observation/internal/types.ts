export type ObservationMode =
  | "exact"
  | "silhouette"
  | "near_decoys"
  | "rotation"
  | "scale"
  | "occluded"
  | "clutter"
  | "swarm"
  | "overlap"
  | "mirror"
  | "camouflage"
  | "shadow"
  | "category"
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
  /** What the object is, for rounds that ask by category rather than picture. */
  category?: string;
  /** Its mirror image is visibly different, so a mirror round can use it. */
  mirrorSafe?: boolean;
  orientationSafe: boolean;
  minimumVisibleFraction: number;
}

export interface SceneObject {
  /** Catalog id. In a swarm scene many objects share one of these. */
  id: string;
  /**
   * Unique key for this placement. Only swarm scenes need it, because they
   * hide the same catalog object many times over; everywhere else the catalog
   * id is already unique and `keyOf` falls back to it.
   */
  instanceId?: string;
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visualScale?: number;
  z: number;
  hitPadding: number;
  visibleFraction: number;
  /** Horizontally flipped. Mirror rounds ask the child to reject these. */
  mirrored?: boolean;
  tags: string[];
  region: ObservationRegion;
}

export interface ObservationScene {
  id: string;
  name: string;
  place: string;
  backdrop: string;
  objects: SceneObject[];
  /** Catalog id of the character a swarm round asks the child to count out. */
  swarmObjectId?: string;
}

/**
 * The key that identifies one placement for finding, scoring, and animation.
 *
 * Scenes authored before swarm mode carry no `instanceId`, and their catalog
 * ids are unique within a scene, so the fallback keeps every existing scene,
 * saved round, and test answer string working unchanged.
 */
export const keyOf = (object: Pick<SceneObject, "id" | "instanceId">): string =>
  object.instanceId ?? object.id;

export interface ObjectHuntSetup {
  level?: number;
  mode?: ObservationMode;
  modes?: ObservationMode[];
  sceneId?: string;
  sceneIds?: string[];
  objectCount?: number | [number, number];
  targetCount?: number | [number, number];
  questionsPerRound?: number;
  seed?: string;
  practice?: boolean;
  targetScale?: number;
  camouflageStrength?: number;
  /** Swarm mode: how many copies of the repeated character to hide. */
  swarmCount?: number | [number, number];
  /** Category mode: which categories a round may ask for. */
  categories?: string[];
}
