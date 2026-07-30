import React from "react";

export type CelebrationTone = "party" | "trophy";

interface CelebrationEffectsProps {
  tone?: CelebrationTone;
  className?: string;
}

const COLORS = ["#7C5CE5", "#FF5E9B", "#FFD54F", "#35CFA0", "#5AA9FF"];

/** Visual-only, deterministic burst shared by learner celebration surfaces. */
export const CelebrationEffects: React.FC<CelebrationEffectsProps> = ({
  tone = "party",
  className = "",
}) => (
  <div className={`koda-celebration-effects ${className}`} aria-hidden="true">
    <span className={`koda-celebration-halo koda-celebration-halo--${tone}`} />
    {Array.from({ length: 16 }, (_, index) => {
      const angle = ((index * 137.5) - 105) * (Math.PI / 180);
      const distance = 92 + (index % 4) * 24;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const style = {
        "--burst-x": `${x.toFixed(1)}px`,
        "--burst-y": `${y.toFixed(1)}px`,
        "--burst-x-mid": `${(x * 0.82).toFixed(1)}px`,
        "--burst-y-mid": `${(y * 0.82).toFixed(1)}px`,
        "--burst-spin": `${180 + index * 47}deg`,
        "--burst-delay": `${90 + (index % 5) * 38}ms`,
        "--burst-color": COLORS[index % COLORS.length],
      } as React.CSSProperties;
      return <span key={index} className={`koda-celebration-particle particle-${index % 3}`} style={style} />;
    })}
  </div>
);
