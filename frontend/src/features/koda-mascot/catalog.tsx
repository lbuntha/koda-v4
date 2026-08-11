import React from "react";
import { sanitizeSvgMarkup } from "../../assets/svgSafety";
import type { MascotAssetDefinition, MascotPalette, MascotPartCategory } from "./types";

export const CATEGORY_LABELS: Record<MascotPartCategory, string> = {
  body: "Bodies",
  head: "Heads",
  eyes: "Eyes",
  pupil: "Pupils",
  mouth: "Mouths",
  pattern: "Patterns",
  accessory: "Accessories",
};

const define = (category: MascotPartCategory, names: string[]): MascotAssetDefinition[] =>
  names.map((name) => ({ id: `${category}-${name.toLowerCase().replaceAll(" ", "-")}`, name, category }));

export const MASCOT_ASSETS: MascotAssetDefinition[] = [
  ...define("body", ["Bear Cub", "Bell", "Blob", "Boulder", "Column", "Cube", "Dollop", "Egg", "Fox Friend", "Gentle Giant", "Gumdrop", "Jelly Bean", "Lean", "Little Story", "Loaf", "Pear", "Plush Round", "Rounded Diamond", "Sitting Cub", "Slug", "Soft Pentagon", "Soft Triangle", "Squat", "Stack", "Tall Arch", "Tall Story", "Tiny Bird", "Wide Pebble"]),
  ...define("head", ["Default"]),
  ...define("eyes", ["Bear", "Bear Closed", "Bear Dizzy", "Bear Wink", "Big", "Closed Friendly", "Dots", "Down", "Even", "Googly", "Happy", "Inward", "Mono", "Open Curious", "Open Friendly", "Outward", "Pinprick", "Side", "Tiny", "Trio", "Up", "White Oval", "White Round", "Wink", "Variant 01", "Variant 02", "Variant 03", "Variant 04", "Variant 05", "Variant 06", "Variant 07", "Variant 08"]),
  ...define("pupil", ["Round", "Small", "Curious", "Crossed"]),
  ...define("mouth", ["Bear Open", "Bear Smile", "Cat", "Dot", "Frown", "Grin", "Laugh", "Line", "O", "Open", "Open Small", "Pout", "Smile", "Smile Big", "Smile Tongue", "Smirk", "Talk O", "Talk Rest", "Talk Small", "Talk Wide", "Teeth", "Tongue", "Toothy", "UU", "Wavy", "Zigzag", "Variant 01", "Variant 02", "Variant 03", "Variant 04", "Variant 05"]),
  ...define("pattern", ["Bear Muzzle", "Belly Patch", "Buttons", "Checker", "Coil", "Freckles", "Jelly Shine", "Panda Patches", "Patch", "Pellets", "Prints", "Raccoon Mask", "Spiral", "Stitches", "Zig"]),
  ...define("accessory", ["Antenna", "Baseball Cap", "Bear Ears", "Beanie", "Bird Beak", "Bird Wing", "Bucket Hat", "Crest", "Curl", "Ears", "Elephant Ears", "Elephant Trunk", "Fluffy Ears", "Fox Ears", "Fox Tail", "Graduation Cap", "Gummy Ears", "Horns Small", "Horns", "Loop", "Nub", "Open Book", "Panda Ears", "Party Hat", "Peak", "Pellet", "Spikes", "Striped Tail", "Story Ears", "Swirl", "Teddy Ears", "Top Hat", "Tuft", "Wave Paw", "Wizard Hat"]),
];

export const DEFAULT_PALETTE: MascotPalette = {
  primary: "#534AB7",
  secondary: "#7C6DD8",
  accent: "#EF9F27",
  ink: "#0E0B55",
  white: "#FFFFFF",
};

const Eye = ({ cx, cy, r = 15, pupilX = cx, pupilY = cy + 2, palette }: { cx: number; cy: number; r?: number; pupilX?: number; pupilY?: number; palette: MascotPalette }) => (
  <g><circle cx={cx + 1} cy={cy + 4} r={r} fill="#00000018" /><circle cx={cx} cy={cy} r={r} fill={palette.white} /><circle cx={pupilX} cy={pupilY} r={Math.max(3, r * .38)} fill={palette.ink} /><circle cx={pupilX - 2} cy={pupilY - 3} r={Math.max(1.2, r * .1)} fill={palette.white} /></g>
);

const friendlyFaceColor = (palette: MascotPalette) => {
  const hex = palette.primary.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return palette.white;
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return (.2126 * red + .7152 * green + .0722 * blue) / 255 > .72 ? palette.ink : palette.white;
};

