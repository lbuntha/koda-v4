import React from "react";
import { CUSTOM_SVG_OBJECT_PLACEHOLDER } from "../types";
import { useSvgLibrary } from "../assets/SvgLibraryContext";
import { sanitizeSvgMarkup } from "../assets/svgSafety";
import { scopeSvgIds } from "../assets/svgIds";

/**
 * Single source of truth for the built-in drawable vector shapes. The panel
 * dropdowns and the AssetType union are both derived from this list, so adding
 * a new shape (plus its `case` in CountingAsset's switch) is the only edit
 * needed for it to appear everywhere — nothing is hardcoded per-panel.
 */
export const ASSET_SHAPES = [
  { type: "apple", label: "Apple", emoji: "🍎" },
  { type: "star", label: "Star", emoji: "⭐" },
  { type: "dino", label: "Dino", emoji: "🦕" },
  { type: "car", label: "Car", emoji: "🚗" },
  { type: "butterfly", label: "Butterfly", emoji: "🦋" },
  { type: "fish", label: "Fish", emoji: "🐟" },
  { type: "rocket", label: "Rocket", emoji: "🚀" },
  { type: "bear", label: "Bear", emoji: "🧸" },
  { type: "sun", label: "Sun", emoji: "☀️" },
  { type: "flower", label: "Flower", emoji: "🌸" },
  { type: "heart", label: "Heart", emoji: "❤️" },
] as const;

export type ShapeAssetType = (typeof ASSET_SHAPES)[number]["type"];
export type AssetType = "emoji" | ShapeAssetType | "custom_svg";

interface AssetProps {
  type: AssetType;
  emoji?: string;
  size?: number;
  className?: string;
  customSvgMarkup?: string;
  scale?: number;
}

