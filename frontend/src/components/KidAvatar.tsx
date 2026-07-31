/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Profile artwork for the kid tiles and the avatar picker.
 *
 * Two reasons these are SVG rather than the emoji they replace: an emoji renders as a
 * different picture on every OS (and as a system font it cannot be styled), and at tile size
 * the platform glyphs look pasted on. Each avatar is one white silhouette with translucent
 * ink for the details — inner shapes have to be *darker* than the silhouette to read, which
 * is why nothing here is drawn in a lighter white. The result sits on any tile gradient and
 * stays crisp from 32px to 200px.
 *
 * The stored value is still the emoji, so nothing needs migrating — this maps that key to
 * artwork, and falls back to rendering the character itself for anything unmapped.
 */

import React from "react";
import { cn } from "../lib/utils";
import { AVATAR_FALLBACK } from "../parent/AvatarPicker";
import { isKodaKidAvatar, LearnerPortrait } from "../parent/onboarding/LearnerPortrait";

/** Eyes, noses, stripes. */
const INK = "#2A2350";
/** Shading on top of the white silhouette: muzzles, ear insides, wings, bellies. */
const SHADE = "rgba(42,35,80,0.17)";
/** A second step for shapes that need to separate from SHADE next to them. */
const SHADE_2 = "rgba(42,35,80,0.3)";

/** Shared eyes: identical placement keeps the set feeling like one family. */
const Eyes: React.FC<{ y?: number; dx?: number; r?: number }> = ({ y = 32, dx = 8, r = 3 }) => (
  <g fill={INK}>
    <circle cx={32 - dx} cy={y} r={r} />
    <circle cx={32 + dx} cy={y} r={r} />
  </g>
);

