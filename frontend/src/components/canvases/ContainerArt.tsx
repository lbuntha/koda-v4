/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The counting vessels — jar, basket and box — and the face they wear.
 *
 * Lifted out of `MagnetsCanvas` when the counting family merged into one
 * component, unchanged: the artwork is the thing children recognise, and a
 * redraw would have been a silent change to a game that already worked.
 *
 * `CONTAINER_INTERIOR` is the part that matters to layout — where the inside of
 * each vessel actually is, as fractions of its own box. Expressed that way
 * because a hardcoded pixel inset only ever matched one shape at one size, and
 * a basket then held its apples somewhere around its handle.
 */

import React from "react";
import type { Rect } from "./objectLayout";

export type ContainerShape = "jar" | "basket" | "box";

export const CONTAINER_SHAPES: readonly ContainerShape[] = ["jar", "basket", "box"] as const;

/**
 * The usable inside of each vessel, as fractions of the drawing's box.
 * Taken from the SVG paths below: the jar's glass runs x 22–78 of 100 and y 30–104.
 */
export const CONTAINER_INTERIOR: Record<ContainerShape, Rect> = {
  jar: { left: 0.24, top: 0.28, width: 0.52, height: 0.55 },
  basket: { left: 0.20, top: 0.36, width: 0.60, height: 0.48 },
  box: { left: 0.18, top: 0.30, width: 0.64, height: 0.58 }
};

export const CONTAINER_NAMES: Record<ContainerShape, { bin: string; inside: string }> = {
  jar: { bin: "Collecting Jar", inside: "Inside Jar" },
  basket: { bin: "Basket", inside: "Inside Basket" },
  box: { bin: "Toy Box", inside: "Inside Box" }
};

