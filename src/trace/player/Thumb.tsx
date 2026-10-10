/**
 * A trace item drawn small from its own strokes — no picture needed, so a
 * board of hundreds of items stays light. A colouring item made from a
 * picture shows its line art.
 */

import { strokePolyline } from "../geometry/bezier";
import type { TraceItem } from "../geometry/types";

export function ItemThumb({ item, className = "h-16 w-16" }: { item: TraceItem; className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden="true">
      {item.carrier && (
        <text x={item.carrier.box.x} y={item.carrier.box.y + item.carrier.box.h * 0.8} fontSize={item.carrier.box.h} fill="#d5d8e6" fontFamily='"Noto Sans Khmer", system-ui, sans-serif'>
          {item.carrier.text}
        </text>
      )}
      {/* A colouring picture: its line art, with any lines drawn on top. */}
      {item.activity === "color" && item.paint?.picture && !item.paint.picture.smooth && <image href={item.paint.picture.lines} x={0} y={0} width={1000} height={1000} />}
      {item.strokes.map((s) => {
        const pts = strokePolyline(s, 1);
        if (pts.length === 1) return <circle key={s.id} cx={pts[0].x} cy={pts[0].y} r={(s.radius ?? 20) + 6} fill="currentColor" />;
        return (
          <polyline
            key={s.id}
            points={pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={item.activity === "color" ? 18 : 48}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
