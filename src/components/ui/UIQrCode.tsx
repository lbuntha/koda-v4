import React, { useMemo } from "react";
import qrcode from "qrcode-generator";

export interface UIQrCodeProps {
  /** What a phone camera reads — a link, so scanning opens Koda. */
  value: string;
  /** Rendered width and height in CSS pixels. */
  size?: number;
  /** Names the picture for a screen reader. */
  label: string;
  className?: string;
}

/**
 * A QR code drawn as one SVG path, offline and dependency-light.
 *
 * Always dark on white whatever the theme: a camera reads contrast, and an
 * inverted code on a dark card is one many phones refuse. The quiet zone (four
 * modules of white around it) is part of the standard, so it is drawn rather
 * than left to whatever the code happens to sit on.
 */
export const UIQrCode: React.FC<UIQrCodeProps> = ({ value, size = 200, label, className = "" }) => {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (qr.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`;
      }
    }
    return { path: d, count: n + 8 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      shapeRendering="crispEdges"
      className={`rounded-xl bg-white ${className}`}
    >
      <rect width={count} height={count} fill="#ffffff" />
      <path d={path} fill="#0f172a" />
    </svg>
  );
};
