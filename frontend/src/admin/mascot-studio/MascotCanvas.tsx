import React from "react";
import { KodaSvgLayer, mascotGroupTransform } from "../../features/koda-mascot/KodaSvgRenderer";
import type { MascotAnchor, MascotAssetDefinition, MascotDocument, MascotGroup, MascotLayer } from "./types";

interface MascotCanvasProps {
  document: MascotDocument;
  selectedLayerId: string | null;
  selectedGroupId?: string | null;
  selectedAnchorId?: string | null;
  playing: boolean;
  onSelectLayer?: (id: string) => void;
  onSelectGroup?: (id: string) => void;
  onSelectAnchor?: (id: string) => void;
  onMoveLayer?: (id: string, x: number, y: number) => void;
  onLayerContextMenu?: (id: string, position: { x: number; y: number }) => void;
  svgRef?: React.Ref<SVGSVGElement>;
  assets?: MascotAssetDefinition[];
}

export const MascotCanvas: React.FC<MascotCanvasProps> = ({ document, selectedLayerId, selectedGroupId, selectedAnchorId, playing, onSelectLayer, onSelectGroup, onSelectAnchor, onMoveLayer, onLayerContextMenu, svgRef, assets }) => {
  const [drag, setDrag] = React.useState<{ id: string; pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 256 / rect.width, y: (event.clientY - rect.top) * 256 / rect.height };
  };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || event.pointerId !== drag.pointerId || !onMoveLayer) return;
    const next = point(event);
    onMoveLayer(drag.id, Math.round(next.x - drag.offsetX), Math.round(next.y - drag.offsetY));
  };
  const groups = document.groups ?? [];
  const anchors = document.anchors ?? [];
  const validGroupIds = new Set(groups.map((group) => group.id));

  const anchorMarker = (anchor: MascotAnchor) => <g key={anchor.id} data-mascot-editor="anchor" transform={`translate(${anchor.x} ${anchor.y})`} onPointerDown={(event) => { event.stopPropagation(); onSelectAnchor?.(anchor.id); }} className="cursor-pointer"><circle r="6" fill={selectedAnchorId === anchor.id ? "#534AB7" : "#FFFFFF"} stroke="#534AB7" strokeWidth="2" vectorEffect="non-scaling-stroke"/><path d="M-9 0H9M0-9V9" stroke="#534AB7" strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>;

  const renderLayer = (layer: MascotLayer) => {
    const selected = selectedLayerId === layer.id;
    return <KodaSvgLayer key={layer.id} document={document} layer={layer} playing={playing} assets={assets} editorLayerId={layer.id} groupProps={{ onPointerDown: (event) => {
      event.stopPropagation();
      onSelectLayer?.(layer.id);
      if (!onMoveLayer || layer.parentId) return;
      const svg = event.currentTarget.ownerSVGElement;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = (event.clientX - rect.left) * 256 / rect.width;
      const y = (event.clientY - rect.top) * 256 / rect.height;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ id: layer.id, pointerId: event.pointerId, offsetX: x - layer.x, offsetY: y - layer.y });
    }, onContextMenu: onLayerContextMenu ? (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDrag(null);
      onSelectLayer?.(layer.id);
      onLayerContextMenu(layer.id, { x: event.clientX, y: event.clientY });
    } : undefined, className: onMoveLayer ? "cursor-grab active:cursor-grabbing" : undefined }}>
      {selected && onMoveLayer && <rect data-mascot-editor="selection" x="3" y="3" width="122" height="122" rx="8" fill="none" stroke="#534AB7" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke"/>}
    </KodaSvgLayer>;
  };

  const renderGroup = (group: MascotGroup, ancestors: Set<string>): React.ReactNode => {
    if (!group.visible || ancestors.has(group.id)) return null;
    const nextAncestors = new Set(ancestors).add(group.id);
    return <g key={group.id} transform={mascotGroupTransform(group)} opacity={group.opacity} data-mascot-group-id={group.id} onDoubleClick={(event) => { event.stopPropagation(); onSelectGroup?.(group.id); }}>
      {groups.filter((child) => child.parentId === group.id).map((child) => renderGroup(child, nextAncestors))}
      {document.layers.filter((layer) => layer.parentId === group.id).map(renderLayer)}
      {anchors.filter((anchor) => anchor.parentId === group.id).map(anchorMarker)}
      {selectedGroupId === group.id && <g data-mascot-editor="group-pivot" transform={`translate(${group.pivot.x} ${group.pivot.y})`}><circle r="10" fill="none" stroke="#EF9F27" strokeWidth="2" strokeDasharray="3 2" vectorEffect="non-scaling-stroke"/><path d="M-13 0H13M0-13V13" stroke="#EF9F27" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></g>}
    </g>;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={document.canvas.viewBox}
      role="img"
      aria-label={`${document.name} mascot preview`}
      className="h-full w-full touch-none select-none"
      onPointerMove={move}
      onPointerUp={(event) => { if (drag?.pointerId === event.pointerId) setDrag(null); }}
      onPointerCancel={() => setDrag(null)}
    >
      <title>{document.name}</title>
      {groups.filter((group) => !group.parentId || !validGroupIds.has(group.parentId)).map((group) => renderGroup(group, new Set()))}
      {document.layers.filter((layer) => !layer.parentId || !validGroupIds.has(layer.parentId)).map(renderLayer)}
      {anchors.filter((anchor) => !anchor.parentId || !validGroupIds.has(anchor.parentId)).map(anchorMarker)}
    </svg>
  );
};
