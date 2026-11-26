import React from "react";

/**
 * Wonder Lab's pictures: one flat style, one 64×64 grid, one palette.
 *
 * Drawn here rather than borrowed, so every picture a child compares is the
 * same size, weight and style — a distractor never stands out because it came
 * from a different set. Each drawing is the real thing it names, simplified:
 * a waxing crescent is lit on the right, morning shadows fall away from a low
 * eastern Sun, a froglet still has its tail. Koda keeps to its readable palette: the Sun and
 * ripe rice are orange, as Koda's palette requires.
 */

const P = {
  ink: "#334155",
  inkSoft: "#64748B",
  skin: "#E8B48A",
  skinD: "#C98B5E",
  green: "#22C55E",
  greenD: "#15803D",
  leaf: "#4ADE80",
  brown: "#8B5E3C",
  brownD: "#6B4428",
  tan: "#D9A066",
  orange: "#FB923C",
  orangeD: "#EA580C",
  orangeL: "#FDBA74",
  peach: "#FFEDD5",
  sky: "#38BDF8",
  skyL: "#BAE6FD",
  skyXL: "#E0F2FE",
  water: "#0EA5E9",
  night: "#1E293B",
  moon: "#E2E8F0",
  grey: "#94A3B8",
  greyL: "#CBD5E1",
  greyXL: "#F1F5F9",
  white: "#FFFFFF",
  rose: "#F43F5E",
  roseL: "#FDA4AF",
  pink: "#F472B6",
  violet: "#8B5CF6",
  violetL: "#C4B5FD",
  emerald: "#10B981",
  emeraldL: "#6EE7B7",
} as const;

type Draw = () => React.ReactElement;

/* ---------- shared parts ---------- */

const SkyBox: React.FC<{ fill: string; children?: React.ReactNode }> = ({ fill, children }) => (
  <>
    <rect x="2" y="2" width="60" height="60" rx="12" fill={fill} />
    {children}
  </>
);
const Ground: React.FC<{ y?: number; fill?: string }> = ({ y = 48, fill = P.leaf }) => (
  <path d={`M2 ${y}H62V50a12 12 0 0 1-12 12H14A12 12 0 0 1 2 50Z`} fill={fill} />
);
const Sun: React.FC<{ x: number; y: number; r?: number }> = ({ x, y, r = 7 }) => (
  <g>
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return (
        <line key={i} x1={x + Math.cos(a) * (r + 3)} y1={y + Math.sin(a) * (r + 3)} x2={x + Math.cos(a) * (r + 7)} y2={y + Math.sin(a) * (r + 7)}
          stroke={P.orangeL} strokeWidth="3" strokeLinecap="round" />
      );
    })}
    <circle cx={x} cy={y} r={r} fill={P.orange} />
  </g>
);
const Star: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-4L1.2-1.2L4 0L1.2 1.2L0 4L-1.2 1.2L-4 0L-1.2-1.2Z" fill={P.white} />
);
const Crescent: React.FC<{ x: number; y: number; r: number; bg: string }> = ({ x, y, r, bg }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={P.moon} />
    <circle cx={x - r * 0.55} cy={y} r={r * 0.95} fill={bg} />
  </g>
);
const HalfMoon: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#334155" />
    <path d={`M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}Z`} fill={P.moon} />
  </g>
);
const FullMoon: React.FC<{ x: number; y: number; r: number }> = ({ x, y, r }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={P.moon} />
    <circle cx={x - r * 0.3} cy={y - r * 0.2} r={r * 0.18} fill={P.greyL} />
    <circle cx={x + r * 0.35} cy={y + r * 0.3} r={r * 0.24} fill={P.greyL} />
    <circle cx={x + r * 0.1} cy={y - r * 0.5} r={r * 0.1} fill={P.greyL} />
  </g>
);
const Tree: React.FC<{ x: number; base: number; h?: number; fruit?: boolean }> = ({ x, base, h = 1, fruit }) => (
  <g>
    <rect x={x - 3 * h} y={base - 18 * h} width={6 * h} height={18 * h} rx={2} fill={P.brown} />
    <circle cx={x} cy={base - 26 * h} r={14 * h} fill={P.green} />
    <circle cx={x - 7 * h} cy={base - 22 * h} r={8 * h} fill={P.greenD} opacity="0.35" />
    {fruit && [[-6, -24], [5, -30], [7, -19], [-3, -33]].map(([dx, dy], i) => (
      <ellipse key={i} cx={x + dx * h} cy={base + dy * h} rx={3 * h} ry={2.4 * h} fill={P.orange} />
    ))}
  </g>
);
const Person: React.FC<{ x: number; base: number; h: number; shirt: string }> = ({ x, base, h, shirt }) => (
  <g>
    <circle cx={x} cy={base - h + 6} r={6} fill={P.skin} />
    <path d={`M${x - 6} ${base - h + 6}a6 6 0 0 1 12 0q-6-5-12 0Z`} fill={P.ink} />
    <rect x={x - 7} y={base - h + 13} width="14" height={h * 0.45} rx="5" fill={shirt} />
    <rect x={x - 5} y={base - h + 13 + h * 0.45 - 3} width="4" height={base - (base - h + 10 + h * 0.45)} rx="2" fill={P.ink} />
    <rect x={x + 1} y={base - h + 13 + h * 0.45 - 3} width="4" height={base - (base - h + 10 + h * 0.45)} rx="2" fill={P.ink} />
  </g>
);
const Eye: React.FC<{ x: number; y: number; r?: number }> = ({ x, y, r = 1.8 }) => <circle cx={x} cy={y} r={r} fill={P.ink} />;

/** A whole plant with one part in colour and the rest grey: plant parts are pointed at, not named. */
const PlantDiagram: React.FC<{ on: "root" | "stem" | "leaf" | "flower" }> = ({ on }) => {
  const col = (part: typeof on, colour: string) => (part === on ? colour : P.greyL);
  return (
    <g>
      <rect x="4" y="40" width="56" height="20" rx="6" fill={P.peach} />
      <g stroke={col("root", P.brown)} strokeWidth={on === "root" ? 3 : 2} strokeLinecap="round" fill="none">
        <path d="M32 40v12M32 44l-8 8M32 44l8 8M32 48l-5 8M32 48l5 8" />
      </g>
      <rect x="30" y="18" width="4" height="22" rx="2" fill={col("stem", P.greenD)} />
      <path d="M32 32c-6-6-14-6-18-2 5 5 13 5 18 2Z" fill={col("leaf", P.green)} />
      <path d="M32 26c6-6 14-6 18-2-5 5-13 5-18 2Z" fill={col("leaf", P.green)} />
      <g fill={col("flower", P.pink)}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="32" cy="9" rx="3.4" ry="6" transform={`rotate(${a} 32 14)`} />
        ))}
      </g>
      <circle cx="32" cy="14" r="3" fill={col("flower", P.orange)} />
    </g>
  );
};