const Bodies = ({ name, p, outline }: { name: string; p: MascotPalette; outline: boolean }) => {
  const common = { fill: p.primary, stroke: outline ? p.secondary : "none", strokeWidth: outline ? 3 : 0 };
  if (name === "Bear Cub") return <path d="M20 111V62C20 31 38 15 64 15C90 15 108 31 108 62V111Z" {...common}/>;
  if (name === "Bell") return <path d="M31 109 Q40 92 41 47 Q42 20 64 20 Q86 20 87 47 Q88 92 97 109 Z" {...common} />;
  if (name === "Blob") return <path d="M25 102 Q18 83 29 70 Q20 52 37 43 Q43 23 63 27 Q78 20 87 36 Q108 43 99 62 Q112 78 101 101 Q76 111 25 102Z" {...common} />;
  if (name === "Boulder") return <path d="M24 98 Q17 72 29 48 Q41 25 67 25 Q94 27 105 55 Q112 83 98 102 Q57 111 24 98Z" {...common} />;
  if (name === "Column") return <path d="M38 111 Q34 62 42 22 Q64 13 86 22 Q94 62 90 111Z" {...common} />;
  if (name === "Cube") return <rect x="25" y="24" width="78" height="86" rx="22" {...common} />;
  if (name === "Dollop") return <path d="M27 106 Q18 74 40 56 Q55 45 54 33 Q63 19 70 35 Q72 45 87 53 Q108 69 99 105Z" {...common} />;
  if (name === "Egg") return <path d="M26 105 Q22 72 38 38 Q49 14 65 15 Q82 16 94 43 Q108 76 99 105Z" {...common} />;
  if (name === "Fox Friend") return <path d="M26 109C17 91 21 61 38 43C46 34 55 29 64 28C79 29 91 40 98 55C108 74 109 96 101 109C82 115 44 115 26 109Z" {...common}/>;
  if (name === "Gentle Giant") return <path d="M18 107C11 86 15 53 34 34C51 17 80 17 98 34C116 52 120 85 109 106C92 116 38 117 18 107Z" {...common}/>;
  if (name === "Gumdrop") return <path d="M25 106 Q24 63 54 25 Q63 13 71 27 Q103 64 102 106Z" {...common} />;
  if (name === "Jelly Bean") return <path d="M24 102C15 82 20 49 36 31C49 16 76 14 92 29C108 45 113 79 102 101C89 113 38 114 24 102Z" {...common} opacity=".9"/>;
  if (name === "Lean") return <path d="M35 109 Q28 73 43 28 Q51 12 66 22 Q84 40 95 105Z" {...common} />;
  if (name === "Little Story") return <path d="M24 107C16 88 20 59 36 42C50 27 77 25 93 40C109 56 113 87 102 107C83 115 43 115 24 107Z" {...common}/>;
  if (name === "Loaf") return <path d="M18 105 Q12 69 36 47 Q62 27 94 45 Q116 61 111 103 Q65 113 18 105Z" {...common} />;
  if (name === "Pear") return <path d="M29 106 Q20 82 34 63 Q46 48 49 26 Q64 10 76 29 Q79 48 93 62 Q109 81 98 106Z" {...common} />;
  if (name === "Plush Round") return <path d="M22 101C12 84 17 54 31 37C45 20 83 18 98 38C111 56 115 83 104 101C91 114 36 114 22 101Z" {...common}/>;
  if (name === "Rounded Diamond") return <path d="M57 10Q64 5 71 10L116 53Q123 61 117 70L74 116Q65 124 56 117L11 74Q4 66 10 57Z" {...common}/>;
  if (name === "Sitting Cub") return <path d="M27 105C18 88 22 62 34 47C36 29 48 20 64 20C80 20 92 29 94 47C106 62 110 88 101 105C83 113 45 113 27 105Z" {...common}/>;
  if (name === "Slug") return <path d="M17 105 Q14 68 40 51 Q66 33 88 56 Q108 72 113 94 Q119 108 96 108Z" {...common} />;
  if (name === "Soft Pentagon") return <path d="M55 9Q65 5 74 12L112 47Q119 54 116 65L104 105Q101 115 90 117L43 124Q33 125 26 117L10 96Q4 88 8 78L22 35Q25 25 36 21Z" {...common}/>;
  if (name === "Soft Triangle") return <path d="M57 12Q64 3 71 13L117 99Q122 111 108 114L20 114Q7 112 12 100Z" {...common}/>;
  if (name === "Squat") return <path d="M17 104 Q12 74 34 57 Q62 34 95 55 Q116 70 111 103Z" {...common} />;
  if (name === "Tall Arch") return <path d="M20 112V61Q20 18 64 18Q108 18 108 61V112Z" {...common} />;
  if (name === "Tall Story") return <path d="M31 111C26 88 27 48 39 26C50 7 78 7 89 26C101 48 103 88 97 111C79 116 49 116 31 111Z" {...common}/>;
  if (name === "Tiny Bird") return <path d="M26 100C17 82 23 55 42 43C59 32 84 37 98 53C111 69 109 93 97 105C76 113 44 111 26 100Z" {...common}/>;
  if (name === "Wide Pebble") return <path d="M12 92C7 70 20 43 43 34C68 24 99 34 112 55C124 75 118 99 102 108C78 118 35 116 18 105Q13 100 12 92Z" {...common}/>;
  return <g><circle cx="64" cy="40" r="27" {...common} /><ellipse cx="64" cy="89" rx="31" ry="28" {...common} /></g>;
};