const ART: Record<string, React.ReactNode> = {
  "🦊": (
    <>
      <path d="M13 14 24 27 11 30Z" fill="#fff" />
      <path d="M51 14 40 27l13 3Z" fill="#fff" />
      <path d="M13 14 22 25l-9 3Z" fill={SHADE} />
      <path d="M51 14 42 25l9 3Z" fill={SHADE} />
      <path d="M32 20c11 0 17 7 17 15 0 7-4 12-9 15l-8 5-8-5c-5-3-9-8-9-15 0-8 6-15 17-15Z" fill="#fff" />
      <path d="M32 39c4 0 7 2 7 5 0 4-4 7-7 9-3-2-7-5-7-9 0-3 3-5 7-5Z" fill={SHADE} />
      <Eyes y={33} dx={8} />
      <circle cx="32" cy="45" r="2.8" fill={INK} />
    </>
  ),
  "🐼": (
    <>
      <circle cx="17" cy="20" r="7.5" fill={INK} />
      <circle cx="47" cy="20" r="7.5" fill={INK} />
      <circle cx="32" cy="34" r="19" fill="#fff" />
      <ellipse cx="24" cy="31" rx="5.4" ry="6.4" fill={INK} />
      <ellipse cx="40" cy="31" rx="5.4" ry="6.4" fill={INK} />
      <circle cx="24" cy="31" r="2.1" fill="#fff" />
      <circle cx="40" cy="31" r="2.1" fill="#fff" />
      <ellipse cx="32" cy="42" rx="4" ry="2.9" fill={INK} />
      <path d="M27 47c3 2 7 2 10 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  "🐯": (
    <>
      <circle cx="18" cy="21" r="6.5" fill="#fff" />
      <circle cx="46" cy="21" r="6.5" fill="#fff" />
      <circle cx="18" cy="21" r="3" fill={SHADE} />
      <circle cx="46" cy="21" r="3" fill={SHADE} />
      <circle cx="32" cy="35" r="19" fill="#fff" />
      <path d="M32 17v6M24 19l1.5 5M40 19l-1.5 5" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <Eyes y={33} dx={8} />
      <ellipse cx="32" cy="43" rx="7" ry="5" fill={SHADE} />
      <path d="M32 41v3M28 47c2 1.5 6 1.5 8 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  "🦄": (
    <>
      <path d="M32 7 37 21H27Z" fill="#fff" />
      <path d="M32 7 37 21H27Z" fill={SHADE} />
      <path d="M30 10h4M28.5 15h7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M32 20c11 0 17 8 17 17s-7 16-17 16-17-5-17-16 6-17 17-17Z" fill="#fff" />
      <path d="M17 25c5-5 12-4 15 1-5 4-11 4-15-1ZM15 34c4-3 9-2 11 2-4 3-9 2-11-2Z" fill={SHADE} />
      <Eyes y={34} dx={8} />
      <ellipse cx="32" cy="45" rx="5.5" ry="4" fill={SHADE} />
      <circle cx="30" cy="45" r="1.4" fill={INK} />
      <circle cx="34" cy="45" r="1.4" fill={INK} />
    </>
  ),
  "🐸": (
    <>
      <circle cx="19" cy="21" r="8.5" fill="#fff" />
      <circle cx="45" cy="21" r="8.5" fill="#fff" />
      <circle cx="19" cy="21" r="3.6" fill={INK} />
      <circle cx="45" cy="21" r="3.6" fill={INK} />
      <path d="M32 26c12 0 19 6 19 14 0 7-8 12-19 12s-19-5-19-12c0-8 7-14 19-14Z" fill="#fff" />
      <path d="M23 41c5 5 13 5 18 0" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="47" r="1.6" fill={SHADE_2} />
      <circle cx="40" cy="47" r="1.6" fill={SHADE_2} />
    </>
  ),
  "🐵": (
    <>
      <circle cx="13" cy="32" r="7.5" fill="#fff" />
      <circle cx="51" cy="32" r="7.5" fill="#fff" />
      <circle cx="13" cy="32" r="3.4" fill={SHADE} />
      <circle cx="51" cy="32" r="3.4" fill={SHADE} />
      <circle cx="32" cy="33" r="19" fill="#fff" />
      <path d="M32 26c8 0 12 5 12 10s-5 9-12 9-12-4-12-9 4-10 12-10Z" fill={SHADE} />
      <Eyes y={29} dx={7} />
      <ellipse cx="32" cy="38" rx="3.6" ry="2.4" fill={INK} />
      <path d="M27 43c3 2 7 2 10 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  "🐙": (
    <>
      <path d="M32 13c11 0 18 8 18 18v7H14v-7c0-10 7-18 18-18Z" fill="#fff" />
      <path d="M14 38h36c0 5-2 9-5 11 0-4-2-6-4-6s-4 2-4 6c0-4-2-6-4-6s-4 2-4 6c0-4-2-6-4-6s-4 2-4 6c-3-2-5-6-5-11Z" fill="#fff" />
      <path d="M21 40c0 4-1 7-2 9M43 40c0 4 1 7 2 9" stroke={SHADE} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <Eyes y={29} dx={7.5} />
      <path d="M27 38c3 2 7 2 10 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="22" cy="24" r="2.4" fill={SHADE} />
    </>
  ),
  "🦁": (
    <>
      <circle cx="32" cy="33" r="22" fill={SHADE} />
      <path d="M32 11v6M50 21l-4 4M54 33h-6M50 45l-4-4M32 55v-6M14 45l4-4M10 33h6M14 21l4 4" stroke={SHADE_2} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="34" r="15" fill="#fff" />
      <Eyes y={31} dx={6.5} />
      <ellipse cx="32" cy="39" rx="4.4" ry="3" fill={INK} />
      <path d="M27 44c3 2 7 2 10 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  "🐧": (
    <>
      <ellipse cx="32" cy="33" rx="17" ry="21" fill="#fff" />
      <path d="M32 16c7 0 11 6 11 13 0 9-5 16-11 16s-11-7-11-16c0-7 4-13 11-13Z" fill={SHADE} />
      <Eyes y={26} dx={6} r={2.7} />
      <path d="M32 31 38 35l-6 4-6-4Z" fill={INK} />
      <path d="M13 30c-3 3-3 9 0 12M51 30c3 3 3 9 0 12" stroke={SHADE} strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  ),
  "🐨": (
    <>
      <circle cx="14" cy="24" r="9" fill="#fff" />
      <circle cx="50" cy="24" r="9" fill="#fff" />
      <circle cx="14" cy="24" r="4.4" fill={SHADE} />
      <circle cx="50" cy="24" r="4.4" fill={SHADE} />
      <circle cx="32" cy="35" r="18" fill="#fff" />
      <Eyes y={33} dx={7.5} />
      <path d="M32 38c3 0 5 2 5 5s-2 6-5 6-5-3-5-6 2-5 5-5Z" fill={INK} />
    </>
  ),
  "🐰": (
    <>
      <ellipse cx="24" cy="15" rx="5" ry="12" fill="#fff" />
      <ellipse cx="40" cy="15" rx="5" ry="12" fill="#fff" />
      <ellipse cx="24" cy="16" rx="2.2" ry="7.5" fill={SHADE} />
      <ellipse cx="40" cy="16" rx="2.2" ry="7.5" fill={SHADE} />
      <circle cx="32" cy="39" r="16" fill="#fff" />
      <Eyes y={36} dx={7} />
      <path d="M32 41 34.6 43 32 45l-2.6-2Z" fill={INK} />
      <path d="M26 47c4 2 8 2 12 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  "🐮": (
    <>
      <path d="M11 19c-4 1-4 6 0 8 3 1 5-2 4-5Z" fill={SHADE_2} />
      <path d="M53 19c4 1 4 6 0 8-3 1-5-2-4-5Z" fill={SHADE_2} />
      <circle cx="32" cy="34" r="19" fill="#fff" />
      <path d="M20 22c4-3 8-2 9 2-4 2-8 1-9-2Z" fill={SHADE} />
      <Eyes y={30} dx={8} />
      <ellipse cx="32" cy="43" rx="10" ry="7" fill={SHADE} />
      <ellipse cx="28" cy="43" rx="1.8" ry="2.4" fill={INK} />
      <ellipse cx="36" cy="43" rx="1.8" ry="2.4" fill={INK} />
    </>
  ),
  "🐷": (
    <>
      <path d="M16 19 25 26l-9 4Z" fill="#fff" />
      <path d="M48 19 39 26l9 4Z" fill="#fff" />
      <circle cx="32" cy="35" r="18" fill="#fff" />
      <Eyes y={31} dx={8} />
      <ellipse cx="32" cy="43" rx="9.5" ry="7" fill={SHADE} />
      <ellipse cx="28.4" cy="43" rx="1.8" ry="2.4" fill={INK} />
      <ellipse cx="35.6" cy="43" rx="1.8" ry="2.4" fill={INK} />
    </>
  ),
  "🐳": (
    <>
      <path d="M30 10c0 4-1 7-3 9M36 12c0 3 1 6 2 8" stroke={SHADE_2} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M25 24c13 0 23 6 23 15 0 8-8 13-19 13-10 0-16-6-16-13 0-9 5-15 12-15Z" fill="#fff" />
      <path d="M48 32c4-3 9-4 9 0 0 4-2 9-5 11-2 1-4-3-4-6Z" fill={SHADE} />
      <path d="M13 41c9 4 21 4 30-1" stroke={SHADE} strokeWidth="2.4" fill="none" />
      <circle cx="23" cy="35" r="3" fill={INK} />
      <path d="M17 45c4 3 9 3 13 0" stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </>
  ),
  "🦉": (
    <>
      <path d="M15 17 25 26l-10 3Z" fill="#fff" />
      <path d="M49 17 39 26l10 3Z" fill="#fff" />
      <path d="M32 18c11 0 18 8 18 18s-8 17-18 17-18-6-18-17 7-18 18-18Z" fill="#fff" />
      <circle cx="24" cy="32" r="7.5" fill={SHADE} />
      <circle cx="40" cy="32" r="7.5" fill={SHADE} />
      <circle cx="24" cy="32" r="3.4" fill={INK} />
      <circle cx="40" cy="32" r="3.4" fill={INK} />
      <path d="M32 37 35.5 41 32 44.5 28.5 41Z" fill={INK} />
      <path d="M25 47c4 2 10 2 14 0" stroke={SHADE_2} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </>
  ),
  "🐝": (
    // Head and body are separate so the stripes stay on the body — drawn across the whole
    // figure they read as bared teeth rather than a bee.
    <>
      <path d="M26 15c-2-4-5-6-8-5M38 15c2-4 5-6 8-5" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="17" cy="9" r="2.2" fill={INK} />
      <circle cx="47" cy="9" r="2.2" fill={INK} />
      <ellipse cx="15" cy="34" rx="9" ry="6.5" transform="rotate(-32 15 34)" fill={SHADE} />
      <ellipse cx="49" cy="34" rx="9" ry="6.5" transform="rotate(32 49 34)" fill={SHADE} />
      <ellipse cx="32" cy="43" rx="13.5" ry="12.5" fill="#fff" />
      <path d="M21 39h22M23.5 47h17" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="24" r="11" fill="#fff" />
      <circle cx="28" cy="23" r="2.5" fill={INK} />
      <circle cx="36" cy="23" r="2.5" fill={INK} />
      <path d="M29 28.5c1.8 1.6 4.2 1.6 6 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
};

export const AVATAR_ART_KEYS = Object.keys(ART);

interface Props {
  /** The stored avatar value: an art key, a data/HTTP URL, raw SVG, or an emoji. */
  avatar?: string;
  className?: string;
}

export const KidAvatar: React.FC<Props> = ({ avatar, className }) => {
  if (!avatar) {
    return <span className={className} aria-hidden>{AVATAR_FALLBACK}</span>;
  }

  if (isKodaKidAvatar(avatar)) {
    return <LearnerPortrait avatarId={avatar} className={className} />;
  }

  // Case 1: Avatar is a stored data URL (data:image/svg+xml...) or HTTP(S) URL
  if (avatar.startsWith("data:") || avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return <img src={avatar} alt="" className={cn("object-contain", className)} aria-hidden />;
  }

  // Case 2: Avatar is raw SVG XML code
  if (avatar.startsWith("<svg")) {
    return (
      <span
        className={cn("inline-block object-contain", className)}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: avatar }}
      />
    );
  }

  // Case 3: Avatar is mapped in local ART dictionary
  const art = ART[avatar];
  if (art) {
    return (
      <svg viewBox="0 0 64 64" className={className} role="presentation" aria-hidden focusable="false">
        {art}
      </svg>
    );
  }

  // Case 4: Fallback to rendering avatar character or emoji
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-center select-none leading-none text-base w-full h-full",
        className
      )}
      aria-hidden
    >
      {avatar}
    </span>
  );
};
