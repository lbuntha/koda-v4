export type MascotPartCategory = "body" | "head" | "eyes" | "pupil" | "mouth" | "pattern" | "accessory";

export type MascotAnimation = "none" | "bounce" | "float" | "wiggle" | "pulse" | "blink" | "look" | "spin";
export type MascotMotionFeel = "linear" | "smooth" | "snappy" | "spring";

export type MascotPurpose = "happy" | "welcome" | "sad" | "excited" | "loading" | "waiting" | "custom";

export interface MascotBehavior {
  animation: Exclude<MascotAnimation, "blink" | "look">;
  duration: number;
  intensity: number;
  loop: boolean;
  spring: { stiffness: number; damping: number; mass: number };
}

export interface MascotPalette {
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
  white: string;
}

export interface MascotPoint {
  x: number;
  y: number;
}

export interface MascotGradient {
  kind: "linear";
  start: string;
  end: string;
  /** Direction in degrees: 0 is left-to-right and 90 is top-to-bottom. */
  angle: number;
}

export interface MascotLayer {
  id: string;
  assetId: string;
  category: MascotPartCategory;
  name: string;
  x: number;
  y: number;
  scale: number;
  /** Optional axis multipliers used by expressive squash/stretch animation. */
  scaleX?: number;
  scaleY?: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  /** Built-in body artwork keeps its outline unless explicitly disabled. */
  outline?: boolean;
  /** Optional per-part fill applied to the dominant palette color for this category. */
  gradient?: MascotGradient;
  animation: MascotAnimation;
  /** User-authored distance, angle, fade, or blink amount for built-in motion. */
  animationIntensity?: number;
  animationFeel?: MascotMotionFeel;
  duration: number;
  delay: number;
  /** Reserved for rigging without changing existing saved documents. */
  parentId?: string | null;
  /** Rotation/physics anchor in the asset's local 128 × 128 coordinate space. */
  pivot?: MascotPoint;
}

export interface MascotGroup {
  id: string;
  name: string;
  parentId?: string | null;
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  pivot: MascotPoint;
}

export interface MascotAnchor {
  id: string;
  name: string;
  x: number;
  y: number;
  parentId?: string | null;
}

export type MascotKeyframeEasing = "linear" | "easeIn" | "easeOut" | "easeInOut";
export type MascotKeyframeTarget = "layer" | "group";

export interface MascotKeyframe {
  id: string;
  time: number;
  targetType: MascotKeyframeTarget;
  targetId: string;
  easing: MascotKeyframeEasing;
  values: Partial<Pick<MascotLayer, "x" | "y" | "scale" | "scaleX" | "scaleY" | "rotation" | "opacity">>;
}

export interface MascotAnimationClip {
  id: string;
  name: string;
  duration: number;
  loop: boolean;
  keyframes: MascotKeyframe[];
}

export interface MascotDocument {
  schemaVersion: 1;
  starterVersion?: number;
  id: string;
  name: string;
  slug: string;
  purpose: MascotPurpose;
  description: string;
  tags: string[];
  canvas: { width: 256; height: 256; viewBox: "0 0 256 256" };
  palette: MascotPalette;
  behavior?: MascotBehavior;
  groups?: MascotGroup[];
  anchors?: MascotAnchor[];
  clips?: MascotAnimationClip[];
  activeClipId?: string | null;
  layers: MascotLayer[];
  createdAt: string;
  updatedAt: string;
}

export interface MascotAssetDefinition {
  id: string;
  name: string;
  category: MascotPartCategory;
  /** Sanitized at render time; present only for author-managed SVG library parts. */
  markup?: string;
  markupScale?: number;
}