const Eyes = ({ name, p }: { name: string; p: MascotPalette }) => {
  const face = friendlyFaceColor(p);
  if (name === "White Round") return <g><circle cx="44" cy="64" r="21" fill="#00000018" transform="translate(1 3)"/><circle cx="84" cy="64" r="21" fill="#00000018" transform="translate(1 3)"/><circle cx="44" cy="64" r="21" fill={p.white}/><circle cx="84" cy="64" r="21" fill={p.white}/></g>;
  if (name === "White Oval") return <g><ellipse cx="44" cy="64" rx="18" ry="24" fill="#00000018" transform="translate(1 3)"/><ellipse cx="84" cy="64" rx="18" ry="24" fill="#00000018" transform="translate(1 3)"/><ellipse cx="44" cy="64" rx="18" ry="24" fill={p.white}/><ellipse cx="84" cy="64" rx="18" ry="24" fill={p.white}/></g>;
  if (name === "Round") return <g><circle cx="44" cy="66" r="9" fill={p.ink}/><circle cx="84" cy="66" r="9" fill={p.ink}/><circle cx="41" cy="62" r="2" fill={p.white}/><circle cx="81" cy="62" r="2" fill={p.white}/></g>;
  if (name === "Small") return <g fill={p.ink}><circle cx="44" cy="66" r="5"/><circle cx="84" cy="66" r="5"/></g>;
  if (name === "Curious") return <g><circle cx="49" cy="62" r="8" fill={p.ink}/><circle cx="89" cy="62" r="8" fill={p.ink}/><circle cx="47" cy="59" r="1.8" fill={p.white}/><circle cx="87" cy="59" r="1.8" fill={p.white}/></g>;
  if (name === "Crossed") return <g><circle cx="50" cy="66" r="8" fill={p.ink}/><circle cx="78" cy="66" r="8" fill={p.ink}/><circle cx="48" cy="63" r="1.8" fill={p.white}/><circle cx="76" cy="63" r="1.8" fill={p.white}/></g>;
  if (name === "Bear") return <g fill={face}><circle cx="48" cy="63" r="9"/><circle cx="80" cy="63" r="9"/></g>;
  if (name === "Bear Closed") return <g fill="none" stroke={face} strokeWidth="6" strokeLinecap="round"><path d="M38 63Q48 51 58 63"/><path d="M70 63Q80 51 90 63"/></g>;
  if (name === "Bear Wink") return <g><circle cx="48" cy="63" r="9" fill={face}/><path d="M70 63Q80 51 90 63" fill="none" stroke={face} strokeWidth="6" strokeLinecap="round"/></g>;
  if (name === "Bear Dizzy") return <g><circle cx="48" cy="63" r="11" fill={face}/><circle cx="80" cy="63" r="11" fill={face}/><circle cx="52" cy="59" r="3.5" fill={p.ink}/><circle cx="76" cy="67" r="3.5" fill={p.ink}/></g>;
  if (name === "Closed Friendly") return <g fill="none" stroke={face} strokeWidth="7" strokeLinecap="round"><path d="M29 65Q43 48 56 65"/><path d="M72 65Q85 48 99 65"/></g>;
  if (name === "Open Friendly") return <g><Eye cx={45} cy={61} r={18} pupilY={63} palette={p}/><Eye cx={84} cy={65} r={18} pupilY={67} palette={p}/></g>;
  if (name === "Open Curious") return <g><Eye cx={45} cy={61} r={17} pupilX={50} pupilY={62} palette={p}/><Eye cx={84} cy={65} r={20} pupilX={89} pupilY={66} palette={p}/></g>;
  if (name === "Variant 01") return <g fill={p.ink}><path d="M24 57C24 43 42 39 48 52C54 39 72 43 72 57C72 72 48 86 48 86S24 72 24 57Z"/><path d="M68 57C68 43 86 39 92 52C98 39 116 43 116 57C116 72 92 86 92 86S68 72 68 57Z"/></g>;
  if (name === "Variant 02") return <g fill="none" stroke={p.ink} strokeWidth="9" strokeLinecap="round"><path d="M25 55Q43 76 59 55"/><path d="M69 55Q86 76 103 55"/></g>;
  if (name === "Variant 03") return <g fill="none" stroke={p.ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"><path d="M27 45L53 64L27 82"/><path d="M101 45L75 64L101 82"/></g>;
  if (name === "Variant 04") return <g fill="none" stroke={p.ink} strokeWidth="9" strokeLinecap="round"><path d="M25 76Q43 36 59 76"/><path d="M69 76Q86 36 103 76"/></g>;
  if (name === "Variant 05") return <g fill={p.ink}><ellipse cx="43" cy="64" rx="11" ry="20"/><ellipse cx="85" cy="64" rx="11" ry="20"/></g>;
  if (name === "Variant 06") return <g fill={p.ink}><ellipse cx="43" cy="64" rx="9" ry="27"/><ellipse cx="85" cy="64" rx="9" ry="27"/></g>;
  if (name === "Variant 07") return <g fill="none" stroke={p.ink} strokeWidth="11" strokeLinecap="round"><path d="M27 65Q43 56 57 64"/><path d="M71 64Q86 56 101 65"/></g>;
  if (name === "Variant 08") return <g fill={p.ink}><circle cx="43" cy="64" r="8"/><circle cx="85" cy="64" r="8"/></g>;
  if (name === "Dots") return <g><circle cx="47" cy="64" r="9" fill={p.ink}/><circle cx="81" cy="64" r="9" fill={p.ink}/></g>;
  if (name === "Happy") return <g fill="none" stroke={p.ink} strokeWidth="7" strokeLinecap="round"><path d="M30 68Q43 47 56 68"/><path d="M72 68Q85 47 98 68"/></g>;
  if (name === "Mono") return <Eye cx={64} cy={63} r={22} palette={p}/>;
  if (name === "Trio") return <g><Eye cx={36} cy={66} r={13} palette={p}/><Eye cx={64} cy={57} r={16} palette={p}/><Eye cx={93} cy={66} r={13} palette={p}/></g>;
  if (name === "Wink") return <g><Eye cx={43} cy={63} r={18} palette={p}/><path d="M76 69Q87 48 99 69" fill="none" stroke={p.ink} strokeWidth="7" strokeLinecap="round"/></g>;
  const tiny = name === "Tiny" || name === "Pinprick";
  const big = name === "Big" || name === "Googly";
  const r = tiny ? 10 : big ? 21 : 16;
  let leftX = 44, rightX = 84, pupilLeft = 44, pupilRight = 84, pupilY = 66;
  if (name === "Inward") { pupilLeft = 50; pupilRight = 78; }
  if (name === "Outward") { pupilLeft = 37; pupilRight = 91; }
  if (name === "Side") { pupilLeft = 37; pupilRight = 77; }
  if (name === "Down") pupilY = 72;
  if (name === "Up") pupilY = 58;
  if (name === "Googly") { leftX = 42; rightX = 87; }
  return <g><Eye cx={leftX} cy={64} r={r} pupilX={pupilLeft} pupilY={pupilY} palette={p}/><Eye cx={rightX} cy={64} r={r} pupilX={pupilRight} pupilY={pupilY} palette={p}/></g>;
};

const Mouths = ({ name, p }: { name: string; p: MascotPalette }) => {
  const line = { fill: "none", stroke: p.ink, strokeWidth: 9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const face = friendlyFaceColor(p);
  if (name === "Bear Smile") return <g><ellipse cx="64" cy="57" rx="5" ry="4" fill={face}/><path d="M43 66Q64 86 85 66" fill="none" stroke={face} strokeWidth="7" strokeLinecap="round"/></g>;
  if (name === "Bear Open") return <g><ellipse cx="64" cy="54" rx="5" ry="4" fill={face}/><path d="M43 63Q64 78 85 63Q83 87 64 90Q45 87 43 63Z" fill={face}/><path d="M55 80Q64 86 73 80" fill="none" stroke={p.accent} strokeWidth="5" strokeLinecap="round" opacity=".72"/></g>;
  if (name === "Talk Rest") return <path d="M47 67Q64 82 81 67" fill="none" stroke={p.ink} strokeWidth="8" strokeLinecap="round"/>;
  if (name === "Talk Small") return <g><ellipse cx="64" cy="72" rx="13" ry="9" fill={p.ink}/><path d="M55 68Q64 65 73 68Q70 72 64 72Q58 72 55 68Z" fill={p.white}/></g>;
  if (name === "Talk Wide") return <g><path d="M38 62Q64 77 90 62Q87 93 64 96Q41 93 38 62Z" fill={p.ink}/><path d="M43 64Q64 73 85 64Q82 73 64 76Q46 73 43 64Z" fill={p.white}/></g>;
  if (name === "Talk O") return <g><ellipse cx="64" cy="72" rx="13" ry="18" fill={p.ink}/><ellipse cx="64" cy="65" rx="6" ry="4" fill={p.white}/></g>;
  if (name === "Variant 01") return <path d="M29 57Q64 75 99 57Q94 86 64 88Q34 86 29 57Z" fill={p.ink}/>;
  if (name === "Variant 02") return <path d="M20 50Q64 77 108 50Q102 98 64 101Q26 98 20 50Z" fill={p.ink}/>;
  if (name === "Variant 03") return <path d="M42 60Q64 74 86 60Q82 80 64 82Q46 80 42 60Z" fill={p.ink}/>;
  if (name === "Variant 04") return <path d="M29 58Q64 84 99 58" {...line}/>;
  if (name === "Variant 05") return <path d="M58 42Q83 52 61 64Q83 75 58 87" {...line}/>;
  if (name === "Dot") return <circle cx="64" cy="70" r="9" fill={p.ink}/>;
  if (name === "Line") return <path d="M37 70H91" {...line}/>;
  if (name === "Frown") return <path d="M29 78Q64 43 99 78" {...line}/>;
  if (name === "Pout") return <path d="M45 78Q64 58 83 78" {...line}/>;
  if (name === "Smile" || name === "Smile Big" || name === "Smirk") return <path d={name === "Smirk" ? "M44 69Q64 83 84 65" : name === "Smile Big" ? "M25 61Q64 104 103 61" : "M30 63Q64 94 98 63"} {...line}/>;
  if (name === "Wavy" || name === "Cat" || name === "UU") return <path d={name === "Cat" ? "M27 60Q43 83 64 61Q84 83 101 60" : name === "UU" ? "M31 58Q39 88 57 61Q66 88 82 61Q91 86 99 58" : "M25 70Q43 45 61 72Q79 98 103 66"} {...line}/>;
  if (name === "Zigzag") return <path d="M25 73L42 57L59 72L76 56L93 70L105 59" {...line}/>;
  if (name === "O") return <ellipse cx="64" cy="70" rx="14" ry="20" fill={p.ink}/>;
  if (name === "Open Small") return <path d="M45 66Q64 87 83 66Q81 87 64 90Q47 86 45 66Z" fill={p.ink}/>;
  if (name === "Grin" || name === "Toothy") return <path d="M30 57H98Q94 92 64 94Q34 91 30 57Z" fill={p.ink} stroke={p.ink} strokeWidth="3"/>;
  if (name === "Teeth") return <g fill={p.ink}><path d="M32 57H52L42 78Z"/><path d="M54 57H74L64 78Z"/><path d="M76 57H96L86 78Z"/></g>;
  if (name === "Open" || name === "Laugh" || name === "Smile Tongue" || name === "Tongue") return <g><path d={name === "Tongue" ? "M28 58H100" : "M28 55Q64 101 100 55"} {...line}/><path d="M51 76Q64 91 77 76V84Q64 104 51 84Z" fill={p.accent}/></g>;
  return <path d="M30 64Q43 89 64 66Q85 89 99 64" {...line}/>;
};

const Heads = ({ p }: { p: MascotPalette }) => <g><g fill="none" stroke={p.ink} strokeWidth="8" strokeLinecap="round"><path d="M30 57Q42 38 54 57"/><path d="M74 57Q86 38 98 57"/></g><path d="M28 72Q64 92 100 72Q95 104 64 106Q33 104 28 72Z" fill={p.ink}/></g>;

const Patterns = ({ name, p }: { name: string; p: MascotPalette }) => {
  const c = p.secondary;
  if (name === "Bear Muzzle") return <ellipse cx="64" cy="70" rx="23" ry="17" fill={p.accent} opacity=".2"/>;
  if (name === "Belly Patch") return <ellipse cx="64" cy="82" rx="27" ry="22" fill={p.accent} opacity=".42"/>;
  if (name === "Buttons") return <g fill={c}><circle cx="64" cy="48" r="8"/><circle cx="64" cy="79" r="8"/></g>;
  if (name === "Checker") return <g fill={c} opacity=".45"><rect x="37" y="48" width="22" height="18" rx="7"/><rect x="62" y="67" width="22" height="18" rx="7"/></g>;
  if (name === "Coil" || name === "Spiral") return <path d="M37 85Q29 47 60 37Q91 27 99 57Q104 77 85 83Q65 90 57 75Q49 59 62 50Q73 43 79 52Q84 62 77 68" fill="none" stroke={c} strokeWidth={name === "Coil" ? 12 : 7} strokeLinecap="round"/>;
  if (name === "Freckles" || name === "Pellets") return <g fill={c} opacity=".75"><circle cx="40" cy="51" r="6"/><circle cx="59" cy="71" r="6"/><circle cx="80" cy="56" r="6"/></g>;
  if (name === "Jelly Shine") return <path d="M39 38C31 47 28 59 29 70" fill="none" stroke={p.white} strokeWidth="9" strokeLinecap="round" opacity=".58"/>;
  if (name === "Panda Patches") return <g fill={p.ink} opacity=".92" transform="rotate(-4 64 64)"><ellipse cx="43" cy="63" rx="20" ry="25" transform="rotate(20 43 63)"/><ellipse cx="85" cy="63" rx="20" ry="25" transform="rotate(-20 85 63)"/></g>;
  if (name === "Patch") return <g><rect x="39" y="39" width="50" height="42" rx="13" fill={c}/><path d="M48 39L42 32M80 39L87 31M49 81L42 89M79 81L86 89" stroke={p.ink} strokeWidth="5" strokeLinecap="round" opacity=".45"/></g>;
  if (name === "Raccoon Mask") return <g fill={p.secondary} opacity=".58"><path d="M24 58Q43 40 61 60Q45 80 25 70Z"/><path d="M104 58Q85 40 67 60Q83 80 103 70Z"/></g>;
  if (name === "Stitches") return <path d="M35 68H50M58 68H72M81 68H96" stroke={c} strokeWidth="7" strokeLinecap="round"/>;
  if (name === "Zig") return <path d="M32 74L48 54L64 72L80 52L97 72" fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>;
  return <path d="M28 82Q43 45 64 76Q82 48 101 82" fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" opacity=".45"/>;
};

const Accessories = ({ name, p }: { name: string; p: MascotPalette }) => {
  const primary = p.primary, accent = p.accent, reward = p.secondary;
  if (name === "Antenna") return <g><g fill="none" stroke={reward} strokeWidth="9" strokeLinecap="round"><path d="M42 101C39 82 34 64 27 48"/><path d="M86 101c3-19 8-37 15-53"/></g><circle cx="25" cy="39" r="14" fill={primary}/><circle cx="103" cy="39" r="14" fill={accent}/></g>;
  if (name === "Baseball Cap") return <g stroke={reward} strokeWidth="3" strokeLinejoin="round"><path d="M27 70C29 43 44 28 65 28C84 28 97 42 99 65C78 58 52 59 27 70Z" fill={primary}/><path d="M62 62C82 58 103 63 116 73C97 78 76 75 58 69Z" fill={accent}/><path d="M64 29V60" fill="none" opacity=".5"/></g>;
  if (name === "Bear Ears") return <g><circle cx="31" cy="53" r="24" fill={primary} stroke={reward} strokeWidth="4"/><circle cx="97" cy="53" r="24" fill={primary} stroke={reward} strokeWidth="4"/><circle cx="31" cy="53" r="12" fill={accent} opacity=".72"/><circle cx="97" cy="53" r="12" fill={accent} opacity=".72"/></g>;
  if (name === "Beanie") return <g stroke={reward} strokeWidth="3"><circle cx="64" cy="20" r="11" fill={accent}/><path d="M25 71C27 39 42 25 64 25C86 25 101 39 103 71Z" fill={primary}/><rect x="22" y="65" width="84" height="20" rx="9" fill={accent}/><path d="M36 67V82M52 66V83M68 66V83M84 67V82" opacity=".35"/></g>;
  if (name === "Bird Beak") return <path d="M49 61L82 72L49 83Q57 72 49 61Z" fill={accent} stroke={reward} strokeWidth="3" strokeLinejoin="round"/>;
  if (name === "Bird Wing") return <path d="M31 45Q67 56 91 91Q65 100 44 84Q29 72 31 45Z" fill={reward} opacity=".82"/>;
  if (name === "Bucket Hat") return <g stroke={reward} strokeWidth="3" strokeLinejoin="round"><path d="M36 31H92L101 72H27Z" fill={primary}/><path d="M18 72C39 64 89 64 110 72L101 88C78 82 50 82 27 88Z" fill={accent}/><path d="M31 58H97" fill="none" opacity=".5"/></g>;
  if (name === "Crest") return <g><circle cx="25" cy="72" r="16" fill={accent}/><circle cx="64" cy="52" r="19" fill={primary}/><circle cx="103" cy="72" r="16" fill={accent}/></g>;
  if (name === "Curl") return <path d="M42 101V78c0-35 13-55 33-55 15 0 25 10 25 24 0 13-8 22-20 22-9 0-15-5-15-13 0-6 4-10 10-10" fill="none" stroke={primary} strokeWidth="14" strokeLinecap="round"/>;
  if (name === "Ears") return <g><path d="M19 33c0-18 11-27 23-21 15 8 18 32 11 52-4 13-11 25-19 34-9-10-15-20-20-32-7-17-7-26 5-33Z" fill={primary}/><path d="M109 33c0-18-11-27-23-21-15 8-18 32-11 52 4 13 11 25 19 34 9-10 15-20 20-32 7-17 7-26-5-33Z" fill={accent}/></g>;
  if (name === "Elephant Ears") return <g><path d="M10 39Q34 25 51 50Q57 74 35 94Q12 84 10 39Z" fill={accent} opacity=".88"/><path d="M118 39Q94 25 77 50Q71 74 93 94Q116 84 118 39Z" fill={accent} opacity=".88"/></g>;
  if (name === "Elephant Trunk") return <path d="M58 42Q83 45 79 68Q76 82 92 83Q104 83 103 72" fill="none" stroke={primary} strokeWidth="15" strokeLinecap="round"/>;
  if (name === "Fluffy Ears") return <g><path d="M12 61C8 42 18 25 35 27C52 29 57 48 48 69C38 61 27 58 12 61Z" fill={primary}/><path d="M116 61C120 42 110 25 93 27C76 29 71 48 80 69C90 61 101 58 116 61Z" fill={primary}/><circle cx="32" cy="47" r="10" fill={accent} opacity=".55"/><circle cx="96" cy="47" r="10" fill={accent} opacity=".55"/></g>;
  if (name === "Fox Ears") return <g><path d="M18 72L29 18L55 62Z" fill={primary} stroke={reward} strokeWidth="3" strokeLinejoin="round"/><path d="M110 72L99 18L73 62Z" fill={primary} stroke={reward} strokeWidth="3" strokeLinejoin="round"/><path d="M27 57L31 35L43 57Z" fill={accent}/><path d="M101 57L97 35L85 57Z" fill={accent}/></g>;
  if (name === "Fox Tail") return <g><path d="M30 103Q3 81 19 52Q32 29 54 45Q35 60 44 78Q53 96 30 103Z" fill={primary} stroke={reward} strokeWidth="3"/><path d="M18 53Q28 38 43 42Q34 51 28 64Z" fill={p.white} opacity=".9"/></g>;
  if (name === "Graduation Cap") return <g stroke={reward} strokeWidth="3" strokeLinejoin="round"><path d="M20 43L64 19L108 43L64 67Z" fill={primary}/><path d="M39 56V78C52 89 76 89 89 78V56L64 70Z" fill={accent}/><path d="M103 45V79" fill="none" strokeWidth="4"/><circle cx="103" cy="84" r="6" fill={accent} stroke="none"/></g>;
  if (name === "Gummy Ears") return <g fill={primary} opacity=".82"><circle cx="29" cy="57" r="16"/><circle cx="99" cy="57" r="16"/></g>;
  if (name === "Horns Small" || name === "Horns") return name === "Horns Small" ? <g><path d="M30 94c-2-17-2-31 1-42 2-9 7-14 14-14 8 0 13 8 14 20 1 11 0 23-1 36Z" fill={primary}/><path d="M98 94c2-17 2-31-1-42-2-9-7-14-14-14-8 0-13 8-14 20-1 11 0 23 1 36Z" fill={accent}/></g> : <g><path d="M15 101c0-31 1-55 6-72 3-12 9-18 17-18 10 0 16 11 18 28 2 19 2 40 1 62Z" fill={primary}/><path d="M113 101c0-31-1-55-6-72-3-12-9-18-17-18-10 0-16 11-18 28-2 19-2 40-1 62Z" fill={accent}/></g>;
  if (name === "Loop") return <path d="M25 92V76c0-24 16-40 39-40s39 16 39 40v16H89V77c0-16-10-26-25-26S39 61 39 77v15Z" fill={primary}/>;
  if (name === "Nub") return <path d="M45 95c-3-17-4-33-2-47 2-20 10-31 21-31s19 11 21 31c2 14 1 30-2 47Z" fill={primary}/>;
  if (name === "Open Book") return <g stroke={reward} strokeWidth="3" strokeLinejoin="round"><path d="M12 40Q39 32 64 50V100Q39 83 12 91Z" fill={p.white}/><path d="M116 40Q89 32 64 50V100Q89 83 116 91Z" fill={p.white}/><path d="M29 55L52 61M27 67L52 73M99 55L76 61M101 67L76 73" stroke={accent} strokeWidth="4" strokeLinecap="round"/></g>;
  if (name === "Panda Ears") return <g fill={p.ink}><circle cx="29" cy="57" r="17"/><circle cx="99" cy="57" r="17"/></g>;
  if (name === "Party Hat") return <g stroke={reward} strokeWidth="3" strokeLinejoin="round"><path d="M32 82L64 17L96 82Z" fill={primary}/><path d="M27 82Q64 69 101 82L95 94Q64 84 33 94Z" fill={accent}/><circle cx="64" cy="14" r="9" fill={accent}/><g fill={p.white} stroke="none" opacity=".75"><circle cx="58" cy="43" r="4"/><circle cx="72" cy="58" r="4"/><circle cx="50" cy="69" r="3"/></g></g>;
  if (name === "Peak") return <path d="M17 96c11-31 25-55 47-77 22 22 36 46 47 77Z" fill={primary}/>;
  if (name === "Pellet") return <g><circle cx="64" cy="66" r="20" fill={primary}/><circle cx="58" cy="59" r="6" fill={accent} opacity=".35"/></g>;
  if (name === "Spikes") return <g><path d="M7 99c1-23 5-41 13-58 8 17 12 35 13 58Z" fill={accent}/><path d="M39 99c2-32 10-58 25-82 15 24 23 50 25 82Z" fill={primary}/><path d="M95 99c1-23 5-41 13-58 8 17 12 35 13 58Z" fill={reward}/></g>;
  if (name === "Striped Tail") return <g><path d="M39 102Q4 93 15 58Q22 37 43 43Q31 61 50 74Q62 83 39 102Z" fill={primary} stroke={reward} strokeWidth="3"/><path d="M17 59Q27 61 35 69M17 76Q29 78 39 87" fill="none" stroke={p.white} strokeWidth="8" opacity=".85"/></g>;
  if (name === "Story Ears") return <g><circle cx="31" cy="56" r="14" fill={accent}/><circle cx="97" cy="56" r="14" fill={accent}/><circle cx="31" cy="56" r="7" fill={p.white} opacity=".3"/><circle cx="97" cy="56" r="7" fill={p.white} opacity=".3"/></g>;
  if (name === "Swirl") return <path d="M31 99V76c0-31 20-52 49-52 24 0 40 15 40 36 0 24-19 41-43 41-17 0-29-11-29-26 0-14 11-24 25-24 10 0 17 6 17 15 0 7-5 12-12 12-5 0-8-3-8-7" fill="none" stroke={primary} strokeWidth="17" strokeLinejoin="round"/>;
  if (name === "Teddy Ears") return <g><circle cx="29" cy="57" r="17" fill={primary} stroke={reward} strokeWidth="3"/><circle cx="99" cy="57" r="17" fill={primary} stroke={reward} strokeWidth="3"/><circle cx="29" cy="57" r="8" fill={accent} opacity=".48"/><circle cx="99" cy="57" r="8" fill={accent} opacity=".48"/></g>;
  if (name === "Top Hat") return <g stroke={reward} strokeWidth="3" strokeLinejoin="round"><path d="M39 20H89L94 72H34Z" fill={primary}/><rect x="33" y="56" width="62" height="18" rx="4" fill={accent}/><path d="M19 72H109L102 88H26Z" fill={primary}/></g>;
  if (name === "Wave Paw") return <g transform="rotate(-18 64 72)"><rect x="47" y="48" width="34" height="61" rx="17" fill={primary}/><circle cx="49" cy="47" r="9" fill={primary}/><circle cx="62" cy="42" r="9" fill={primary}/><circle cx="76" cy="47" r="9" fill={primary}/><ellipse cx="64" cy="75" rx="12" ry="15" fill={accent} opacity=".5"/></g>;
  if (name === "Wizard Hat") return <g stroke={reward} strokeWidth="3" strokeLinejoin="round"><path d="M31 76C40 54 50 30 62 11C71 27 80 30 97 24C91 45 86 59 96 77Z" fill={primary}/><path d="M19 78Q64 65 109 78L99 94Q64 84 29 94Z" fill={accent}/><path d="M58 42L62 50L71 51L64 57L66 66L58 61L50 66L52 57L45 51L54 50Z" fill={p.white} stroke="none" opacity=".8"/></g>;
  return <g><path d="M14 57c20 0 30 9 35 30" fill="none" stroke={primary} strokeWidth="13" strokeLinecap="round"/><path d="M114 57c-20 0-30 9-35 30" fill="none" stroke={accent} strokeWidth="13" strokeLinecap="round"/></g>;
};

export const MascotAssetArt: React.FC<{ asset: MascotAssetDefinition; palette: MascotPalette; outline?: boolean }> = ({ asset, palette, outline = true }) => {
  if (asset.markup) {
    const safeMarkup = sanitizeSvgMarkup(asset.markup);
    if (!safeMarkup) return null;
    const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safeMarkup)}`;
    const scale = asset.markupScale ?? 1;
    return <g transform={`translate(64 64) scale(${scale}) translate(-64 -64)`}><image href={href} x="0" y="0" width="128" height="128" preserveAspectRatio="xMidYMid meet"/></g>;
  }
  if (asset.category === "body") return <Bodies name={asset.name} p={palette} outline={outline}/>;
  if (asset.category === "head") return <Heads p={palette}/>;
  if (asset.category === "eyes" || asset.category === "pupil") return <Eyes name={asset.name} p={palette}/>;
  if (asset.category === "mouth") return <Mouths name={asset.name} p={palette}/>;
  if (asset.category === "pattern") return <Patterns name={asset.name} p={palette}/>;
  const usesBodyColor = ["Baseball Cap", "Bear Ears", "Beanie", "Bird Beak", "Bird Wing", "Bucket Hat", "Elephant Ears", "Elephant Trunk", "Fluffy Ears", "Fox Ears", "Fox Tail", "Graduation Cap", "Gummy Ears", "Open Book", "Panda Ears", "Party Hat", "Striped Tail", "Story Ears", "Teddy Ears", "Top Hat", "Wizard Hat"].includes(asset.name);
  return <Accessories name={asset.name} p={usesBodyColor ? palette : { ...palette, primary: palette.secondary }}/>;
};
