import React from "react";
import type { ShapeAssetType } from "./assetCatalog";

interface BuiltinShapeAssetProps {
  type: ShapeAssetType;
  size: number;
  className?: string;
}

const PALETTES: Record<ShapeAssetType, { light: string; mid: string; dark: string; accent: string }> = {
  apple: { light: "#FF7B8B", mid: "#F43F5E", dark: "#BE123C", accent: "#4ADE80" },
  star: { light: "#FFF38A", mid: "#FBBF24", dark: "#F59E0B", accent: "#FFF7C2" },
  dino: { light: "#86EFAC", mid: "#34D399", dark: "#059669", accent: "#FDE68A" },
  car: { light: "#7DD3FC", mid: "#3B82F6", dark: "#1D4ED8", accent: "#FDE047" },
  butterfly: { light: "#E9D5FF", mid: "#C084FC", dark: "#7C3AED", accent: "#F9A8D4" },
  fish: { light: "#67E8F9", mid: "#38BDF8", dark: "#2563EB", accent: "#FDE68A" },
  rocket: { light: "#F8FAFC", mid: "#CBD5E1", dark: "#64748B", accent: "#38BDF8" },
  bear: { light: "#D97706", mid: "#B45309", dark: "#78350F", accent: "#FCD34D" },
  sun: { light: "#FFF38A", mid: "#FBBF24", dark: "#F59E0B", accent: "#FFF7C2" },
  flower: { light: "#F9A8D4", mid: "#EC4899", dark: "#BE185D", accent: "#FDE047" },
  heart: { light: "#FB7185", mid: "#F43F5E", dark: "#BE123C", accent: "#FFE4E6" },
  // Indigo, to match the base-ten blocks the place-value canvases already draw.
  tenrod: { light: "#C7D2FE", mid: "#818CF8", dark: "#4338CA", accent: "#EEF2FF" },
};

/** Geometry of the ten-rod, in the shared 48-unit viewBox. See its `case` below. */
const ROD = { top: 4, bottom: 46, left: 15, right: 27, depth: 3.4 };

/**
 * Cohesive soft-3D artwork for Koda's original eleven countable shapes.
 * Stable shape ids stay in the catalog; only their renderer changes.
 */
