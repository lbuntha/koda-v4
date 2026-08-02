import React from "react";

interface GoodsAssetProps {
  typeKey: string;
  size: number;
  className?: string;
  fallback?: React.ReactNode;
}

const PROTOTYPE_GOODS = new Set(["chips", "cola", "milk", "donut", "teddy", "duck"]);

export const hasGradientGoodsAsset = (typeKey: string) => PROTOTYPE_GOODS.has(typeKey);

/**
 * Offline soft-3D vector goods with one shared lighting direction.
 *
 * Every object uses a 64px viewBox, a top-left gloss and a contact shadow. Keeping the
 * silhouettes simple makes them readable in the tiny goal rail as well as on the shelf.
 */
export const GoodsAsset: React.FC<GoodsAssetProps> = ({
  typeKey,
  size,
  className = "",
  fallback = null,
}) => {
  const scope = React.useId().replace(/:/g, "");
  if (!hasGradientGoodsAsset(typeKey)) return <>{fallback}</>;

  const id = (name: string) => `${scope}-${typeKey}-${name}`;
  const commonDefs = (
    <defs>
      <filter id={id("shadow")} x="-30%" y="-30%" width="160%" height="175%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#172033" floodOpacity="0.3" />
      </filter>
      <linearGradient id={id("gloss")} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
        <stop offset="0.42" stopColor="#FFFFFF" stopOpacity="0.12" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>
    </defs>
  );

  const shell = (content: React.ReactNode) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={typeKey}
      data-goods-art={typeKey}
      className={className}
    >
      {commonDefs}
      {content}
    </svg>
  );

  switch (typeKey) {
    case "chips":
      return shell(
        <>
          <defs>
            <linearGradient id={id("body")} x1="12" y1="8" x2="53" y2="57" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF6B63" />
              <stop offset="0.52" stopColor="#EF3340" />
              <stop offset="1" stopColor="#B9152D" />
            </linearGradient>
            <radialGradient id={id("chip")} cx="0" cy="0" r="1" gradientTransform="translate(28 35) rotate(42) scale(18 14)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFF1A8" />
              <stop offset="0.72" stopColor="#F8C84E" />
              <stop offset="1" stopColor="#D99520" />
            </radialGradient>
          </defs>
          <g filter={`url(#${id("shadow")})`}>
            <path d="M14 10 Q32 6 50 10 L54 52 Q33 59 10 52 Z" fill={`url(#${id("body")})`} stroke="#A9132A" strokeWidth="1.4" />
            <path d="M14 10 Q32 14 50 10 L49 16 Q32 19 13 16 Z" fill="#FF9A72" opacity="0.82" />
            <path d="M11 48 Q32 53 53 48 L54 52 Q33 59 10 52 Z" fill="#99152A" opacity="0.55" />
            <ellipse cx="32" cy="35" rx="16" ry="13" fill="#FFF4D2" opacity="0.94" />
            <path d="M20 39 Q25 24 39 27 Q47 31 39 42 Q27 48 20 39Z" fill={`url(#${id("chip")})`} stroke="#D58B1D" strokeWidth="1.2" />
            <path d="M23 36 Q31 31 40 35" fill="none" stroke="#FFF8CC" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
            <path d="M16 14 Q22 11 25 13 L22 46 Q18 47 15 44 Z" fill={`url(#${id("gloss")})`} opacity="0.7" />
          </g>
        </>,
      );

    case "cola":
      return shell(
        <>
          <defs>
            <linearGradient id={id("body")} x1="18" y1="8" x2="48" y2="57" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF726E" />
              <stop offset="0.42" stopColor="#DC2638" />
              <stop offset="1" stopColor="#8E1027" />
            </linearGradient>
            <linearGradient id={id("metal")} x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#7D8796" />
              <stop offset="0.25" stopColor="#F8FAFC" />
              <stop offset="0.7" stopColor="#AAB4C2" />
              <stop offset="1" stopColor="#667085" />
            </linearGradient>
          </defs>
          <g filter={`url(#${id("shadow")})`}>
            <rect x="17" y="9" width="30" height="47" rx="7" fill={`url(#${id("body")})`} stroke="#7F1024" strokeWidth="1.4" />
            <ellipse cx="32" cy="10" rx="14" ry="4" fill={`url(#${id("metal")})`} stroke="#667085" strokeWidth="1" />
            <ellipse cx="32" cy="10" rx="5" ry="1.7" fill="#5D6674" />
            <rect x="27" y="8.7" width="8" height="2.5" rx="1.2" fill="#DCE2EA" />
            <path d="M18 31 Q29 23 46 29 L46 39 Q31 34 18 42 Z" fill="#FFF8E7" />
            <path d="M23 36 Q29 28 39 32 Q43 35 39 40 Q29 44 23 36Z" fill="#F7C948" />
            <path d="M21 13 Q25 11 28 12 L26 50 Q22 51 20 47 Z" fill={`url(#${id("gloss")})`} opacity="0.7" />
            <ellipse cx="32" cy="54" rx="12" ry="2.2" fill="#650C1E" opacity="0.5" />
          </g>
        </>,
      );

    case "milk":
      return shell(
        <>
          <defs>
            <linearGradient id={id("carton")} x1="14" y1="12" x2="50" y2="57" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.55" stopColor="#E7F5FF" />
              <stop offset="1" stopColor="#B9DDF7" />
            </linearGradient>
            <linearGradient id={id("blue")} x1="18" y1="8" x2="47" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#65D2FF" />
              <stop offset="0.55" stopColor="#2897ED" />
              <stop offset="1" stopColor="#1768BE" />
            </linearGradient>
          </defs>
          <g filter={`url(#${id("shadow")})`}>
            <path d="M18 20 L26 8 H42 L48 20 V56 H16 V20 Z" fill={`url(#${id("carton")})`} stroke="#3987C4" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M18 20 L26 8 H42 L48 20 Z" fill={`url(#${id("blue")})`} />
            <path d="M26 8 L34 15 L42 8 Z" fill="#C9ECFF" />
            <path d="M34 15 V56" stroke="#6CA9D7" strokeWidth="1" opacity="0.6" />
            <rect x="19" y="29" width="26" height="18" rx="5" fill="#FFFFFF" opacity="0.88" />
            <path d="M24 39 Q26 31 32 35 Q38 30 41 39 Q37 45 32 42 Q27 45 24 39Z" fill="#62BDF4" />
            <circle cx="29" cy="38" r="1" fill="#185889" />
            <circle cx="36" cy="38" r="1" fill="#185889" />
            <path d="M20 22 L26 12 L29 15 L25 51 Q21 52 19 48 Z" fill={`url(#${id("gloss")})`} opacity="0.72" />
          </g>
        </>,
      );

    case "donut":
      return shell(
        <>
          <defs>
            <radialGradient id={id("dough")} cx="0" cy="0" r="1" gradientTransform="translate(27 23) rotate(58) scale(31 29)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFD98C" />
              <stop offset="0.65" stopColor="#D99142" />
              <stop offset="1" stopColor="#9B552B" />
            </radialGradient>
            <linearGradient id={id("frosting")} x1="17" y1="14" x2="47" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF8DCA" />
              <stop offset="0.55" stopColor="#EC4899" />
              <stop offset="1" stopColor="#BE2878" />
            </linearGradient>
          </defs>
          <g filter={`url(#${id("shadow")})`}>
            <ellipse cx="32" cy="36" rx="24" ry="20" fill={`url(#${id("dough")})`} stroke="#8E4A27" strokeWidth="1.4" />
            <path d="M10 32 Q13 15 31 14 Q51 14 55 31 Q51 39 47 35 Q44 44 38 38 Q32 45 27 38 Q20 44 18 35 Q13 39 10 32Z" fill={`url(#${id("frosting")})`} />
            <ellipse cx="32" cy="34" rx="8" ry="7" fill="#8E4A27" />
            <ellipse cx="32" cy="31.5" rx="6" ry="5" fill="#F5B765" />
            <path d="M17 26 L22 23 M42 22 L47 25 M19 34 L24 36 M40 34 L45 31 M29 20 L31 24" stroke="#FFF4A8" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 28 Q20 17 31 18" fill="none" stroke="#FFD3EA" strokeWidth="3" strokeLinecap="round" opacity="0.72" />
          </g>
        </>,
      );

    case "teddy":
      return shell(
        <>
          <defs>
            <radialGradient id={id("fur")} cx="0" cy="0" r="1" gradientTransform="translate(24 19) rotate(53) scale(35)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#E5A15F" />
              <stop offset="0.58" stopColor="#B96B35" />
              <stop offset="1" stopColor="#7E3D24" />
            </radialGradient>
          </defs>
          <g filter={`url(#${id("shadow")})`}>
            <circle cx="18" cy="17" r="9" fill={`url(#${id("fur")})`} stroke="#71351F" strokeWidth="1.3" />
            <circle cx="46" cy="17" r="9" fill={`url(#${id("fur")})`} stroke="#71351F" strokeWidth="1.3" />
            <ellipse cx="32" cy="43" rx="19" ry="16" fill={`url(#${id("fur")})`} stroke="#71351F" strokeWidth="1.4" />
            <circle cx="32" cy="25" r="18" fill={`url(#${id("fur")})`} stroke="#71351F" strokeWidth="1.4" />
            <ellipse cx="32" cy="31" rx="10" ry="8" fill="#E9B77A" />
            <circle cx="26" cy="23" r="2" fill="#2E1A14" />
            <circle cx="38" cy="23" r="2" fill="#2E1A14" />
            <circle cx="25.4" cy="22.4" r="0.65" fill="#FFFFFF" />
            <circle cx="37.4" cy="22.4" r="0.65" fill="#FFFFFF" />
            <path d="M29 29 Q32 26 35 29 Q34 33 32 33 Q30 33 29 29Z" fill="#3A2017" />
            <path d="M32 33 Q29 36 27 34 M32 33 Q35 36 37 34" fill="none" stroke="#6C3522" strokeWidth="1.3" strokeLinecap="round" />
            <ellipse cx="23" cy="46" rx="5" ry="7" fill="#E9B77A" opacity="0.8" />
            <ellipse cx="41" cy="46" rx="5" ry="7" fill="#E9B77A" opacity="0.8" />
            <path d="M21 14 Q26 7 34 8" fill="none" stroke="#FFD4A2" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
          </g>
        </>,
      );

    case "duck":
      return shell(
        <>
          <defs>
            <radialGradient id={id("yellow")} cx="0" cy="0" r="1" gradientTransform="translate(25 19) rotate(54) scale(34 31)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFF59A" />
              <stop offset="0.55" stopColor="#FFD83D" />
              <stop offset="1" stopColor="#E9A91B" />
            </radialGradient>
            <linearGradient id={id("beak")} x1="38" y1="27" x2="58" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFB347" />
              <stop offset="1" stopColor="#EF6C22" />
            </linearGradient>
          </defs>
          <g filter={`url(#${id("shadow")})`}>
            <ellipse cx="30" cy="43" rx="23" ry="15" fill={`url(#${id("yellow")})`} stroke="#CA8814" strokeWidth="1.4" />
            <circle cx="35" cy="25" r="16" fill={`url(#${id("yellow")})`} stroke="#CA8814" strokeWidth="1.4" />
            <path d="M46 28 Q58 28 60 34 Q54 40 44 35 Z" fill={`url(#${id("beak")})`} stroke="#D95D1E" strokeWidth="1.2" />
            <ellipse cx="26" cy="44" rx="12" ry="8" fill="#F3B91F" opacity="0.86" transform="rotate(-12 26 44)" />
            <path d="M20 43 Q27 36 35 41" fill="none" stroke="#FFF39A" strokeWidth="2.4" strokeLinecap="round" opacity="0.72" />
            <circle cx="40" cy="22" r="2.2" fill="#253044" />
            <circle cx="39.4" cy="21.4" r="0.75" fill="#FFFFFF" />
            <path d="M24 14 Q31 8 39 11" fill="none" stroke="#FFFBD0" strokeWidth="3" strokeLinecap="round" opacity="0.72" />
          </g>
        </>,
      );
  }

  return <>{fallback}</>;
};
