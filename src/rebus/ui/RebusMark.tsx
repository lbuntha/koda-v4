/**
 * The Rebus Rush mark: the game in one picture.
 *
 * An eye and a heart on two picture tiles, joined by a plus — the oldest rebus
 * there is ("I love") — with a small question mark asking the child to say it.
 * It explains the game before anyone reads a word, which a puzzle-piece icon
 * never did: a puzzle piece says "jigsaw".
 *
 * One colour, indigo, like the rest of the app's marks: it should sit on a page
 * quietly, not shout from it.
 */

import React from "react";

export const RebusMark: React.FC<{ size?: number; className?: string; title?: string }> = ({ size = 56, className, title }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    className={className}
    role={title ? "img" : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
  >
    {/* The tile the mark sits on. */}
    <rect width="56" height="56" rx="16" fill="#4F46E5" />

    {/* Picture tile one: an eye ("I"). */}
    <rect x="7" y="15" width="18" height="18" rx="5" fill="#FFFFFF" />
    <path d="M10 24c1.9-3.1 3.9-4.6 6-4.6s4.1 1.5 6 4.6c-1.9 3.1-3.9 4.6-6 4.6s-4.1-1.5-6-4.6z" fill="none" stroke="#4F46E5" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="16" cy="24" r="2.2" fill="#4F46E5" />

    {/* The plus that joins them. */}
    <path d="M28 21v6M25 24h6" stroke="#C7D2FE" strokeWidth="2.2" strokeLinecap="round" />

    {/* Picture tile two: a heart ("love"). */}
    <rect x="31" y="15" width="18" height="18" rx="5" fill="#FFFFFF" />
    <path d="M40 29.2s-5.2-3.2-5.2-6.7a2.8 2.8 0 0 1 5.2-1.3 2.8 2.8 0 0 1 5.2 1.3c0 3.5-5.2 6.7-5.2 6.7z" fill="#4F46E5" />

    {/* "Say it?" — the question the child answers. */}
    <rect x="20" y="37" width="16" height="9" rx="4.5" fill="#E0E7FF" />
    <text x="28" y="44.2" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="7.5" fontWeight="900" fill="#4338CA">?</text>
  </svg>
);