export const BuiltinShapeAsset: React.FC<BuiltinShapeAssetProps> = ({ type, size, className = "" }) => {
  const scope = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const palette = PALETTES[type];
  const main = `${scope}-main`;
  const accent = `${scope}-accent`;
  const shine = `${scope}-shine`;

  const artwork = (() => {
    switch (type) {
      case "apple":
        return <>
          <ellipse cx="24" cy="42" rx="13" ry="3" fill="#881337" opacity=".14" />
          <path d="M25 13c1-6 5-9 10-9-1 6-4 10-10 10Z" fill={`url(#${accent})`} />
          <path d="M23 14c0-5 1-8 4-11" stroke="#713F12" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 15c-8-5-16 1-16 11 0 11 7 17 14 17 3 0 4-2 6-2s4 2 6 2c7 0 12-9 12-17 0-10-9-16-16-11-2 1-4 2-6 0Z" fill="#BE123C" opacity=".35" transform="translate(0 2)" />
          <path d="M24 13c-8-5-16 1-16 11 0 11 7 17 14 17 3 0 4-2 6-2s4 2 6 2c7 0 12-9 12-17 0-10-9-16-16-11-2 1-4 2-6 0Z" fill={`url(#${main})`} />
          <path d="M15 19c3-4 7-4 9-3-5 2-7 6-7 12-3-3-4-6-2-9Z" fill={`url(#${shine})`} opacity=".75" />
        </>;
      case "star":
        return <>
          <path d="m24 5 5.7 11.5 12.7 1.8-9.2 9 2.2 12.6L24 34l-11.4 5.9 2.2-12.6-9.2-9 12.7-1.8L24 5Z" fill="#B45309" opacity=".3" transform="translate(0 2)" />
          <path d="m24 3 5.7 11.5 12.7 1.8-9.2 9 2.2 12.6L24 32l-11.4 5.9 2.2-12.6-9.2-9 12.7-1.8L24 3Z" fill={`url(#${main})`} stroke="#F59E0B" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="m24 8 3.7 9.6 9.6 1.2-8 4.3L24 30l-1.2-13.2Z" fill={`url(#${shine})`} opacity=".75" />
        </>;
      case "dino":
        return <>
          <ellipse cx="25" cy="42" rx="17" ry="3" fill="#064E3B" opacity=".14" />
          <path d="m10 22-7 4 8 3Z" fill="#059669" />
          <path d="M13 19c4 0 8 2 10 5V13C23 5 29 3 35 5c6 2 7 8 7 15v8c0 8-5 12-13 12H14C6 40 4 34 7 27c1-4 3-7 6-8Z" fill="#047857" opacity=".3" transform="translate(0 2)" />
          <path d="M13 17c4 0 8 2 10 5V11C23 3 29 1 35 3c6 2 7 8 7 15v8c0 8-5 12-13 12H14C6 38 4 32 7 25c1-4 3-7 6-8Z" fill={`url(#${main})`} />
          <path d="m24 10-4-4 6-1m2-2 3-2 2 3m5 1 4 1-2 4" fill={palette.accent} stroke="#10B981" strokeWidth="1" strokeLinejoin="round" />
          <path d="M12 21c5-3 9 0 11 4-5-2-9-1-12 3-1-3-1-5 1-7Z" fill={`url(#${shine})`} opacity=".55" />
          <circle cx="34.5" cy="12" r="2.1" fill="#fff" /><circle cx="35.2" cy="12.3" r="1" fill="#172554" />
          <path d="M36 18c2 1 4 1 5 0" stroke="#047857" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M13 35v8m13-6v6" stroke="#047857" strokeWidth="5" strokeLinecap="round" />
        </>;
      case "car":
        return <>
          <ellipse cx="24" cy="39.5" rx="19" ry="3.2" fill="#172554" opacity=".15" />
          <path d="M7 22h4l5-9h15c4 0 7 4 9 9h2c3 0 5 3 5 6v7H3V27c0-3 1-5 4-5Z" fill="#1E40AF" opacity=".32" transform="translate(0 2)" />
          <path d="M7 20h4l5-9h15c4 0 7 4 9 9h2c3 0 5 3 5 6v7H3V25c0-3 1-5 4-5Z" fill={`url(#${main})`} />
          <path d="m18 13-4 7h11v-7Zm10 0v7h9c-2-4-4-7-7-7Z" fill="#E0F2FE" />
          <path d="m18 13-3 5h8l2-5Z" fill={`url(#${shine})`} opacity=".7" />
          <rect x="4" y="24" width="5" height="3" rx="1.5" fill="#FEF3C7" />
          <circle cx="13" cy="34" r="6" fill="#172554" /><circle cx="13" cy="34" r="2.7" fill="#94A3B8" /><circle cx="13" cy="33" r="1" fill="#E2E8F0" />
          <circle cx="37" cy="34" r="6" fill="#172554" /><circle cx="37" cy="34" r="2.7" fill="#94A3B8" /><circle cx="37" cy="33" r="1" fill="#E2E8F0" />
        </>;
      case "butterfly":
        return <>
          <ellipse cx="24" cy="42" rx="12" ry="2.5" fill="#581C87" opacity=".12" />
          <path d="M22 14C17 5 5 5 4 15c-1 7 4 10 10 10-7 4-7 13 0 15 6 2 9-7 10-13Z" fill="#7C3AED" opacity=".25" transform="translate(0 2)" />
          <path d="M26 14c5-9 17-9 18 1 1 7-4 10-10 10 7 4 7 13 0 15-6 2-9-7-10-13Z" fill="#7C3AED" opacity=".25" transform="translate(0 2)" />
          <path d="M22 12C17 3 5 3 4 13c-1 7 4 10 10 10-7 4-7 13 0 15 6 2 9-7 10-13Z" fill={`url(#${main})`} />
          <path d="M26 12c5-9 17-9 18 1 1 7-4 10-10 10 7 4 7 13 0 15-6 2-9-7-10-13Z" fill={`url(#${main})`} />
          <path d="M9 11c4-4 9-2 12 5-5-3-9-2-12 1-1-2-1-4 0-6Zm30 0c-4-4-9-2-12 5 5-3 9-2 12 1 1-2 1-4 0-6Z" fill={`url(#${shine})`} opacity=".65" />
          <circle cx="12" cy="29" r="3" fill={palette.accent} opacity=".8" /><circle cx="36" cy="29" r="3" fill={palette.accent} opacity=".8" />
          <ellipse cx="24" cy="25" rx="3.2" ry="14" fill="#5B21B6" />
          <path d="M22 11c-3-4-5-5-7-5m11 5c3-4 5-5 7-5" stroke="#5B21B6" strokeWidth="1.8" strokeLinecap="round" />
        </>;
      case "fish":
        return <>
          <ellipse cx="27" cy="39" rx="16" ry="2.5" fill="#1E40AF" opacity=".12" />
          <path d="M13 20 3 12v24l10-8Z" fill="#1D4ED8" />
          <path d="M10 25C17 12 29 8 39 13c7 4 8 10 8 11s-1 8-8 12c-10 5-22 1-29-11Z" fill="#1D4ED8" opacity=".3" transform="translate(0 2)" />
          <path d="M10 23C17 10 29 6 39 11c7 4 8 10 8 11s-1 8-8 12c-10 5-22 1-29-11Z" fill={`url(#${main})`} />
          <path d="M18 14c7-5 15-4 20-1-7 0-12 4-16 10-4-2-6-5-4-9Z" fill={`url(#${shine})`} opacity=".75" />
          <path d="m24 31 8 8 4-8Z" fill="#2563EB" opacity=".75" />
          <circle cx="38" cy="19" r="3" fill="#fff" /><circle cx="39" cy="19.5" r="1.3" fill="#172554" />
          <path d="M42 26c-2 1-3 1-5 0" stroke="#1D4ED8" strokeWidth="1.4" strokeLinecap="round" />
        </>;
      case "rocket":
        return <>
          <ellipse cx="24" cy="44" rx="10" ry="2.5" fill="#334155" opacity=".12" />
          <path d="m18 35-7 8 2-13 6-5Zm12 0 7 8-2-13-6-5Z" fill="#E11D48" />
          <path d="M24 3C16 9 14 19 16 31c1 6 4 9 8 12 4-3 7-6 8-12 2-12 0-22-8-28Z" fill="#475569" opacity=".3" transform="translate(0 2)" />
          <path d="M24 2C16 8 14 18 16 30c1 6 4 9 8 12 4-3 7-6 8-12 2-12 0-22-8-28Z" fill={`url(#${main})`} />
          <path d="M24 2c-4 7-5 18-3 29 1 4 2 7 3 10-4-3-7-6-8-11-2-12 0-22 8-28Z" fill={`url(#${shine})`} opacity=".7" />
          <circle cx="24" cy="19" r="6" fill="#475569" /><circle cx="24" cy="19" r="4.2" fill={palette.accent} /><circle cx="22.5" cy="17.5" r="1.5" fill="#E0F2FE" opacity=".9" />
          <path d="m20 41 4 7 4-7Z" fill="#F97316" /><path d="m22 41 2 5 2-5Z" fill="#FDE047" />
        </>;
      case "bear":
        return <>
          <ellipse cx="24" cy="42" rx="15" ry="3" fill="#451A03" opacity=".14" />
          <circle cx="10" cy="12" r="8" fill="#78350F" /><circle cx="38" cy="12" r="8" fill="#78350F" />
          <circle cx="10" cy="12" r="4" fill="#F59E0B" opacity=".65" /><circle cx="38" cy="12" r="4" fill="#F59E0B" opacity=".65" />
          <path d="M24 7c12 0 19 8 19 18 0 12-8 18-19 18S5 37 5 25C5 15 12 7 24 7Z" fill="#78350F" opacity=".3" transform="translate(0 2)" />
          <path d="M24 5c12 0 19 8 19 18 0 12-8 18-19 18S5 35 5 23C5 13 12 5 24 5Z" fill={`url(#${main})`} />
          <path d="M12 13c5-6 13-6 17-3-8 1-13 6-15 14-4-3-5-7-2-11Z" fill={`url(#${shine})`} opacity=".5" />
          <circle cx="17" cy="21" r="2.2" fill="#291505" /><circle cx="31" cy="21" r="2.2" fill="#291505" />
          <ellipse cx="24" cy="30" rx="9" ry="7" fill="#FCD18B" />
          <path d="M20.5 28c0-3 7-3 7 0 0 2-2 3-3.5 3S20.5 30 20.5 28Z" fill="#3F1D0B" />
          <path d="M24 31c0 3-4 4-5 1m5-1c0 3 4 4 5 1" stroke="#78350F" strokeWidth="1.4" strokeLinecap="round" />
        </>;
      case "sun":
        return <>
          <g stroke="#F59E0B" strokeWidth="4" strokeLinecap="round">
            <path d="M24 2v5M24 41v5M2 24h5M41 24h5M8.5 8.5l3.7 3.7M35.8 35.8l3.7 3.7M8.5 39.5l3.7-3.7M35.8 12.2l3.7-3.7" />
          </g>
          <circle cx="24" cy="26" r="15" fill="#B45309" opacity=".22" />
          <circle cx="24" cy="23" r="15" fill={`url(#${main})`} />
          <ellipse cx="19" cy="16" rx="7" ry="5" fill={`url(#${shine})`} opacity=".72" />
          <circle cx="19" cy="23" r="1.8" fill="#92400E" /><circle cx="29" cy="23" r="1.8" fill="#92400E" />
          <path d="M19 29c3 3 7 3 10 0" stroke="#92400E" strokeWidth="1.8" strokeLinecap="round" />
        </>;
      case "flower":
        return <>
          <ellipse cx="24" cy="42" rx="13" ry="2.6" fill="#831843" opacity=".12" />
          <g fill="#BE185D" opacity=".3" transform="translate(0 2)">
            <ellipse cx="24" cy="11" rx="8" ry="10" /><ellipse cx="24" cy="35" rx="8" ry="10" />
            <ellipse cx="12" cy="23" rx="10" ry="8" /><ellipse cx="36" cy="23" rx="10" ry="8" />
          </g>
          <g fill={`url(#${main})`}>
            <ellipse cx="24" cy="9" rx="8" ry="9" /><ellipse cx="24" cy="33" rx="8" ry="9" />
            <ellipse cx="12" cy="21" rx="10" ry="8" /><ellipse cx="36" cy="21" rx="10" ry="8" />
          </g>
          <g fill={`url(#${shine})`} opacity=".55">
            <ellipse cx="21" cy="6" rx="3" ry="4" /><ellipse cx="9" cy="18" rx="4" ry="3" /><ellipse cx="33" cy="18" rx="4" ry="3" />
          </g>
          <circle cx="24" cy="23" r="8" fill="#D97706" opacity=".3" />
          <circle cx="24" cy="21" r="8" fill={`url(#${accent})`} />
          <circle cx="21" cy="18" r="2.2" fill="#FFF7C2" opacity=".85" />
        </>;
      case "heart":
        return <>
          <ellipse cx="24" cy="43" rx="14" ry="2.8" fill="#881337" opacity=".13" />
          <path d="M24 42 8 27C-1 18 4 6 14 6c5 0 8 3 10 7 2-4 5-7 10-7 10 0 15 12 6 21Z" fill="#9F1239" opacity=".35" transform="translate(0 2)" />
          <path d="M24 40 8 25C-1 16 4 4 14 4c5 0 8 3 10 7 2-4 5-7 10-7 10 0 15 12 6 21Z" fill={`url(#${main})`} />
          <path d="M9 10c4-5 10-3 13 2-5-2-9 1-11 6-3-2-4-5-2-8Z" fill={`url(#${shine})`} opacity=".8" />
        </>;
      /*
        A base-ten rod: ten cubes stacked into one stick, standing up.

        Standing rather than lying down because that is how a child meets a rod
        on paper and in a tray of blocks — a row of upright sticks reads as
        "how many tens", where a row of lying ones reads as one long ruler.

        The ten divisions are the artwork. A plain bar wearing a "10" is a
        numeral with a box around it; the child has to be able to *see* the ten,
        and to check it by counting the cubes if they do not believe it yet. So
        the divisions are drawn on both visible faces, at the pitch the cubes
        actually have, and the rod's length is ten of them by construction.
      */
      case "tenrod": {
        const { top, bottom, left, right, depth } = ROD;
        const cell = (bottom - top) / 10;
        return <>
          <ellipse cx="24" cy="46.6" rx="8.5" ry="1.3" fill="#312E81" opacity=".16" />
          {/* The two faces that make it a solid rather than a stripe. */}
          <path d={`M${right} ${top}l${depth} ${-depth}v${bottom - top}l${-depth} ${depth}Z`} fill={palette.dark} />
          <path d={`M${left} ${top}l${depth} ${-depth}h${right - left}l${-depth} ${depth}Z`} fill={`url(#${accent})`} />
          <rect x={left} y={top} width={right - left} height={bottom - top} fill={`url(#${main})`} />
          {Array.from({ length: 9 }, (_, i) => {
            const y = top + cell * (i + 1);
            return <path
              key={i}
              d={`M${left} ${y}h${right - left}l${depth} ${-depth}`}
              fill="none"
              stroke={palette.dark}
              strokeWidth=".8"
              opacity=".45"
            />;
          })}
          <path d={`M${left + 1.6} ${top + 1.6}v${bottom - top - 3.2}`} stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity=".4" />
          <path
            d={`M${left} ${top}l${depth} ${-depth}h${right - left}v${bottom - top}l${-depth} ${depth}h${left - right}Z`}
            fill="none"
            stroke={palette.dark}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <path d={`M${right} ${top}v${bottom - top}m0 ${top - bottom}l${depth} ${-depth}`} stroke={palette.dark} strokeWidth="1.1" strokeLinejoin="round" />
        </>;
      }
    }
  })();

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={main} x1="9" y1="7" x2="39" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor={palette.light} />
          <stop offset=".52" stopColor={palette.mid} />
          <stop offset="1" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={accent} x1="17" y1="7" x2="34" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor={palette.accent} />
          <stop offset="1" stopColor={palette.dark} />
        </linearGradient>
        <radialGradient id={shine} cx="0" cy="0" r="1" gradientTransform="translate(15 10) rotate(48) scale(27 25)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity=".95" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {artwork}
    </svg>
  );
};