export const CountingAsset: React.FC<AssetProps> = ({ type, emoji, size = 48, className = "", customSvgMarkup, scale }) => {
  const svgScope = React.useId();
  const { overrides } = useSvgLibrary();
  // Built-in shapes automatically consume the account's shared Mongo-backed override.
  if (type !== "emoji" && type !== "custom_svg") {
    const override = overrides[type];
    const safeOverrideMarkup = override ? scopeSvgIds(sanitizeSvgMarkup(override.markup), svgScope) : "";
    if (override && safeOverrideMarkup) {
      const activeScale = scale !== undefined ? scale : (override.scale !== undefined ? override.scale : 1.0);
      const finalSize = size * activeScale;
      return (
        <div 
          className={`custom-svg-container flex items-center justify-center pointer-events-none select-none ${className}`}
          style={{ width: `${finalSize}px`, height: `${finalSize}px` }}
          dangerouslySetInnerHTML={{ __html: safeOverrideMarkup }}
        />
      );
    }
  }

  if (type === "custom_svg") {
    const markup = scopeSvgIds(sanitizeSvgMarkup(customSvgMarkup || CUSTOM_SVG_OBJECT_PLACEHOLDER.emoji || emoji || ""), svgScope);
    if (!markup) return null;
    const activeScale = scale !== undefined ? scale : (CUSTOM_SVG_OBJECT_PLACEHOLDER.scale || 1.0);
    const finalSize = size * activeScale;
    return (
      <div 
        className={`custom-svg-container flex items-center justify-center pointer-events-none select-none ${className}`}
        style={{ width: `${finalSize}px`, height: `${finalSize}px` }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }

  if (type === "emoji") {
    const isAlphanumeric = emoji && /^[a-zA-Z0-9\s\-+*/=?]+$/.test(emoji);
    if (isAlphanumeric) {
      return (
        <div 
          className={`flex items-center justify-center font-black rounded-2xl shadow-sm border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-950 transition-all text-center select-none pointer-events-none ${className}`}
          style={{ 
            width: `${size}px`, 
            height: `${size}px`, 
            fontSize: emoji.length > 2 ? `${size * 0.38}px` : `${size * 0.48}px`,
            fontFamily: "'Outfit', 'Inter', sans-serif",
            lineHeight: 1
          }}
        >
          {emoji}
        </div>
      );
    }

    return (
      <span 
        className={`select-none pointer-events-none leading-none ${className}`}
        style={{ fontSize: `${size * 0.8}px` }}
      >
        {emoji || "🍎"}
      </span>
    );
  }

  const color = "currentColor";

  switch (type) {
    case "apple":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M12 5C12 5 13 2 15 2C17 2 18 3 18 5C18 7 16 8 14 8C12 8 12 5 12 5Z" fill="#4ADE80" />
          <path d="M12 21C9.5 21 7 19.5 6 17C5 14.5 5 11.5 6.5 9.5C8 7.5 10.5 7 12 7C13.5 7 16 7.5 17.5 9.5C19 11.5 19 14.5 18 17C17 19.5 14.5 21 12 21Z" fill="#EF4444" />
          <path d="M12 21C11.5 21 11 20.9 10.5 20.7C10.5 20.7 11.2 19.5 12 19.5C12.8 19.5 13.5 20.7 13.5 20.7C13 20.9 12.5 21 12 21Z" fill="#B91C1C" />
        </svg>
      );
    case "star":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1" />
        </svg>
      );
    case "bear":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="7" cy="7" r="4" fill="#92400E" />
          <circle cx="17" cy="7" r="4" fill="#92400E" />
          <path d="M12 22C17.5 22 21 18.5 21 13C21 7.5 17.5 5 12 5C6.5 5 3 7.5 3 13C3 18.5 6.5 22 12 22Z" fill="#B45309" />
          <circle cx="8.5" cy="12" r="1.5" fill="black" />
          <circle cx="15.5" cy="12" r="1.5" fill="black" />
          <ellipse cx="12" cy="16" rx="3" ry="2" fill="#D97706" />
          <circle cx="12" cy="15.5" r="0.5" fill="black" />
        </svg>
      );
    case "fish":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M22 12C22 15 19 18 15 18C11 18 8 15 8 12C8 9 11 6 15 6C19 6 22 9 22 12Z" fill="#3B82F6" />
          <path d="M2 8L9 12L2 16V8Z" fill="#2563EB" />
          <circle cx="18" cy="11" r="1" fill="white" />
          <circle cx="18.5" cy="11" r="0.5" fill="black" />
        </svg>
      );
    case "rocket":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M12 2C12 2 16 6 16 12C16 18 12 22 12 22C12 22 8 18 8 12C8 6 12 2 12 2Z" fill="#94A3B8" />
          <path d="M12 2C12 2 11 6 11 10C11 14 12 18 12 18C12 18 13 14 13 10C13 6 12 2 12 2Z" fill="#CBD5E1" />
          <path d="M16 12L20 18L16 20V12Z" fill="#EF4444" />
          <path d="M8 12L4 18L8 20V12Z" fill="#EF4444" />
          <circle cx="12" cy="8" r="1.5" fill="#38BDF8" stroke="#0EA5E9" strokeWidth="1" />
          <path d="M10 22L12 24L14 22H10Z" fill="#F97316" />
        </svg>
      );
    case "car":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M4 11H20V15H4V11Z" fill="#3B82F6" />
          <path d="M6 7H14L17 11H4L6 7Z" fill="#60A5FA" />
          <circle cx="7" cy="15" r="2.5" fill="#1E293B" />
          <circle cx="7" cy="15" r="1" fill="#94A3B8" />
          <circle cx="17" cy="15" r="2.5" fill="#1E293B" />
          <circle cx="17" cy="15" r="1" fill="#94A3B8" />
          <rect x="18" y="12" width="2" height="1" fill="#FDE047" />
        </svg>
      );
    case "butterfly":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M12 8C12 8 15 4 19 4C22 4 22 8 19 12C22 16 22 20 19 20C15 20 12 16 12 16V8Z" fill="#D8B4FE" stroke="#A855F7" strokeWidth="1" />
          <path d="M12 8C12 8 9 4 5 4C2 4 2 8 5 12C2 16 2 20 5 20C9 20 12 16 12 16V8Z" fill="#D8B4FE" stroke="#A855F7" strokeWidth="1" />
          <ellipse cx="12" cy="12" rx="1.5" ry="6" fill="#581C87" />
          <circle cx="17" cy="8" r="1.5" fill="#A855F7" />
          <circle cx="7" cy="8" r="1.5" fill="#A855F7" />
        </svg>
      );
    case "dino":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M18 4C15 4 13 6 13 9C13 11 14 12 14 12L8 12C5 12 3 14 3 17C3 20 5 21 8 21H18C21 21 21 18 21 15C21 12 21 4 18 4Z" fill="#4ADE80" />
          <circle cx="16" cy="7" r="1" fill="black" />
          <path d="M3 17H5L4 19L3 17Z" fill="#166534" />
          <path d="M13 12H15L14 14L13 12Z" fill="#166534" />
          <rect x="7" y="21" width="2" height="3" fill="#166534" />
          <rect x="15" y="21" width="2" height="3" fill="#166534" />
        </svg>
      );
    case "sun":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="12" r="5" fill="#F59E0B" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "flower":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="12" r="3.5" fill="#F59E0B" />
          <circle cx="12" cy="7" r="3.5" fill="#EC4899" />
          <circle cx="12" cy="17" r="3.5" fill="#EC4899" />
          <circle cx="7" cy="12" r="3.5" fill="#EC4899" />
          <circle cx="17" cy="12" r="3.5" fill="#EC4899" />
        </svg>
      );
    case "heart":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#EF4444" stroke="#DC2626" strokeWidth="1" />
        </svg>
      );
    default:
      return <span>{emoji}</span>;
  }
};
