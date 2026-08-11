import React from "react";
import { MASCOT_ASSETS, MascotAssetArt } from "./catalog";
import type { MascotAssetDefinition, MascotDocument, MascotGroup, MascotLayer } from "./types";

const gradientPaletteField = (layer: MascotLayer): "primary" | "secondary" | "ink" => {
  if (layer.category === "pattern") return "secondary";
  if (layer.category === "eyes" || layer.category === "pupil" || layer.category === "mouth" || layer.category === "head") return "ink";
  return "primary";
};

export const mascotGradientVector = (angle: number) => {
  const radians = (angle * Math.PI) / 180;
  const x = Math.cos(radians) * 50;
  const y = Math.sin(radians) * 50;
  return { x1: `${50 - x}%`, y1: `${50 - y}%`, x2: `${50 + x}%`, y2: `${50 + y}%` };
};

export const mascotGroupTransform = (group: MascotGroup): string =>
  `translate(${group.x} ${group.y}) translate(${group.pivot.x} ${group.pivot.y}) rotate(${group.rotation}) scale(${group.scale * (group.scaleX ?? 1)} ${group.scale * (group.scaleY ?? 1)}) translate(${-group.pivot.x} ${-group.pivot.y})`;

export const defaultLayerAnimationIntensity = (animation: MascotLayer["animation"]): number => {
  if (animation === "float" || animation === "wiggle") return 5;
  if (animation === "pulse") return 25;
  if (animation === "blink") return 88;
  if (animation === "look") return 4;
  if (animation === "spin") return 360;
  return 10;
};

const easingAttributes = (layer: MascotLayer, segments: number) => {
  const feel = layer.animationFeel ?? "smooth";
  if (feel === "linear") return { calcMode: "linear" as const };
  const curve = feel === "snappy" ? ".2 .8 .2 1" : feel === "spring" ? ".16 1 .3 1" : ".42 0 .58 1";
  return { calcMode: "spline" as const, keySplines: Array.from({ length: segments }, () => curve).join(";") };
};

export const KodaLayerAnimation: React.FC<{ layer: MascotLayer; playing: boolean }> = ({ layer, playing }) => {
  if (!playing || layer.animation === "none") return null;
  const duration = `${Math.max(0.2, layer.duration)}s`;
  const begin = `${Math.max(0, layer.delay)}s`;
  const amount = Math.max(0, layer.animationIntensity ?? defaultLayerAnimationIntensity(layer.animation));
  const spring = layer.animationFeel === "spring";

  if (layer.animation === "bounce") return spring
    ? <animateTransform attributeName="transform" additive="sum" type="translate" values={`0 0;0 ${-amount};0 ${amount * .12};0 ${-amount * .04};0 0`} keyTimes="0;.34;.62;.8;1" {...easingAttributes(layer, 4)} dur={duration} begin={begin} repeatCount="indefinite" />
    : <animateTransform attributeName="transform" additive="sum" type="translate" values={`0 0;0 ${-amount};0 0`} keyTimes="0;.5;1" {...easingAttributes(layer, 2)} dur={duration} begin={begin} repeatCount="indefinite" />;
  if (layer.animation === "float") return <animateTransform attributeName="transform" additive="sum" type="translate" values={`0 ${-amount};0 ${amount};0 ${-amount}`} keyTimes="0;.5;1" {...easingAttributes(layer, 2)} dur={duration} begin={begin} repeatCount="indefinite" />;
  if (layer.animation === "look") return <animateTransform attributeName="transform" additive="sum" type="translate" values={`0 0;${amount} 0;${amount * .45} ${amount * .35};${-amount * .75} ${amount * .18};${-amount * .35} ${-amount * .4};0 0`} keyTimes="0;.18;.38;.6;.8;1" {...easingAttributes(layer, 5)} dur={duration} begin={begin} repeatCount="indefinite" />;
  if (layer.animation === "wiggle") return spring
    ? <animateTransform attributeName="transform" additive="sum" type="rotate" values={`${-amount} 64 64;${amount} 64 64;${-amount * .45} 64 64;${amount * .18} 64 64;${-amount} 64 64`} keyTimes="0;.28;.56;.76;1" {...easingAttributes(layer, 4)} dur={duration} begin={begin} repeatCount="indefinite" />
    : <animateTransform attributeName="transform" additive="sum" type="rotate" values={`${-amount} 64 64;${amount} 64 64;${-amount} 64 64`} keyTimes="0;.5;1" {...easingAttributes(layer, 2)} dur={duration} begin={begin} repeatCount="indefinite" />;
  if (layer.animation === "spin") return <animateTransform attributeName="transform" additive="sum" type="rotate" values={`0 64 64;${amount} 64 64`} dur={duration} begin={begin} repeatCount="indefinite" calcMode={layer.animationFeel === "snappy" ? "spline" : "linear"} keySplines={layer.animationFeel === "snappy" ? ".2 .8 .2 1" : undefined}/>;
  if (layer.animation === "pulse") return <animate attributeName="opacity" values={`${layer.opacity};${Math.max(0.1, layer.opacity - amount / 100)};${layer.opacity}`} keyTimes="0;.5;1" {...easingAttributes(layer, 2)} dur={duration} begin={begin} repeatCount="indefinite" />;
  if (layer.animation === "blink") return <animateTransform attributeName="transform" additive="sum" type="scale" values={`1 1;1 1;1 ${Math.max(.03, 1 - amount / 100)};1 1`} keyTimes="0;0.84;0.9;1" {...easingAttributes(layer, 3)} dur={duration} begin={begin} repeatCount="indefinite" />;
  return null;
};

