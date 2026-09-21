import React, { useState } from "react";

import { SvgAsset } from "../../assets/svg";
import { artAvatarId, diceBearAvatar } from "../../lib/avatar";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "fill";

export interface UIAvatarProps {
  name: string;
  /** Stored opaque DiceBear seed. Ignored when an explicit src is supplied. */
  seed?: string;
  /** Supports non-DiceBear profile images used by sidebar JSON. */
  src?: string;
  size?: AvatarSize;
  className?: string;
  decorative?: boolean;
}

const sizes: Record<AvatarSize, string> = {
  xs: "h-5 w-5 rounded-full text-[9px]",
  sm: "h-10 w-10 rounded-full text-xs",
  md: "h-11 w-11 rounded-full text-sm",
  lg: "h-16 w-16 rounded-full text-base",
  fill: "h-full w-full rounded-full text-sm",
};

const initialsFor = (name: string): string => {
  const clean = name.includes("@") ? name.split("@")[0] : name;
  const parts = clean.trim().split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : clean.slice(0, 2)).toUpperCase() || "?";
};

/** One resilient renderer for remote SVG avatars throughout Koda. */
export const UIAvatar: React.FC<UIAvatarProps> = ({
  name,
  seed,
  src,
  size = "sm",
  className = "",
  decorative = false,
}) => {
  const artId = src ? undefined : artAvatarId(seed);
  const imageUrl = src ?? (!artId && seed ? diceBearAvatar(seed) : undefined);
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>();
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  const loaded = Boolean(imageUrl && loadedUrl === imageUrl);
  const failed = Boolean(imageUrl && failedUrl === imageUrl);

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden text-indigo-700 ${artId ? "bg-transparent" : "bg-indigo-100"} ${sizes[size]} ${className}`}
      aria-label={decorative ? undefined : `${name} avatar`}
      role={decorative ? undefined : "img"}
    >
      <span className="absolute inset-0 flex items-center justify-center font-semibold" aria-hidden="true">
        {initialsFor(name)}
      </span>
      {artId && (
        <SvgAsset id={artId} size="100%" className="absolute inset-0 z-10" />
      )}
      {imageUrl && !loaded && !failed && (
        <span className="absolute inset-0 animate-pulse bg-indigo-100/70" aria-hidden="true" />
      )}
      {imageUrl && !failed && (
        <img
          key={imageUrl}
          src={imageUrl}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoadedUrl(imageUrl)}
          onError={() => setFailedUrl(imageUrl)}
          className="absolute inset-0 z-10 h-full w-full object-cover"
        />
      )}
    </span>
  );
};