const Dog: React.FC<{ x?: number; y?: number; s?: number; coat?: string; spot?: string }> = ({ x = 0, y = 0, s = 1, coat = P.tan, spot }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="30" cy="38" rx="16" ry="9" fill={coat} />
    {spot && <ellipse cx="26" cy="36" rx="5" ry="4" fill={spot} />}
    <rect x="17" y="42" width="5" height="12" rx="2.5" fill={coat} />
    <rect x="37" y="42" width="5" height="12" rx="2.5" fill={coat} />
    <path d="M45 34q8-6 6-12" stroke={coat} strokeWidth="4" strokeLinecap="round" fill="none" />
    <circle cx="16" cy="28" r="9" fill={coat} />
    <ellipse cx="11" cy="24" rx="4" ry="7" fill={P.brownD} transform="rotate(20 11 24)" />
    <ellipse cx="9" cy="31" rx="4" ry="3" fill={coat} />
    <circle cx="6" cy="30" r="1.6" fill={P.ink} />
    <Eye x={15} y={26} />
  </g>
);
const Cat: React.FC<{ x?: number; y?: number; s?: number; coat?: string; patch?: string }> = ({ x = 0, y = 0, s = 1, coat = P.grey, patch }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M42 52q14-2 10-16" stroke={coat} strokeWidth="4" strokeLinecap="round" fill="none" />
    <ellipse cx="32" cy="44" rx="13" ry="12" fill={coat} />
    {patch && <ellipse cx="36" cy="44" rx="6" ry="7" fill={patch} />}
    <circle cx="32" cy="24" r="11" fill={coat} />
    <path d="M22 20l2-11 7 6ZM42 20l-2-11-7 6Z" fill={coat} />
    <Eye x={28} y={23} />
    <Eye x={36} y={23} />
    <path d="M30 28l2 2 2-2" stroke={P.ink} strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </g>
);
const Chick: React.FC<{ x?: number; y?: number; s?: number }> = ({ x = 0, y = 0, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="32" cy="40" rx="13" ry="11" fill={P.orangeL} />
    <circle cx="32" cy="26" r="9" fill={P.orangeL} />
    <path d="M40 26l6 2-6 2Z" fill={P.orangeD} />
    <Eye x={35} y={24} />
    <path d="M27 50v6M37 50v6" stroke={P.orangeD} strokeWidth="2" strokeLinecap="round" />
  </g>
);
const Hen: React.FC<{ x?: number; y?: number; s?: number; rooster?: boolean }> = ({ x = 0, y = 0, s = 1, rooster }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {rooster && <path d="M14 34q-8-16 2-22 2 10 6 14q-2-14 8-16-2 12 2 20Z" fill={P.emerald} />}
    {!rooster && <path d="M14 36q-6-10 2-14l6 10Z" fill={P.greyXL} stroke={P.greyL} />}
    <ellipse cx="30" cy="40" rx="16" ry="12" fill={P.white} stroke={P.greyL} strokeWidth="1.5" />
    <path d="M24 40q6 6 14 0" stroke={P.greyL} strokeWidth="1.5" fill="none" />
    <circle cx="42" cy="24" r="8" fill={P.white} stroke={P.greyL} strokeWidth="1.5" />
    <path d={rooster ? "M37 17q2-7 5-3 2-5 5 0 3-2 2 5Z" : "M39 17q2-4 4-1 2-3 4 1v2h-8Z"} fill={P.rose} />
    <path d="M42 30q1 5 3 4l1-4Z" fill={P.rose} />
    <path d="M49 23l6 2-6 3Z" fill={P.orange} />
    <Eye x={44} y={22} />
    <path d="M26 51v7M34 51v7" stroke={P.orangeD} strokeWidth="2" strokeLinecap="round" />
  </g>
);
const Duck: React.FC<{ x?: number; y?: number; s?: number }> = ({ x = 0, y = 0, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M10 38q-2-8 6-8h20q6-12 14-10 6 2 4 8l6 2-7 3q-1 5-3 7 0 12-20 12H22q-12 0-12-14Z" fill={P.white} stroke={P.greyL} strokeWidth="1.5" />
    <path d="M54 28l7 2-7 3Z" fill={P.orange} />
    <Eye x={48} y={25} />
    <path d="M22 40q8 6 18 0" stroke={P.greyL} strokeWidth="1.5" fill="none" />
    <path d="M24 52l-4 8h10ZM36 52l-4 8h10Z" fill={P.orange} />
  </g>
);
const Fish: React.FC<{ x?: number; y?: number; s?: number }> = ({ x = 0, y = 0, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M10 32l-6-10v20Z" fill={P.water} transform="translate(4 0)" />
    <ellipse cx="34" cy="32" rx="20" ry="12" fill={P.sky} />
    <path d="M30 21q6-8 12 0Z" fill={P.water} />
    <path d="M30 43q6 6 10 0Z" fill={P.water} />
    <path d="M44 26q-3 6 0 12" stroke={P.water} strokeWidth="1.5" fill="none" />
    <Eye x={48} y={29} r={2.2} />
  </g>
);
const Frog: React.FC<{ x?: number; y?: number; s?: number; tail?: boolean }> = ({ x = 0, y = 0, s = 1, tail }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {tail && <path d="M18 44q-10 2-12-4" stroke={P.green} strokeWidth="4" strokeLinecap="round" fill="none" />}
    <path d="M14 50q-4-4 4-6l6 4ZM50 50q4-4-4-6l-6 4Z" fill={P.greenD} />
    <ellipse cx="32" cy="40" rx="17" ry="12" fill={P.green} />
    <circle cx="24" cy="27" r="6" fill={P.green} />
    <circle cx="40" cy="27" r="6" fill={P.green} />
    <circle cx="24" cy="26" r="3" fill={P.white} />
    <circle cx="40" cy="26" r="3" fill={P.white} />
    <Eye x={24.5} y={26.5} r={1.5} />
    <Eye x={40.5} y={26.5} r={1.5} />
    <path d="M24 40q8 5 16 0" stroke={P.greenD} strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </g>
);
const Butterfly: Draw = () => (
  <g>
    <path d="M32 30C22 12 6 14 8 26c2 10 14 10 24 6Z" fill={P.violet} />
    <path d="M32 30C42 12 58 14 56 26c-2 10-14 10-24 6Z" fill={P.violet} />
    <path d="M32 34c-10 0-20 6-16 14 4 6 12 0 16-10Z" fill={P.pink} />
    <path d="M32 34c10 0 20 6 16 14-4 6-12 0-16-10Z" fill={P.pink} />
    <circle cx="18" cy="24" r="3" fill={P.violetL} />
    <circle cx="46" cy="24" r="3" fill={P.violetL} />
    <rect x="30" y="20" width="4" height="28" rx="2" fill={P.ink} />
    <path d="M31 21q-4-8-8-9M33 21q4-8 8-9" stroke={P.ink} strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </g>
);
const Caterpillar: Draw = () => (
  <g>
    <path d="M4 50h56" stroke={P.greenD} strokeWidth="3" strokeLinecap="round" />
    {[12, 20, 28, 36, 44].map((x, i) => <circle key={x} cx={x} cy={i % 2 ? 40 : 42} r="7" fill={i % 2 ? P.green : P.leaf} />)}
    <circle cx="52" cy="36" r="8" fill={P.green} />
    <Eye x={55} y={34} />
    <path d="M50 28l-2-6M55 28l2-6" stroke={P.ink} strokeWidth="1.5" strokeLinecap="round" />
  </g>
);
const Seed: Draw = () => (
  <g>
    <ellipse cx="32" cy="34" rx="14" ry="20" fill={P.tan} transform="rotate(20 32 34)" />
    <path d="M26 20q6 14 0 28" stroke={P.brown} strokeWidth="1.5" fill="none" transform="rotate(20 32 34)" opacity="0.6" />
    <ellipse cx="27" cy="26" rx="3" ry="6" fill={P.peach} opacity="0.7" transform="rotate(20 32 34)" />
  </g>
);
const Sprout: Draw = () => (
  <g>
    <path d="M10 54q22-10 44 0Z" fill={P.brown} />
    <rect x="31" y="28" width="3" height="22" rx="1.5" fill={P.greenD} />
    <path d="M32 34c-4-10-14-12-18-8 4 8 12 10 18 8Z" fill={P.green} />
    <path d="M33 30c4-10 14-12 18-8-4 8-12 10-18 8Z" fill={P.leaf} />
  </g>
);
const RiceTufts: React.FC<{ y: number; h: number; colour: string; heads?: boolean; xs?: number[] }> = ({ y, h, colour, heads, xs = [14, 26, 38, 50] }) => (
  <g>
    {xs.map((x) => (
      <g key={x}>
        {[-5, -2.5, 0, 2.5, 5].map((dx) => (
          <path key={dx} d={`M${x} ${y}Q${x + dx * 0.2} ${y - h * 0.6} ${x + dx} ${y - h + Math.abs(dx) * 1.2}`} stroke={colour} strokeWidth="2" strokeLinecap="round" fill="none" />
        ))}
        {heads && <path d={`M${x + 1} ${y - h + 2}q5 1 6 9`} stroke={P.orangeD} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 1.5" fill="none" />}
      </g>
    ))}
  </g>
);
const Mango: React.FC<{ x?: number; y?: number; s?: number }> = ({ x = 0, y = 0, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M18 18c10-8 26-6 30 8 4 14-4 28-16 30-12 2-18-8-16-20 1-6-4-12 2-18Z" fill={P.orange} transform="rotate(-20 32 34)" />
    <path d="M20 20c6-6 16-8 24-4-8 0-14 4-18 12Z" fill={P.green} opacity="0.6" transform="rotate(-20 32 34)" />
    <path d="M24 14q-2-6 2-8" stroke={P.brown} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M26 8q10-6 16 2-8 4-16-2Z" fill={P.green} />
  </g>
);
const Drum: React.FC<{ rice?: boolean }> = ({ rice }) => (
  <g>
    <path d="M14 30v18q18 10 36 0V30Z" fill={P.rose} />
    <path d="M14 36q18 10 36 0M14 42q18 10 36 0" stroke={P.roseL} strokeWidth="1.5" fill="none" />
    <ellipse cx="32" cy="30" rx="18" ry="6" fill={P.peach} stroke={P.tan} strokeWidth="1.5" />
    {rice
      ? [[24, 16], [30, 10], [37, 14], [42, 20], [27, 22], [34, 20]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="2.4" ry="1.3" fill={P.white} stroke={P.greyL} strokeWidth="0.8" transform={`rotate(${i * 35} ${x} ${y})`} />
      ))
      : <path d="M48 8l-12 18M56 14l-16 14" stroke={P.brown} strokeWidth="3" strokeLinecap="round" />}
    <path d="M8 24q-3 6 0 12M56 24q3 6 0 12" stroke={P.violet} strokeWidth="2" strokeLinecap="round" fill="none" />
  </g>
);

/* ---------- the picture table ---------- */

const PICS: Record<string, Draw> = {
  /* sky and light */
  sun: () => <Sun x={32} y={32} r={12} />,
  moon: () => <SkyBox fill={P.night}><FullMoon x={32} y={32} r={18} /><Star x={10} y={12} s={0.8} /><Star x={54} y={52} s={0.7} /></SkyBox>,
  "moon-crescent": () => <SkyBox fill={P.night}><Crescent x={32} y={32} r={18} bg={P.night} /><Star x={12} y={14} s={0.8} /></SkyBox>,
  "moon-half": () => <SkyBox fill={P.night}><HalfMoon x={32} y={32} r={18} /><Star x={12} y={14} s={0.8} /></SkyBox>,
  "moon-full": () => <SkyBox fill={P.night}><FullMoon x={32} y={32} r={18} /><Star x={12} y={14} s={0.8} /></SkyBox>,
  night: () => <SkyBox fill={P.night}><Crescent x={42} y={20} r={10} bg={P.night} /><Star x={14} y={14} /><Star x={22} y={30} s={0.7} /><Star x={50} y={42} s={0.8} /><Ground y={50} fill="#0F172A" /></SkyBox>,
  stars: () => <SkyBox fill={P.night}>{[[12, 12, 1], [30, 20, 1.3], [50, 12, 0.9], [18, 36, 0.8], [44, 34, 1.2], [28, 48, 0.9], [54, 52, 0.7]].map(([x, y, s], i) => <Star key={i} x={x} y={y} s={s} />)}</SkyBox>,
  sunrise: () => <SkyBox fill={P.peach}><Sun x={16} y={44} r={6} /><Ground y={48} /></SkyBox>,
  midday: () => <SkyBox fill={P.skyL}><Sun x={32} y={14} r={7} /><Ground y={48} /></SkyBox>,
  sunset: () => <SkyBox fill={P.orangeL}><Sun x={48} y={44} r={6} /><Ground y={48} fill={P.green} /></SkyBox>,
  "day-moon": () => <SkyBox fill={P.skyL}><circle cx="40" cy="22" r="12" fill={P.white} opacity="0.6" /><path d="M40 10A12 12 0 0 1 40 34Z" fill={P.white} /><Ground y={50} /></SkyBox>,
  rain: () => (
    <g>
      <path d="M16 34a10 10 0 0 1 4-19 13 13 0 0 1 25 3 8 8 0 0 1 3 16Z" fill={P.grey} />
      {[[20, 42], [30, 46], [40, 42], [24, 54], [36, 56], [46, 52]].map(([x, y], i) => <path key={i} d={`M${x} ${y}q-2 4 0 5q2-1 0-5Z`} fill={P.water} stroke={P.water} strokeWidth="2" strokeLinejoin="round" />)}
    </g>
  ),
  storm: () => (
    <g>
      <path d="M14 34a10 10 0 0 1 4-19 13 13 0 0 1 25 3 8 8 0 0 1 3 16Z" fill={P.inkSoft} />
      <path d="M32 32l-8 14h8l-4 14 14-20h-8l4-8Z" fill={P.violetL} stroke={P.violet} strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  ),
  rainbow: () => (
    <g fill="none" strokeWidth="5" strokeLinecap="round">
      {[[P.rose, 26], [P.orange, 21], [P.green, 16], [P.sky, 11], [P.violet, 6]].map(([c, r]) => <path key={c as string} d={`M${32 - (r as number)} 48a${r} ${r} 0 0 1 ${(r as number) * 2} 0`} stroke={c as string} />)}
    </g>
  ),
  "shadow-morning": () => <SkyBox fill={P.peach}><Sun x={14} y={34} r={4} /><Ground y={46} /><path d="M33 47l26 4-2 3-24-5Z" fill={P.greenD} opacity="0.75" /><Tree x={32} base={47} h={0.75} /></SkyBox>,
  "shadow-midday": () => <SkyBox fill={P.skyL}><Sun x={32} y={9} r={5} /><Ground y={46} /><ellipse cx="32" cy="48" rx="9" ry="2.5" fill={P.greenD} opacity="0.75" /><Tree x={32} base={47} h={0.75} /></SkyBox>,
  "shadow-evening": () => <SkyBox fill={P.orangeL}><Sun x={50} y={34} r={4} /><Ground y={46} fill={P.green} /><path d="M31 47l-26 4 2 3 24-5Z" fill={P.greenD} opacity="0.75" /><Tree x={32} base={47} h={0.75} /></SkyBox>,
  cave: () => (
    <g>
      <path d="M4 58q0-44 28-48 28 4 28 48Z" fill={P.grey} />
      <path d="M16 58q0-28 16-32 16 4 16 32Z" fill="#0F172A" />
      <path d="M10 30l6 2M50 24l6-2M44 44l8 2" stroke={P.inkSoft} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  mirror: () => (
    <g>
      <ellipse cx="32" cy="28" rx="18" ry="22" fill={P.violet} />
      <ellipse cx="32" cy="28" rx="14" ry="18" fill={P.skyL} />
      <path d="M24 18l10-6M24 26l14-8" stroke={P.white} strokeWidth="3" strokeLinecap="round" />
      <rect x="28" y="48" width="8" height="10" rx="2" fill={P.violet} />
    </g>
  ),
  lamp: () => (
    <g>
      {[0, 45, 90, 135, 180].map((a) => <line key={a} x1="32" y1="26" x2={32 + Math.cos(((a + 180) * Math.PI) / 180) * 26} y2={26 + Math.sin(((a + 180) * Math.PI) / 180) * 26} stroke={P.orangeL} strokeWidth="3" strokeLinecap="round" strokeDasharray="0 18 8 40" />)}
      <circle cx="32" cy="26" r="14" fill={P.peach} stroke={P.orange} strokeWidth="2" />
      <path d="M28 30l4-6 4 6" stroke={P.orange} strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="25" y="40" width="14" height="10" rx="2" fill={P.grey} />
      <path d="M25 44h14M25 47h14" stroke={P.greyL} strokeWidth="1.5" />
      <rect x="29" y="50" width="6" height="4" rx="2" fill={P.inkSoft} />
    </g>
  ),
  candle: () => (
    <g>
      <circle cx="32" cy="16" r="10" fill={P.orangeL} opacity="0.45" />
      <path d="M32 6q7 9 0 16-7-7 0-16Z" fill={P.orange} />
      <path d="M32 12q3 5 0 8-3-3 0-8Z" fill={P.peach} />
      <path d="M32 22v4" stroke={P.ink} strokeWidth="1.5" />
      <rect x="24" y="26" width="16" height="28" rx="3" fill={P.roseL} />
      <path d="M28 26v8" stroke={P.white} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="32" cy="56" rx="14" ry="3" fill={P.greyL} />
    </g>
  ),
  torch: () => (
    <g>
      <path d="M30 26L60 10v32Z" fill={P.orangeL} opacity="0.55" />
      <rect x="6" y="22" width="20" height="12" rx="3" fill={P.inkSoft} />
      <path d="M26 20h6v16h-6Z" fill={P.grey} />
      <rect x="12" y="25" width="6" height="3" rx="1.5" fill={P.rose} />
    </g>
  ),
  spoon: () => (
    <g>
      <ellipse cx="22" cy="24" rx="12" ry="15" fill={P.greyL} transform="rotate(-35 22 24)" />
      <ellipse cx="19" cy="20" rx="3" ry="6" fill={P.white} transform="rotate(-35 22 24)" />
      <path d="M30 34l22 22" stroke={P.greyL} strokeWidth="5" strokeLinecap="round" />
    </g>
  ),
  firefly: () => (
    <SkyBox fill={P.night}>
      <circle cx="38" cy="38" r="12" fill={P.emeraldL} opacity="0.35" />
      <ellipse cx="38" cy="38" rx="6" ry="5" fill={P.emeraldL} />
      <ellipse cx="28" cy="32" rx="8" ry="5" fill={P.inkSoft} />
      <ellipse cx="26" cy="24" rx="7" ry="4" fill={P.greyL} opacity="0.7" transform="rotate(-20 26 24)" />
      <circle cx="20" cy="31" r="3.5" fill={P.rose} />
      <path d="M18 29l-5-6M19 29l-2-8" stroke={P.greyL} strokeWidth="1.2" strokeLinecap="round" />
    </SkyBox>
  ),
  window: () => (
    <g>
      <rect x="8" y="8" width="48" height="48" rx="4" fill={P.brown} />
      <rect x="12" y="12" width="18" height="18" fill={P.skyL} />
      <rect x="34" y="12" width="18" height="18" fill={P.skyL} />
      <rect x="12" y="34" width="18" height="18" fill={P.skyL} />
      <rect x="34" y="34" width="18" height="18" fill={P.skyL} />
      <path d="M15 22l8-8M37 44l8-8" stroke={P.white} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  "glass-water": () => (
    <g>
      <path d="M18 10h28l-4 46H22Z" fill={P.skyXL} stroke={P.grey} strokeWidth="2" strokeLinejoin="round" />
      <path d="M19.5 26h25l-2.8 30H22.3Z" fill={P.skyL} />
      <path d="M24 30v20" stroke={P.white} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  bottle: () => (
    <g>
      <rect x="26" y="4" width="12" height="8" rx="2" fill={P.sky} />
      <path d="M27 12h10v6q8 4 8 12v24a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4V30q0-8 8-12Z" fill={P.skyXL} stroke={P.grey} strokeWidth="2" />
      <path d="M24 30v20" stroke={P.white} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  paper: () => (
    <g>
      <path d="M14 8h28l10 10v38H14Z" fill={P.greyXL} stroke={P.greyL} strokeWidth="1.5" />
      <path d="M42 8v10h10" fill={P.greyL} />
      <circle cx="32" cy="34" r="9" fill={P.orangeL} opacity="0.4" />
    </g>
  ),
  cloth: () => (
    <g>
      <path d="M8 10h48v4H8Z" fill={P.brown} />
      <path d="M10 14q0 22-2 40h48q-2-18-2-40Z" fill={P.violetL} opacity="0.55" />
      <path d="M20 16q-2 18 0 36M32 16q2 18 0 36M44 16q-2 18 0 36" stroke={P.violet} strokeWidth="1" opacity="0.4" fill="none" />
      <circle cx="32" cy="34" r="8" fill={P.orangeL} opacity="0.5" />
    </g>
  ),
  bag: () => (
    <g>
      <path d="M20 18q0-10 4-10M44 18q0-10-4-10" stroke={P.greyL} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M14 18h36l-3 38H17Z" fill={P.greyXL} stroke={P.greyL} strokeWidth="1.5" opacity="0.9" />
      <path d="M22 26q4 10 2 22M38 24q-2 12 2 24" stroke={P.greyL} strokeWidth="1.2" fill="none" />
    </g>
  ),
  door: () => (
    <g>
      <rect x="14" y="6" width="36" height="52" rx="3" fill={P.brown} />
      <rect x="19" y="11" width="26" height="18" rx="2" fill={P.brownD} opacity="0.5" />
      <rect x="19" y="33" width="26" height="20" rx="2" fill={P.brownD} opacity="0.5" />
      <circle cx="43" cy="32" r="2.5" fill={P.orange} />
    </g>
  ),
  pot: () => (
    <g>
      <rect x="10" y="22" width="44" height="6" rx="3" fill={P.inkSoft} />
      <path d="M12 28h40v18a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10Z" fill={P.grey} />
      <path d="M4 32h8M52 32h8" stroke={P.inkSoft} strokeWidth="4" strokeLinecap="round" />
      <path d="M18 34v14" stroke={P.greyL} strokeWidth="3" strokeLinecap="round" />
      <rect x="28" y="16" width="8" height="6" rx="2" fill={P.inkSoft} />
    </g>
  ),
  wall: () => (
    <g>
      <rect x="6" y="8" width="52" height="48" rx="3" fill={P.roseL} />
      {[0, 1, 2, 3, 4, 5].map((r) => (
        <g key={r}>
          <path d={`M6 ${16 + r * 8}h52`} stroke={P.white} strokeWidth="1.5" />
          {[0, 1, 2, 3].map((k) => <path key={k} d={`M${(r % 2 ? 12 : 18) + k * 13} ${8 + r * 8}v8`} stroke={P.white} strokeWidth="1.5" />)}
        </g>
      ))}
    </g>
  ),
  book: () => (
    <g>
      <rect x="14" y="8" width="36" height="48" rx="3" fill={P.rose} />
      <rect x="18" y="8" width="4" height="48" fill="#BE123C" opacity="0.4" />
      <rect x="26" y="16" width="18" height="8" rx="2" fill={P.white} opacity="0.85" />
      <path d="M48 12v42" stroke={P.white} strokeWidth="2" />
    </g>
  ),
  rock: () => (
    <g>
      <path d="M8 50q-2-16 12-24 8-10 20-6 16 4 18 22 2 10-8 12H16q-8 0-8-4Z" fill={P.grey} />
      <path d="M20 30q8-6 16-4" stroke={P.greyL} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M38 46q6-2 10 2" stroke={P.inkSoft} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </g>
  ),
  cup: () => (
    <g>
      <path d="M14 18h30v26a10 10 0 0 1-10 10h-10a10 10 0 0 1-10-10Z" fill={P.sky} />
      <path d="M44 24h4a7 7 0 0 1 0 14h-4" stroke={P.sky} strokeWidth="4" fill="none" />
      <path d="M20 24v18" stroke={P.skyL} strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  ball: () => (
    <g>
      <circle cx="32" cy="32" r="22" fill={P.rose} />
      <path d="M10 32h44" stroke={P.white} strokeWidth="5" />
      <path d="M32 10q-12 22 0 44" stroke={P.white} strokeWidth="3" fill="none" />
      <circle cx="24" cy="22" r="3" fill={P.white} opacity="0.6" />
    </g>
  ),
  car: () => (
    <g>
      <path d="M6 42v-8q0-6 6-6h6l6-10h18l8 10h4q4 0 4 6v8Z" fill={P.sky} />
      <path d="M26 20h7v8H21ZM36 20h5l6 8H36Z" fill={P.skyXL} />
      <circle cx="18" cy="44" r="6" fill={P.ink} />
      <circle cx="46" cy="44" r="6" fill={P.ink} />
      <circle cx="18" cy="44" r="2.5" fill={P.greyL} />
      <circle cx="46" cy="44" r="2.5" fill={P.greyL} />
    </g>
  ),
  robot: () => (
    <g>
      <path d="M32 6v6" stroke={P.inkSoft} strokeWidth="2" />
      <circle cx="32" cy="5" r="3" fill={P.rose} />
      <rect x="18" y="12" width="28" height="20" rx="5" fill={P.greyL} />
      <circle cx="26" cy="22" r="3.5" fill={P.sky} />
      <circle cx="38" cy="22" r="3.5" fill={P.sky} />
      <rect x="16" y="34" width="32" height="20" rx="5" fill={P.grey} />
      <rect x="26" y="40" width="12" height="6" rx="2" fill={P.violetL} />
      <path d="M16 40h-6M48 40h6M24 54v6M40 54v6" stroke={P.inkSoft} strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  water: () => (
    <g>
      <path d="M32 6q18 22 18 34a18 18 0 0 1-36 0q0-12 18-34Z" fill={P.sky} />
      <path d="M24 38q0 8 6 10" stroke={P.white} strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  ),
  blanket: () => (
    <g>
      <rect x="8" y="18" width="48" height="30" rx="5" fill={P.violet} />
      <path d="M8 26h48M8 40h48" stroke={P.violetL} strokeWidth="3" />
      <path d="M20 18v30M44 18v30" stroke={P.violetL} strokeWidth="1.5" />
    </g>
  ),
  milk: () => (
    <g>
      <path d="M18 10h28l-4 46H22Z" fill={P.greyXL} stroke={P.greyL} strokeWidth="2" strokeLinejoin="round" />
      <path d="M19 18h26l-3.4 38H22.4Z" fill={P.white} stroke={P.greyL} strokeWidth="1" />
    </g>
  ),
  "rice-bowl": () => (
    <g>
      <path d="M14 30q4-14 18-14t18 14Z" fill={P.white} stroke={P.greyL} strokeWidth="1.5" />
      <path d="M8 30h48q-2 22-24 22T8 30Z" fill={P.sky} />
      <path d="M14 38q18 8 36 0" stroke={P.skyL} strokeWidth="2" fill="none" />
    </g>
  ),
  ice: () => (
    <g>
      <rect x="10" y="26" width="22" height="22" rx="4" fill={P.skyL} stroke={P.sky} strokeWidth="1.5" transform="rotate(-8 21 37)" />
      <rect x="30" y="20" width="22" height="22" rx="4" fill={P.skyXL} stroke={P.sky} strokeWidth="1.5" transform="rotate(10 41 31)" />
      <path d="M15 32l6-4M35 26l6-3" stroke={P.white} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  smoke: () => (
    <g>
      <circle cx="30" cy="30" r="8" fill={P.greyL} />
      <circle cx="38" cy="22" r="7" fill={P.grey} />
      <circle cx="30" cy="14" r="6" fill={P.greyL} />
      <circle cx="38" cy="8" r="4" fill={P.grey} />
      <path d="M32 54q-12-4-8-16 4 6 6 2-2-8 6-14 0 8 6 10 4 8-2 16Z" fill={P.orange} />
      <path d="M32 54q-6-2-4-8 3 3 4 0 4 2 4 6-1 2-4 2Z" fill={P.peach} />
      <path d="M16 58l32-6M16 52l32 6" stroke={P.brown} strokeWidth="5" strokeLinecap="round" />
    </g>
  ),

  /* plants */
  tree: () => <Tree x={32} base={58} h={1.2} />,
  flower: () => (
    <g>
      <path d="M32 30v26" stroke={P.greenD} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 46q-10-6-14 0 8 4 14 0Z" fill={P.green} />
      {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="32" cy="12" rx="6" ry="9" fill={P.pink} transform={`rotate(${a} 32 22)`} />)}
      <circle cx="32" cy="22" r="5" fill={P.orange} />
    </g>
  ),
  sprout: Sprout,
  seed: Seed,
  "plant-seed": Seed,
  "plant-root": () => <PlantDiagram on="root" />,
  "plant-stem": () => <PlantDiagram on="stem" />,
  "plant-leaf": () => <PlantDiagram on="leaf" />,
  "plant-flower": () => <PlantDiagram on="flower" />,
  "plant-dry": () => (
    <g>
      <path d="M32 44V28q0-12-12-10" stroke={P.brown} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M21 18q-6 4-6 14 5-3 7-8Z" fill={P.tan} />
      <path d="M24 19q4 6 2 14-4-4-4-10Z" fill={P.tan} />
      <path d="M32 32q8 0 12 10-6 0-12-6Z" fill={P.tan} />
      <path d="M18 44h28l-4 14H22Z" fill={P.orangeD} />
      <rect x="16" y="42" width="32" height="5" rx="2" fill={P.brown} />
      <path d="M23 44l3 2-2 2M38 43l-2 2 3 2" stroke={P.brownD} strokeWidth="1.2" fill="none" />
    </g>
  ),
  "rice-plant": () => <g><path d="M8 56h48" stroke={P.brown} strokeWidth="3" strokeLinecap="round" /><RiceTufts y={56} h={40} colour={P.green} heads xs={[22, 32, 42]} /></g>,
  "rice-field": () => <SkyBox fill={P.skyXL}><rect x="2" y="40" width="60" height="22" rx="0" fill={P.skyL} /><path d="M2 40h60v10a12 12 0 0 1-12 12H14A12 12 0 0 1 2 50Z" fill={P.skyL} /><RiceTufts y={52} h={22} colour={P.green} xs={[10, 22, 34, 46, 56]} /></SkyBox>,
  "rice-seedling": () => <SkyBox fill={P.skyXL}><path d="M2 44h60v6a12 12 0 0 1-12 12H14A12 12 0 0 1 2 50Z" fill={P.skyL} /><RiceTufts y={50} h={12} colour={P.leaf} xs={[12, 24, 36, 48]} /></SkyBox>,
  "rice-green": () => <SkyBox fill={P.skyXL}><path d="M2 44h60v6a12 12 0 0 1-12 12H14A12 12 0 0 1 2 50Z" fill={P.skyL} /><RiceTufts y={50} h={36} colour={P.green} xs={[12, 24, 36, 48]} /></SkyBox>,
  "rice-golden": () => <SkyBox fill={P.peach}><path d="M2 44h60v6a12 12 0 0 1-12 12H14A12 12 0 0 1 2 50Z" fill={P.tan} /><RiceTufts y={50} h={36} colour={P.tan} heads xs={[12, 24, 36, 48]} /></SkyBox>,
  "rice-harvest": () => (
    <g>
      {[18, 32, 46].map((x) => (
        <g key={x}>
          <path d={`M${x} 56l-6-34M${x} 56v-36M${x} 56l6-34`} stroke={P.tan} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${x - 6} 22q2-6 6-4q4-2 6 4`} stroke={P.orangeD} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 2" fill="none" />
          <rect x={x - 5} y="40" width="10" height="4" rx="2" fill={P.brown} />
        </g>
      ))}
    </g>
  ),
  mango: () => <Mango x={2} y={4} s={1.05} />,
  "mango-tree": () => <Tree x={32} base={60} h={1.15} fruit />,
  "mango-young": () => <Tree x={32} base={58} h={0.7} />,
  "banana-tree": () => (
    <g>
      <rect x="29" y="26" width="7" height="34" rx="3" fill={P.green} />
      <path d="M32 28q-20-10-26 6 14-8 26-4ZM32 26q20-12 28 2-14-6-28 0ZM32 26q-6-20 4-22 2 12-4 22Z" fill={P.leaf} />
      <g fill={P.greenD}>{[0, 1, 2].map((i) => <path key={i} d={`M36 ${36 + i * 6}q8 0 10-4`} stroke={P.greenD} strokeWidth="4" strokeLinecap="round" fill="none" />)}</g>
    </g>
  ),
  "coconut-tree": () => (
    <g>
      <path d="M30 60q2-24 6-40" stroke={P.brown} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M36 20q-20-8-30 6 16-4 30-6ZM36 20q20-10 26 6-12-6-26-6ZM36 20q-8-14 4-18 0 8-4 18ZM36 20q14-14 22-8-12 2-22 8Z" fill={P.green} />
      <circle cx="33" cy="24" r="3.5" fill={P.brownD} />
      <circle cx="39" cy="24" r="3.5" fill={P.brownD} />
    </g>
  ),
  lotus: () => (
    <g>
      <rect x="4" y="36" width="56" height="12" fill={P.skyL} />
      <rect x="4" y="48" width="56" height="12" rx="4" fill={P.brown} />
      <path d="M32 48v6M32 54l-6 4M32 54l6 4" stroke={P.peach} strokeWidth="2" strokeLinecap="round" />
      <path d="M32 48V24" stroke={P.greenD} strokeWidth="2.5" />
      <ellipse cx="48" cy="36" rx="10" ry="3" fill={P.green} />
      <path d="M32 26q-10-2-10-12 6 2 10 10ZM32 26q10-2 10-12-6 2-10 10ZM32 26q-4-12 0-18 4 6 0 18Z" fill={P.pink} />
    </g>
  ),
  durian: () => (
    <g>
      <path d="M32 14V6" stroke={P.brown} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="32" cy="37" rx="19" ry="21" fill={P.greenD} />
      <ellipse cx="32" cy="37" rx="17" ry="19" fill="#65A30D" />
      {[[24, 24], [32, 22], [40, 24], [20, 32], [28, 31], [36, 31], [44, 32], [18, 41], [26, 40], [34, 40], [42, 40], [22, 49], [30, 49], [38, 49], [46, 47], [32, 56]].map(([x, y], i) => (
        <path key={i} d={`M${x - 3} ${y + 2}L${x} ${y - 3}L${x + 3} ${y + 2}Z`} fill={P.greenD} />
      ))}
    </g>
  ),

  /* animals */
  dog: () => <Dog x={2} y={2} />,
  puppies: () => <g><Dog x={-4} y={10} s={0.62} coat={P.tan} /><Dog x={20} y={18} s={0.62} coat={P.greyL} spot={P.inkSoft} /><Dog x={30} y={4} s={0.62} coat={P.brownD} /></g>,
  cat: () => <Cat />,
  kittens: () => <g><Cat x={-6} y={2} s={0.85} /><Cat x={28} y={26} s={0.5} coat={P.orangeL} /><Cat x={40} y={30} s={0.45} coat={P.grey} patch={P.white} /></g>,
  "cat-carry": () => <g><Cat x={-4} y={0} s={0.95} /><Cat x={26} y={30} s={0.42} coat={P.orangeL} /></g>,
  fish: () => <Fish />,
  bird: () => (
    <g>
      <path d="M14 36l-8 8h12Z" fill={P.violet} />
      <ellipse cx="30" cy="36" rx="16" ry="13" fill={P.violet} />
      <path d="M22 34q10-14 22-6-6 10-22 6Z" fill={P.violetL} />
      <circle cx="42" cy="24" r="9" fill={P.violet} />
      <path d="M50 22l8 3-8 3Z" fill={P.orange} />
      <Eye x={44} y={22} />
      <path d="M26 48l-2 8M34 48l2 8" stroke={P.orangeD} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  nest: () => (
    <g>
      <path d="M8 40q24 26 48 0Z" fill={P.brown} />
      <path d="M10 42q22 8 44 0" stroke={P.tan} strokeWidth="2" fill="none" />
      {[22, 40].map((x) => (
        <g key={x}>
          <circle cx={x} cy="36" r="7" fill={P.violetL} />
          <path d={`M${x - 3} 30l3-8 3 8Z`} fill={P.orange} />
          <Eye x={x - 3} y={34} r={1.4} />
        </g>
      ))}
      <g transform="translate(26 -4) scale(0.5)">
        <ellipse cx="30" cy="36" rx="16" ry="13" fill={P.violet} />
        <circle cx="42" cy="24" r="9" fill={P.violet} />
        <path d="M44 30l8 10" stroke={P.pink} strokeWidth="3" strokeLinecap="round" />
        <path d="M50 22l8 3-8 3Z" fill={P.orange} />
      </g>
    </g>
  ),
  hen: () => <Hen />,
  rooster: () => <Hen rooster />,
  chick: () => <Chick />,
  "hen-nest": () => (
    <g>
      <Hen x={4} y={-6} s={0.9} />
      <path d="M6 48q26 14 52 0v6q-26 10-52 0Z" fill={P.tan} />
      <ellipse cx="14" cy="50" rx="4" ry="5" fill={P.peach} stroke={P.tan} />
      <ellipse cx="50" cy="50" rx="4" ry="5" fill={P.peach} stroke={P.tan} />
    </g>
  ),
  egg: () => <ellipse cx="32" cy="34" rx="15" ry="20" fill={P.peach} stroke={P.tan} strokeWidth="2" />,
  duck: () => <Duck />,
  ducklings: () => <g><Duck x={-2} y={-4} s={0.66} /><Duck x={28} y={28} s={0.42} /><Duck x={42} y={32} s={0.36} /></g>,
  frog: () => <Frog />,
  froglet: () => <Frog s={0.85} x={6} y={8} tail />,
  tadpole: () => (
    <g>
      <path d="M30 34q14-8 26 2-10 0-26 2Z" fill={P.inkSoft} />
      <circle cx="24" cy="34" r="11" fill={P.ink} />
      <circle cx="20" cy="31" r="2" fill={P.white} />
    </g>
  ),
  "frog-eggs": () => (
    <g>
      {[[20, 22], [32, 18], [44, 24], [16, 36], [28, 32], [40, 36], [24, 46], [36, 48], [48, 44]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="7" fill={P.skyXL} stroke={P.skyL} strokeWidth="1.5" /><circle cx={x} cy={y} r="2.5" fill={P.ink} /></g>
      ))}
    </g>
  ),
  caterpillar: Caterpillar,
  chrysalis: () => (
    <g>
      <path d="M8 10h48" stroke={P.brown} strokeWidth="4" strokeLinecap="round" />
      <path d="M32 10v6" stroke={P.greyL} strokeWidth="2" />
      <path d="M32 16q12 10 8 30-4 10-8 12-4-2-8-12-4-20 8-30Z" fill={P.green} />
      <path d="M28 26q4 12 0 24M36 26q-4 12 0 24" stroke={P.greenD} strokeWidth="1.2" fill="none" />
    </g>
  ),
  butterfly: Butterfly,
  snail: () => (
    <g>
      <path d="M6 50q0-6 10-6h36q6 0 6 6Z" fill={P.greyL} />
      <path d="M50 44q4-10 2-16M54 44q4-8 6-14" stroke={P.greyL} strokeWidth="3" strokeLinecap="round" />
      <circle cx="30" cy="32" r="16" fill={P.orange} />
      <path d="M30 32m-10 0a10 10 0 1 0 10-10 7 7 0 1 0 6 7" stroke={P.orangeD} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  turtle: () => (
    <g>
      <path d="M14 46l-4 8h8ZM46 46l4 8h-8Z" fill={P.green} />
      <circle cx="54" cy="38" r="6" fill={P.green} />
      <Eye x={56} y={36} />
      <path d="M8 44q0-26 24-26t24 26Z" fill={P.greenD} />
      <circle cx="32" cy="30" r="5" fill={P.leaf} /><circle cx="21" cy="37" r="4" fill={P.leaf} /><circle cx="43" cy="37" r="4" fill={P.leaf} />
    </g>
  ),
  elephant: () => (
    <g>
      <ellipse cx="34" cy="34" rx="20" ry="15" fill={P.grey} />
      <rect x="18" y="40" width="7" height="16" rx="3" fill={P.grey} />
      <rect x="40" y="40" width="7" height="16" rx="3" fill={P.grey} />
      <circle cx="16" cy="28" r="12" fill={P.grey} />
      <path d="M10 34q-6 10-2 20 2 2 4 0-2-8 4-16" fill={P.grey} />
      <ellipse cx="22" cy="28" rx="7" ry="10" fill={P.greyL} />
      <Eye x={12} y={25} />
      <path d="M8 34l-2 4" stroke={P.white} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  rabbit: () => (
    <g>
      <ellipse cx="22" cy="16" rx="4" ry="13" fill={P.greyL} />
      <ellipse cx="32" cy="14" rx="4" ry="13" fill={P.greyL} />
      <ellipse cx="22" cy="16" rx="1.8" ry="9" fill={P.roseL} />
      <ellipse cx="32" cy="14" rx="1.8" ry="9" fill={P.roseL} />
      <ellipse cx="34" cy="46" rx="16" ry="12" fill={P.greyL} />
      <circle cx="27" cy="32" r="9" fill={P.greyL} />
      <circle cx="49" cy="48" r="4" fill={P.white} />
      <Eye x={24} y={31} />
      <circle cx="19" cy="34" r="1.5" fill={P.rose} />
    </g>
  ),
  crocodile: () => (
    <g>
      <path d="M38 56q4-18 18-18 6 0 6 18Z" fill={P.brown} />
      <ellipse cx="48" cy="48" rx="3" ry="4" fill={P.peach} />
      <ellipse cx="55" cy="49" rx="3" ry="4" fill={P.peach} />
      <path d="M2 40q2-6 10-6h14q8-4 14 0l-2 6q-6 6-16 6H8q-6 0-6-6Z" fill={P.greenD} />
      <path d="M38 40q6 2 8 8-6-2-10-4Z" fill={P.greenD} />
      <path d="M14 34l2-4 2 4M20 34l2-4 2 4M26 32l2-4 2 4" fill={P.green} />
      <path d="M2 40h12" stroke={P.green} strokeWidth="1.5" />
      <Eye x={11} y={36} />
      <path d="M10 46v6M28 46v6" stroke={P.greenD} strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  baby: () => (
    <g>
      <ellipse cx="32" cy="42" rx="16" ry="14" fill={P.skyL} />
      <path d="M18 42q14 6 28 0" stroke={P.sky} strokeWidth="2" fill="none" />
      <circle cx="32" cy="22" r="12" fill={P.skin} />
      <path d="M30 10q2-4 5 0" stroke={P.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M27 22a1.5 1.5 0 0 0 3 0M34 22a1.5 1.5 0 0 0 3 0" stroke={P.ink} strokeWidth="1.5" fill="none" />
      <ellipse cx="32" cy="28" rx="3" ry="2" fill={P.rose} />
    </g>
  ),
  child: () => <Person x={32} base={60} h={40} shirt={P.sky} />,
  adult: () => <Person x={32} base={60} h={56} shirt={P.violet} />,

  /* body */
  ear: () => (
    <g>
      <path d="M38 8c-14 0-22 10-22 22 0 8 4 10 6 14s2 12 10 12c6 0 8-6 8-10" fill={P.skin} />
      <path d="M38 8c10 0 14 10 12 18-2 6-8 8-10 14" fill={P.skin} stroke={P.skinD} strokeWidth="0" />
      <path d="M26 30c0-8 6-12 12-10 6 2 4 10 0 12-2 2-2 6 0 8" stroke={P.skinD} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  ),
  eye: () => (
    <g>
      <path d="M6 32q26-26 52 0-26 26-52 0Z" fill={P.white} stroke={P.ink} strokeWidth="2" />
      <circle cx="32" cy="32" r="10" fill={P.brown} />
      <circle cx="32" cy="32" r="5" fill={P.ink} />
      <circle cx="35" cy="29" r="2" fill={P.white} />
      <path d="M14 22l-3-5M24 16l-1-6M40 16l1-6M50 22l3-5" stroke={P.ink} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  nose: () => (
    <g>
      <path d="M34 8q-4 22-14 32q-4 6 4 10q8 4 16 0q6-3 2-8" fill={P.skin} />
      <path d="M26 44q4 3 8 0" stroke={P.skinD} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M34 8q-4 22-14 32" stroke={P.skinD} strokeWidth="2" fill="none" />
    </g>
  ),
  tongue: () => (
    <g>
      <path d="M8 26q24-10 48 0-4 26-24 26T8 26Z" fill={P.rose} />
      <path d="M12 27q20-4 40 0v4H12Z" fill={P.white} />
      <path d="M20 36q12-4 24 0-2 14-12 14t-12-14Z" fill={P.pink} />
      <path d="M32 38v8" stroke={P.rose} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
  hand: () => (
    <g fill={P.skin}>
      <rect x="18" y="28" width="28" height="28" rx="10" />
      {[[18, 12], [25, 6], [32, 4], [39, 8]].map(([x, y], i) => <rect key={i} x={x} y={y} width="6" height="30" rx="3" />)}
      <rect x="40" y="30" width="6" height="18" rx="3" transform="rotate(-40 43 39)" />
    </g>
  ),
  throat: () => (
    <g>
      <circle cx="28" cy="20" r="13" fill={P.skin} />
      <rect x="22" y="30" width="12" height="16" fill={P.skin} />
      <path d="M12 58q0-12 16-12t16 12Z" fill={P.sky} />
      <rect x="26" y="34" width="16" height="7" rx="3.5" fill={P.skinD} />
      <path d="M46 30q4 6 0 12M51 27q6 9 0 18" stroke={P.violet} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Eye x={33} y={18} />
      <path d="M31 25q3 2 5 0" stroke={P.ink} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </g>
  ),

  /* sound makers */
  drum: () => <Drum />,
  "drum-rice": () => <Drum rice />,
  bell: () => (
    <g>
      <path d="M32 8a4 4 0 0 1 4 4q12 4 12 20v10l4 6H12l4-6V32q0-16 12-20a4 4 0 0 1 4-4Z" fill={P.violet} />
      <path d="M22 30q0-10 8-12" stroke={P.violetL} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="52" r="5" fill={P.inkSoft} />
      <path d="M6 24q-3 6 0 12M58 24q3 6 0 12" stroke={P.violet} strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  ),
  guitar: () => (
    <g transform="rotate(-35 32 32)">
      <rect x="29" y="2" width="6" height="30" rx="2" fill={P.brownD} />
      <rect x="27" y="0" width="10" height="6" rx="2" fill={P.ink} />
      <path d="M32 26c-10 0-12 8-8 12-8 4-8 20 8 20s16-16 8-20c4-4 2-12-8-12Z" fill={P.tan} />
      <circle cx="32" cy="42" r="4" fill={P.brownD} />
      <path d="M31 4v50M33 4v50" stroke={P.white} strokeWidth="0.8" />
    </g>
  ),
};

/** Steps in an order sequence are drawn as `<seq>-<step>`; most reuse a picture above. */
const ALIASES: Record<string, string> = {
  "mango-seed": "seed",
  "mango-sprout": "sprout",
  "mango-fruit": "mango-tree",
  "chicken-egg": "egg",
  "chicken-chick": "chick",
  "chicken-hen": "hen",
  "frog-eggs": "frog-eggs",
  "frog-tadpole": "tadpole",
  "frog-froglet": "froglet",
  "frog-frog": "frog",
  "butterfly-egg": "egg-small",
  "butterfly-caterpillar": "caterpillar",
  "butterfly-chrysalis": "chrysalis",
  "butterfly-butterfly": "butterfly",
  "person-baby": "baby",
  "person-child": "child",
  "person-adult": "adult",
  "sun-sunrise": "sunrise",
  "sun-midday": "midday",
  "sun-sunset": "sunset",
  "sun-night": "night",
};

PICS["egg-small"] = () => (
  <g>
    <path d="M6 40q26-24 52 0-26 12-52 0Z" fill={P.green} />
    <path d="M32 34v-6" stroke={P.greenD} strokeWidth="1.5" />
    {[[24, 34], [32, 31], [40, 34]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="3" ry="4" fill={P.peach} stroke={P.tan} />)}
  </g>
);

export const resolvePic = (id: string): string => ALIASES[id] ?? id;
export const hasPic = (id: string): boolean => resolvePic(id) in PICS;
export const PIC_IDS = Object.keys(PICS);

export const Pic: React.FC<{ id: string; className?: string }> = ({ id, className }) => {
  const draw = PICS[resolvePic(id)];
  if (!draw) return null;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" data-pic={resolvePic(id)}>
      {draw()}
    </svg>
  );
};