interface KodaSvgLayerProps {
  document: MascotDocument;
  layer: MascotLayer;
  playing: boolean;
  groupProps?: React.SVGProps<SVGGElement>;
  assets?: MascotAssetDefinition[];
  editorLayerId?: string;
  children?: React.ReactNode;
}

export const KodaSvgLayer: React.FC<KodaSvgLayerProps> = ({ document, layer, playing, groupProps, assets = MASCOT_ASSETS, editorLayerId, children }) => {
  if (!layer.visible) return null;
  const asset = assets.find((entry) => entry.id === layer.assetId);
  if (!asset) return null;
  const gradient = !asset.markup ? layer.gradient : undefined;
  const gradientId = `mascot-gradient-${layer.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const palette = gradient
    ? { ...document.palette, [gradientPaletteField(layer)]: `url(#${gradientId})` }
    : document.palette;

  return (
    <g
      {...groupProps}
      data-mascot-layer-id={editorLayerId}
      transform={`translate(${layer.x} ${layer.y}) rotate(${layer.rotation}) scale(${layer.scale * (layer.scaleX ?? 1)} ${layer.scale * (layer.scaleY ?? 1)}) translate(-64 -64)`}
      opacity={layer.opacity}
    >
      {gradient && <defs><linearGradient id={gradientId} {...mascotGradientVector(gradient.angle)}><stop offset="0%" stopColor={gradient.start}/><stop offset="100%" stopColor={gradient.end}/></linearGradient></defs>}
      <KodaLayerAnimation layer={layer} playing={playing} />
      <MascotAssetArt asset={asset} palette={palette} outline={layer.outline !== false} />
      {children}
    </g>
  );
};

export interface KodaSvgRendererProps {
  document: MascotDocument;
  playing?: boolean;
  size?: number;
  className?: string;
  title?: string;
  svgRef?: React.Ref<SVGSVGElement>;
  assets?: MascotAssetDefinition[];
}

interface KodaSvgSceneProps {
  document: MascotDocument;
  playing: boolean;
  assets: MascotAssetDefinition[];
}

export const KodaSvgScene: React.FC<KodaSvgSceneProps> = ({ document, playing, assets }) => {
  const groups = document.groups ?? [];
  const validGroupIds = new Set(groups.map((group) => group.id));
  const renderGroup = (group: MascotGroup, ancestors: Set<string>): React.ReactNode => {
    if (!group.visible || ancestors.has(group.id)) return null;
    const nextAncestors = new Set(ancestors).add(group.id);
    return (
      <g key={group.id} transform={mascotGroupTransform(group)} opacity={group.opacity} data-mascot-group-id={group.id}>
        {groups.filter((child) => child.parentId === group.id).map((child) => renderGroup(child, nextAncestors))}
        {document.layers.filter((layer) => layer.parentId === group.id).map((layer) => <KodaSvgLayer key={layer.id} document={document} layer={layer} playing={playing} assets={assets}/>) }
      </g>
    );
  };

  return <>{groups.filter((group) => !group.parentId || !validGroupIds.has(group.parentId)).map((group) => renderGroup(group, new Set()))}{document.layers.filter((layer) => !layer.parentId || !validGroupIds.has(layer.parentId)).map((layer) => <KodaSvgLayer key={layer.id} document={document} layer={layer} playing={playing} assets={assets}/>)}</>;
};

/** Pure, editor-free renderer for saved mascot documents. */
export const KodaSvgRenderer: React.FC<KodaSvgRendererProps> = ({
  document,
  playing = true,
  size,
  className,
  title = document.name,
  svgRef,
  assets = MASCOT_ASSETS,
}) => (
  <svg
    ref={svgRef}
    viewBox={document.canvas.viewBox}
    width={size}
    height={size}
    role="img"
    aria-label={title}
    className={className}
  >
    <title>{title}</title>
    <KodaSvgScene document={document} playing={playing} assets={assets}/>
  </svg>
);