/** The vessel's face. `happy` is what a child sees the moment something goes in. */
const KawaiiFace: React.FC<{ type: ContainerShape; happy: boolean }> = ({ type, happy }) => {
  const isHappy = happy;
    const blushColor = type === "basket" ? "url(#basketBlush)" : type === "box" ? "url(#boxBlush)" : "url(#jarBlush)";
    const inkColor = type === "basket" ? "#3e2723" : type === "box" ? "#5d4037" : "#37474f";
    const tongueColor = "#ff769b";

    const cX1 = type === "jar" ? 41 : 39;
    const cX2 = type === "jar" ? 59 : 61;
    const cY = type === "jar" ? 58 : 56;

    const blushX1 = type === "jar" ? 35 : 33;
    const blushX2 = type === "jar" ? 65 : 67;
    const cheekY = type === "jar" ? 65 : 62;

    const smileY = type === "jar" ? 63 : 60;

    return (
      <g>
        <circle cx={blushX1} cy={cheekY} r={5} fill={blushColor} />
        <circle cx={blushX2} cy={cheekY} r={5} fill={blushColor} />

        {isHappy ? (
          <>
            <path d={`M ${cX1 - 4} ${cY + 1} Q ${cX1} ${cY - 3} ${cX1 + 4} ${cY + 1}`} fill="none" stroke={inkColor} strokeWidth="2.2" strokeLinecap="round" />
            <path d={`M ${cX2 - 4} ${cY + 1} Q ${cX2} ${cY - 3} ${cX2 + 4} ${cY + 1}`} fill="none" stroke={inkColor} strokeWidth="2.2" strokeLinecap="round" />
            <path d={`M 46,${smileY} C 46,${smileY + 7} 54,${smileY + 7} 54,${smileY} Z`} fill={tongueColor} stroke={inkColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <g>
              <circle cx={cX1} cy={cY} r="4" fill={inkColor} />
              <circle cx={cX1 - 1.5} cy={cY - 2} r="1.5" fill="#ffffff" />
              <circle cx={cX1 + 1.5} cy={cY + 2} r="0.6" fill="#ffffff" />
            </g>
            <g>
              <circle cx={cX2} cy={cY} r="4" fill={inkColor} />
              <circle cx={cX2 - 1.5} cy={cY - 2} r="1.5" fill="#ffffff" />
              <circle cx={cX2 + 1.5} cy={cY + 2} r="0.6" fill="#ffffff" />
            </g>
            <path d={`M 47,${smileY} C 47,${smileY + 3.5} 53,${smileY + 3.5} 53,${smileY} Z`} fill={tongueColor} />
            <path d={`M 47,${smileY} C 47,${smileY + 3.5} 53,${smileY + 3.5} 53,${smileY}`} fill="none" stroke={inkColor} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </g>
    );
};

export interface ContainerArtProps {
  shape: ContainerShape;
  /** Bounce the vessel while something is landing in it. */
  happy?: boolean;
  style?: React.CSSProperties;
}

/** The vessel itself, drawn to fill whatever box it is given. */
export const ContainerArt: React.FC<ContainerArtProps> = ({ shape, happy = false, style }) => {
  const renderKawaiiFace = (type: ContainerShape) => <KawaiiFace type={type} happy={happy} />;
  return (
    <div
      style={style}
      className={`pointer-events-none select-none transition-transform duration-200 ${
        happy ? "scale-105" : "scale-100"
      }`}
    >
      {shape === "basket" ? (
            <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
              <defs>
                <linearGradient id="basketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d7ccc8" />
                  <stop offset="100%" stopColor="#a1887f" />
                </linearGradient>
                <radialGradient id="basketBlush" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffab91" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ffab91" stopOpacity="0" />
                </radialGradient>
                <pattern id="weave" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 0 5 L 10 5 M 5 0 L 5 10" stroke="#8d6e63" strokeWidth="1" opacity="0.4" />
                </pattern>
              </defs>
              <path d="M 25 35 C 25 15, 75 15, 75 35" fill="none" stroke="#8d6e63" strokeWidth="5" strokeLinecap="round" />
              <path d="M 15 38 L 22 105 C 23 112, 77 112, 78 105 L 85 38 Z" fill="url(#basketGrad)" stroke="#5d4037" strokeWidth="3" />
              <path d="M 15 38 L 22 105 C 23 112, 77 112, 78 105 L 85 38 Z" fill="url(#weave)" />
              <ellipse cx="50" cy="38" rx="35" ry="8" fill="#a1887f" stroke="#5d4037" strokeWidth="3" />
              <ellipse cx="50" cy="38" rx="31" ry="5" fill="#6d4c41" opacity="0.6" />
              {renderKawaiiFace("basket")}
            </svg>
          ) : shape === "box" ? (
            <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
              <defs>
                <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffe0b2" />
                  <stop offset="100%" stopColor="#ffcc80" />
                </linearGradient>
                <radialGradient id="boxBlush" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffab91" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ffab91" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path d="M 10 30 L 90 30 L 85 105 Q 85 112 78 112 L 22 112 Q 15 112 15 105 Z" fill="url(#boxGrad)" stroke="#8d6e63" strokeWidth="3" />
              <path d="M 10 30 L 30 15 L 50 30 Z" fill="#ffb74d" stroke="#8d6e63" strokeWidth="2" />
              <path d="M 90 30 L 70 15 L 50 30 Z" fill="#ffa726" stroke="#8d6e63" strokeWidth="2" />
              <line x1="50" y1="30" x2="50" y2="112" stroke="#bcaaa4" strokeWidth="2" strokeDasharray="4 3" />
              {renderKawaiiFace("box")}
            </svg>
          ) : (
            <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
              <defs>
                <linearGradient id="jarBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e0f7fa" stopOpacity="0.7" />
                  <stop offset="30%" stopColor="#b2ebf2" stopOpacity="0.4" />
                  <stop offset="70%" stopColor="#80deea" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#4dd0e1" stopOpacity="0.75" />
                </linearGradient>
                <radialGradient id="jarBlush" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ff80ab" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ff80ab" stopOpacity="0" />
                </radialGradient>
              </defs>

              <path d="M 22 28 C 12 36, 12 96, 22 106 C 28 112, 72 112, 78 106 C 88 96, 88 36, 78 28 Z" fill="url(#jarBody)" stroke="#00838f" strokeWidth="3" />
              <rect x="26" y="16" width="48" height="12" rx="4" fill="#e0f7fa" stroke="#00838f" strokeWidth="2.5" />
              <ellipse cx="50" cy="16" rx="22" ry="5" fill="#b2ebf2" stroke="#00838f" strokeWidth="2" />
              <path d="M 28 20 C 35 23, 65 23, 72 20" fill="none" stroke="#00838f" strokeWidth="1.5" opacity="0.6" />
              <path d="M 24 35 Q 20 65 25 100" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
              <circle cx="28" cy="101" r="2" fill="#ffffff" opacity="0.6" />
              {renderKawaiiFace("jar")}
            </svg>
      )}
    </div>
  );
};
