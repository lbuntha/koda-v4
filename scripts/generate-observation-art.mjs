import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "src/skills/observation/assets");
const scenes = path.join(root, "src/skills/observation/internal/scenes");

const packs = {
  park: ["leaf", "daisy", "butterfly", "robin", "acorn", "watering-can", "picnic-basket", "bench", "ladybug", "umbrella"],
  home: ["sock", "teddy-bear", "pencil", "building-block", "toy-car", "key", "toy-star", "hairbrush", "alarm-clock", "slipper"],
  market: ["apple", "banana", "carrot", "bread-loaf", "teacup", "spoon", "shopping-bag", "cheese-wedge", "jam-jar", "rolling-pin"],
  farm: ["rooster", "sheep", "piglet", "horseshoe", "tractor", "milk-pail", "corn-cob", "straw-bale", "windmill", "rubber-boot"],
  forest: ["pinecone", "mushroom", "owl", "lantern", "tent", "compass", "backpack", "camp-mug", "binoculars", "marshmallow"],
  school: ["notebook", "ruler", "scissors", "paintbrush", "glue-bottle", "globe", "calculator", "crayon", "lunchbox", "paper-plane"],
  harbor: ["clownfish", "seahorse", "octopus", "starfish", "pearl", "anchor", "treasure-chest", "snorkel", "coral-branch", "submarine"],
  museum: ["rocket", "planet", "astronaut-helmet", "satellite", "telescope", "robot", "moon-boot", "comet", "control-panel", "wrench"],
  town: ["bicycle", "balloon", "ticket", "cupcake", "drum", "crown", "gift-box", "traffic-cone", "toy-train", "pinwheel"],
  castle: ["frog", "royal-crown", "castle-key", "shield", "goblet", "scroll", "torch", "banner", "dragon", "chess-knight"],
  workshop: ["gear", "spring", "magnet", "screwdriver", "bolt", "oil-can", "blueprint", "magnifier", "drive-belt", "wind-up-key"],
  reef: ["sea-urchin", "kelp-frond", "hermit-crab", "angelfish", "sand-dollar", "sea-turtle", "jellyfish", "cowrie-shell", "sea-fan", "moray-eel"],
};

const bodies = {
  leaf: '<path d="M94 18C43 17 17 49 25 91c39 9 70-20 69-73Z" fill="url(#a)"/><path d="M30 86 86 28M47 69 37 48m28 3 17 2"/>',
  daisy: '<g fill="#fff"><ellipse cx="60" cy="25" rx="13" ry="25"/><ellipse cx="60" cy="95" rx="13" ry="25"/><ellipse cx="25" cy="60" rx="25" ry="13"/><ellipse cx="95" cy="60" rx="25" ry="13"/><ellipse cx="35" cy="35" rx="13" ry="24" transform="rotate(-45 35 35)"/><ellipse cx="85" cy="85" rx="13" ry="24" transform="rotate(-45 85 85)"/></g><circle cx="60" cy="60" r="22" fill="url(#b)"/>',
  butterfly: '<path d="M55 58C38 15 5 20 15 57c5 18 25 17 40 7m10-6c17-43 50-38 40-1-5 18-25 17-40 7" fill="url(#a)"/><path d="M60 48v40m0-38C50 28 43 27 39 23m22 27c10-22 17-23 21-27"/><ellipse cx="60" cy="65" rx="8" ry="26" fill="#49394b"/>',
  robin: '<ellipse cx="57" cy="67" rx="39" ry="32" fill="url(#a)"/><circle cx="78" cy="40" r="23" fill="#72543b"/><path d="m100 40 17 9-18 6" fill="#f5b942"/><ellipse cx="55" cy="70" rx="22" ry="24" fill="#ef785d"/><circle cx="85" cy="35" r="4" fill="#182c3c"/><path d="M35 94 25 110m48-15 8 15"/>',
  acorn: '<path d="M35 48c0-26 50-26 50 0 0 39-12 60-25 60S35 87 35 48Z" fill="url(#b)"/><path d="M29 48q31-31 62 0Z" fill="#8b5a35"/><path d="M60 25q2-17 15-20"/>',
  'watering-can': '<path d="M27 49h58l-7 55H34Z" fill="url(#a)"/><path d="M30 62 7 50 3 62l28 18m52-23q27-18 31 10v26" fill="none"/><path d="M80 84q28 12 34-1" fill="none"/>',
  'picnic-basket': '<path d="M18 47h84l-9 58H27Z" fill="url(#b)"/><path d="M35 48q0-35 25-35t25 35M24 68h72M45 49v55m30-55v55" fill="none"/>',
  bench: '<path d="M14 28h92v24H14Zm5 39h82v18H19Z" fill="url(#b)"/><path d="M27 52v55m66-55v55M14 85h92"/>',
  ladybug: '<ellipse cx="60" cy="68" rx="40" ry="38" fill="url(#a)"/><circle cx="60" cy="28" r="19" fill="#263b50"/><path d="M60 31v74"/><g fill="#263b50" stroke="none"><circle cx="42" cy="60" r="7"/><circle cx="78" cy="60" r="7"/><circle cx="42" cy="84" r="7"/><circle cx="78" cy="84" r="7"/></g>',
  umbrella: '<path d="M8 56Q60 2 112 56Z" fill="url(#a)"/><path d="M60 55v43q0 18 18 8" fill="none"/><path d="M34 55q8-32 26-45 18 13 26 45" fill="#fff" opacity=".55"/>',
  sock: '<path d="M38 10h43v54q0 13 20 14 16 2 11 18-7 20-37 14l-48-13q-17-6-10-23 6-14 22-8Z" fill="url(#a)"/><path d="M38 31h43"/>',
  'teddy-bear': '<circle cx="31" cy="31" r="16" fill="url(#b)"/><circle cx="89" cy="31" r="16" fill="url(#b)"/><circle cx="60" cy="46" r="31" fill="url(#b)"/><ellipse cx="60" cy="88" rx="37" ry="29" fill="url(#b)"/><ellipse cx="60" cy="53" rx="16" ry="12" fill="#ffe0b5"/><circle cx="50" cy="41" r="4" fill="#263b50"/><circle cx="70" cy="41" r="4" fill="#263b50"/>',
  pencil: '<path d="m15 90 68-68 24 24-68 68-29 5Z" fill="url(#b)"/><path d="m83 22 10-10 24 24-10 10M15 90l24 24"/><path d="m10 119 5-29 24 24Z" fill="#263b50"/>',
  'building-block': '<path d="m17 42 43-25 43 25-43 25Z" fill="#ffd75e"/><path d="m17 42 43 25v43L17 85Zm86 0L60 67v43l43-25Z" fill="url(#a)"/>',
  'toy-car': '<path d="M15 57h18l13-23h36l17 23h9v35H15Z" fill="url(#a)"/><circle cx="35" cy="92" r="13" fill="#263b50"/><circle cx="88" cy="92" r="13" fill="#263b50"/><path d="M48 39v20h42"/>',
  key: '<circle cx="38" cy="42" r="25" fill="none"/><path d="m55 60 49 49m-20-20 12-12m-1 23 11-11"/>',
  'toy-star': '<path d="m60 8 15 34 37 4-28 25 8 37-32-19-32 19 8-37L8 46l37-4Z" fill="url(#b)"/>',
  hairbrush: '<rect x="35" y="8" width="50" height="69" rx="23" fill="url(#a)"/><path d="M60 76v38"/><g stroke-width="3"><path d="M46 24v33m10-38v42m10-42v42m10-37v33"/></g>',
  'alarm-clock': '<circle cx="60" cy="68" r="38" fill="url(#a)"/><path d="M60 68 60 41m0 27 22 11M28 32 14 17m78 15 14-15M35 102l-9 12m59-12 9 12"/><path d="M17 36q10-25 31-20m55 20q-10-25-31-20" fill="url(#b)"/>',
  slipper: '<path d="M15 80q4-39 35-60 16-11 28 7l29 47q10 19-12 28-40 18-70 4-14-6-10-26Z" fill="url(#a)"/><path d="M35 65q25-20 54-8"/>',
  apple: '<path d="M60 32c35-20 55 9 46 42-8 31-29 42-46 29-17 13-38 2-46-29-9-33 11-62 46-42Z" fill="url(#a)"/><path d="M60 33q-3-20 9-29"/><path d="M67 17q20-13 35 1-20 14-35-1Z" fill="#4fc37b"/>',
  banana: '<path d="M18 30q32 55 88 23-19 51-60 52Q9 103 8 52Z" fill="url(#b)"/><path d="m17 30-4-16m94 39 8-8"/>',
  carrot: '<path d="M33 38q27-17 54 0-8 51-40 76Q27 76 33 38Z" fill="url(#a)"/><path d="M52 33Q35 9 22 20m37 10Q61 4 75 7m-7 27q20-22 31-8" fill="none" stroke="#289568"/>',
  'bread-loaf': '<path d="M15 55q0-38 38-38h20q33 2 33 38v48H15Z" fill="url(#b)"/><path d="m42 28 8 21m15-24 8 22m15-11 5 18"/>',
  teacup: '<path d="M18 37h72v45q-4 23-36 23T18 82Z" fill="#fff"/><path d="M90 48q27-3 25 18-2 19-25 14M12 108h88"/><path d="M37 18q-8-10 1-18m23 18q-8-10 1-18" fill="none" stroke="#a8d9ec"/>',
  spoon: '<ellipse cx="42" cy="34" rx="25" ry="31" fill="url(#b)"/><path d="m52 61 31 53" fill="none" stroke-width="14"/>',
  'shopping-bag': '<path d="M18 38h84l8 76H10Z" fill="url(#a)"/><path d="M38 43q0-31 22-31t22 31" fill="none"/>',
  'cheese-wedge': '<path d="m10 91 97-59v75H10Z" fill="url(#b)"/><g fill="#e4a62e" stroke="none"><circle cx="73" cy="76" r="9"/><circle cx="93" cy="96" r="7"/><circle cx="47" cy="91" r="6"/></g>',
  'jam-jar': '<path d="M25 31h70l-7 81H32Z" fill="url(#a)"/><path d="M22 12h76v22H22Z" fill="#7bc5df"/><rect x="40" y="57" width="40" height="30" rx="12" fill="#fff3d1"/>',
  'rolling-pin': '<path d="M25 46h70v35H25Z" fill="url(#b)"/><path d="M25 63H5m110 0H95" stroke-width="15"/>',
  rooster: '<ellipse cx="58" cy="70" rx="35" ry="32" fill="url(#b)"/><circle cx="78" cy="42" r="22" fill="#f8eee0"/><path d="m98 43 19 9-19 8" fill="#f5b942"/><path d="M68 20q5-18 15 0 12-16 16 5-5 14-22 14" fill="#e95376"/><path d="M28 60Q6 35 8 76q5 24 27 19" fill="url(#a)"/><circle cx="84" cy="38" r="3.5" fill="#263b50"/><path d="M48 98v15m24-15v15"/>',
  sheep: '<g fill="#fff8ea"><circle cx="36" cy="62" r="25"/><circle cx="58" cy="48" r="29"/><circle cx="82" cy="61" r="27"/><circle cx="59" cy="75" r="33"/></g><path d="M88 59q25-2 24 22-1 22-28 18Z" fill="#72543b"/><circle cx="102" cy="77" r="3.5" fill="#fff"/><path d="M40 96v17m35-17v17"/>',
  piglet: '<ellipse cx="59" cy="68" rx="47" ry="36" fill="url(#a)"/><circle cx="88" cy="55" r="27" fill="#ff9eb0"/><path d="m74 35 2-21 17 18m7 5 10-17 7 25" fill="#ff9eb0"/><ellipse cx="101" cy="62" rx="14" ry="10" fill="#f47f98"/><circle cx="84" cy="50" r="3.5" fill="#263b50"/><path d="M31 98v14m35-14v14M14 64q-14-12-4-22"/>',
  horseshoe: '<path d="M25 18h22v50q0 22 13 22t13-22V18h22v51q0 45-35 45T25 69Z" fill="url(#b)"/><g fill="#fff" stroke="none"><circle cx="36" cy="37" r="4"/><circle cx="84" cy="37" r="4"/><circle cx="36" cy="61" r="4"/><circle cx="84" cy="61" r="4"/></g>',
  tractor: '<path d="M18 55h60l10 31H18Z" fill="url(#a)"/><path d="M52 24h35v34H52Z" fill="#bce4f2"/><path d="M26 53V31h14"/><circle cx="34" cy="91" r="23" fill="#263b50"/><circle cx="92" cy="94" r="16" fill="#263b50"/><circle cx="34" cy="91" r="9" fill="#e8c25e"/><circle cx="92" cy="94" r="6" fill="#e8c25e"/>',
  'milk-pail': '<path d="M24 38h72l-9 73H33Z" fill="url(#a)"/><path d="M36 39q1-31 24-31t24 31M20 39h80" fill="none"/><path d="M37 61h46" stroke="#fff" opacity=".65"/>',
  'corn-cob': '<path d="M39 19q21-17 42 0l-7 84q-14 16-28 0Z" fill="url(#b)"/><path d="M39 55Q13 37 16 102q20-2 32-25m32-22q27-18 24 47-20-2-32-25" fill="#57b978"/><g fill="none" stroke="#d89f31" stroke-width="2"><path d="M42 38h36M40 56h38M39 74h38M42 92h33M51 23v75m18-75v75"/></g>',
  'straw-bale': '<rect x="12" y="29" width="96" height="72" rx="14" fill="url(#b)"/><path d="M36 29v72m48-72v72M20 47h80m-80 36h80" fill="none" stroke="#c68a2c"/><path d="m9 41 19-13m75 58 13-10"/>',
  windmill: '<circle cx="60" cy="60" r="10" fill="#ef7f98"/><path d="M60 50 42 7q-7 25 8 48m20 5 43-18q-25-7-48 8m-5 20 18 43q7-25-8-48m-20-5L7 78q25 7 48-8" fill="#fff8e8"/><path d="M55 69 43 116h34L65 69" fill="#d79b63"/>',
  'rubber-boot': '<path d="M35 9h45v62q0 14 23 14 17 1 12 17-5 15-31 15H28q-17 0-15-17 2-14 22-19Z" fill="url(#a)"/><path d="M35 30h45M18 105h90"/>',
  pinecone: '<path d="M60 13q34 22 30 61-4 34-30 41-26-7-30-41-4-39 30-61Z" fill="#9a6845"/><g fill="none" stroke="#f0c27b" stroke-width="4"><path d="m44 32 16 14 16-14M37 50l23 17 23-17M33 71l27 17 27-17M39 92l21 14 21-14"/></g>',
  mushroom: '<path d="M42 62h36l11 49H31Z" fill="#fff4df"/><path d="M10 61q5-46 50-46t50 46Z" fill="url(#a)"/><g fill="#fff" stroke="none"><circle cx="36" cy="42" r="8"/><circle cx="69" cy="29" r="7"/><circle cx="86" cy="48" r="6"/></g>',
  owl: '<path d="M20 41 34 14l25 18 27-18 14 27v48q-12 27-40 27T20 89Z" fill="url(#b)"/><circle cx="43" cy="57" r="17" fill="#fff"/><circle cx="78" cy="57" r="17" fill="#fff"/><circle cx="43" cy="57" r="6" fill="#263b50"/><circle cx="78" cy="57" r="6" fill="#263b50"/><path d="m60 64 9 12-18 0Z" fill="#ef7f98"/>',
  lantern: '<path d="M32 37h56l9 71H23Z" fill="#f7cc67"/><path d="M39 45h42l5 52H34Z" fill="#fff3b8"/><path d="M42 37q0-28 18-28t18 28M20 108h80" fill="none"/><path d="M49 84q11-25 22 0-11 12-22 0Z" fill="#ef7f98"/>',
  tent: '<path d="M8 104 60 15l52 89Z" fill="url(#a)"/><path d="m60 15 17 89H43Z" fill="#fff" opacity=".55"/><path d="M60 15v89M5 104h110"/>',
  compass: '<circle cx="60" cy="60" r="51" fill="#fff8e8"/><circle cx="60" cy="60" r="39" fill="#bce4f2"/><path d="m60 24 12 35-12 37-12-37Z" fill="#ef7f98"/><circle cx="60" cy="60" r="5" fill="#263b50"/><path d="M60 10v10m0 80v10M10 60h10m80 0h10"/>',
  backpack: '<path d="M25 43q0-31 35-31t35 31v68H25Z" fill="url(#a)"/><path d="M39 41q1-17 21-17t21 17M38 69h44v31H38Z"/><path d="M25 55H12v42h13m70-42h13v42H95" fill="none"/>',
  'camp-mug': '<path d="M17 33h70v70H17Z" fill="url(#a)"/><path d="M87 48q29-2 29 21t-29 20M29 19q-7-10 1-18m22 18q-7-10 1-18" fill="none"/>',
  binoculars: '<path d="M24 43h31v55H14Z" fill="url(#a)"/><path d="M65 43h31l10 55H65Z" fill="url(#a)"/><path d="M49 49h22v21H49Z" fill="#f7cc67"/><circle cx="33" cy="92" r="19" fill="#263b50"/><circle cx="87" cy="92" r="19" fill="#263b50"/><path d="M35 43q5-29 25-29t25 29" fill="none"/>',
  marshmallow: '<path d="M33 27q27-16 54 0v67q-27 16-54 0Z" fill="#fff8ef"/><ellipse cx="60" cy="27" rx="27" ry="12" fill="#fff"/><ellipse cx="60" cy="94" rx="27" ry="12" fill="#f2dccb"/><path d="m16 112 88-104" stroke="#99643f" stroke-width="6"/>',
  notebook: '<path d="M25 10h76v100H25Z" fill="url(#a)"/><path d="M39 10v100M51 35h35M51 55h35M51 75h35"/><g fill="#f7cc67" stroke="none"><circle cx="24" cy="27" r="5"/><circle cx="24" cy="51" r="5"/><circle cx="24" cy="75" r="5"/><circle cx="24" cy="99" r="5"/></g>',
  ruler: '<path d="M10 40h100v40H10Z" fill="url(#b)"/><path d="M24 40v18m14-18v11m14-11v18m14-18v11m14-11v18m14-18v11"/>',
  scissors: '<circle cx="34" cy="88" r="20" fill="none"/><circle cx="84" cy="88" r="20" fill="none"/><path d="m47 74 54-64M71 75 24 13M50 72h20" fill="none" stroke-width="8"/>',
  paintbrush: '<path d="m54 54 37-46 21 18-39 45Z" fill="url(#b)"/><path d="M55 51q-39 17-41 57 38-1 59-39Z" fill="url(#a)"/><path d="m54 54 19 15"/>',
  'glue-bottle': '<path d="M37 10h46v28l13 17v57H24V55l13-17Z" fill="#fff8e8"/><path d="M42 10h36v18H42Z" fill="url(#a)"/><rect x="36" y="63" width="48" height="30" rx="10" fill="#bce4f2"/>',
  globe: '<circle cx="60" cy="50" r="40" fill="#61c4df"/><path d="M30 32q18 3 24 20t30 17M51 12q20 17 9 76M18 50h84" fill="none" stroke="#fff"/><path d="M60 91v16m-27 7h54"/><path d="M19 21q-19 32 0 63t61 20" fill="none"/>',
  calculator: '<rect x="24" y="8" width="72" height="105" rx="12" fill="url(#a)"/><rect x="36" y="21" width="48" height="24" rx="4" fill="#dff4ef"/><g fill="#fff" stroke="none"><circle cx="42" cy="62" r="7"/><circle cx="60" cy="62" r="7"/><circle cx="78" cy="62" r="7"/><circle cx="42" cy="83" r="7"/><circle cx="60" cy="83" r="7"/><circle cx="78" cy="83" r="7"/></g>',
  crayon: '<path d="m25 91 59-73 21 17-59 74-30 7Z" fill="url(#a)"/><path d="m84 18 8-10 21 17-8 10M25 91l21 18m-30 7 9-25"/>',
  lunchbox: '<rect x="13" y="38" width="94" height="70" rx="13" fill="url(#a)"/><path d="M40 39V24q0-14 20-14t20 14v15M13 65h94" fill="none"/><circle cx="60" cy="65" r="8" fill="#f7cc67"/>',
  'paper-plane': '<path d="m8 51 104-36-38 94-20-36-30 17 8-27Z" fill="#fff8e8"/><path d="m32 63 80-48-58 58m0 0 20 36" fill="none"/>',
  clownfish: '<path d="M15 61q25-39 68-24l25-20-4 31 4 31-25-18Q40 77 15 61Z" fill="url(#a)"/><path d="M43 41q10 20 0 39m26-45q11 23 1 45" stroke="#fff" stroke-width="9"/><circle cx="88" cy="48" r="4" fill="#263b50"/>',
  seahorse: '<path d="M75 16q25 5 22 28-2 17-20 19v23q0 28-25 28-23 0-21-19 2-16 19-12 12 4 4 14" fill="none" stroke="url(#b)" stroke-width="18"/><path d="m75 16-13-7m31 25 16-6M47 61 27 50"/><circle cx="84" cy="30" r="3.5" fill="#263b50"/>',
  octopus: '<path d="M25 59q0-42 35-42t35 42v40q-12 22-23 0-12 23-24 0-12 22-23 0Z" fill="url(#a)"/><circle cx="48" cy="55" r="5" fill="#fff"/><circle cx="73" cy="55" r="5" fill="#fff"/><path d="M49 73q11 9 22 0" fill="none"/>',
  starfish: '<path d="m60 8 13 35 37-12-22 31 29 23-39-2-4 37-15-34-34 18 21-32L12 52l38-8Z" fill="url(#a)"/><g fill="#fff" opacity=".55" stroke="none"><circle cx="60" cy="60" r="5"/><circle cx="51" cy="42" r="3"/><circle cx="76" cy="70" r="3"/></g>',
  pearl: '<path d="M14 75q7-50 46-50t46 50q-13 35-46 35T14 75Z" fill="url(#a)"/><path d="M19 76q41 31 82 0" fill="#fff3dd"/><circle cx="60" cy="64" r="25" fill="#fff"/><circle cx="51" cy="55" r="7" fill="#dff5ff" stroke="none"/>',
  anchor: '<circle cx="60" cy="20" r="13" fill="none"/><path d="M60 33v67M34 47h52M17 73q6 36 43 36t43-36M17 73l-8 18m94-18 8 18" fill="none" stroke-width="8"/>',
  'treasure-chest': '<path d="M12 50h96v59H12Z" fill="#9a653f"/><path d="M12 50q0-35 48-35t48 35Z" fill="url(#b)"/><path d="M12 68h96M60 49v60"/><rect x="51" y="63" width="18" height="25" rx="4" fill="#f7cc67"/>',
  snorkel: '<path d="M75 12v67q0 25-23 25-20 0-20-18" fill="none" stroke="url(#a)" stroke-width="13"/><path d="M68 12h28v15H75" fill="#ef7f98"/><path d="M17 71h42v22H17Z" fill="#bce4f2"/><path d="M38 72v21"/>',
  'coral-branch': '<path d="M58 111V54m0 20L31 48m27 7 26-29M40 57V27m44 0V9M29 47 16 31m69-6 17-11M58 93 35 81m23 7 25-15" fill="none" stroke="url(#a)" stroke-width="14"/>',
  submarine: '<ellipse cx="58" cy="72" rx="49" ry="31" fill="url(#b)"/><path d="M43 41V23h28v19m-3-19V12h18" fill="none"/><circle cx="40" cy="70" r="9" fill="#bce4f2"/><circle cx="69" cy="70" r="9" fill="#bce4f2"/><path d="m107 59 11-13v52l-11-13" fill="url(#a)"/>',
  rocket: '<path d="M60 7q35 28 26 75L60 109 34 82Q25 35 60 7Z" fill="#fff8e8"/><circle cx="60" cy="48" r="14" fill="#77cbea"/><path d="M34 70 13 93l24-4m49-19 21 23-24-4" fill="url(#a)"/><path d="m49 103 11 16 11-16" fill="#f4b942"/>',
  planet: '<circle cx="60" cy="60" r="36" fill="url(#a)"/><path d="M9 77q26 13 68-5t34-32Q104 26 61 48T9 77Z" fill="none" stroke="url(#b)" stroke-width="12"/><circle cx="48" cy="48" r="7" fill="#fff" opacity=".45" stroke="none"/>',
  'astronaut-helmet': '<path d="M20 61q0-48 40-48t40 48v48H20Z" fill="#fff8e8"/><path d="M31 61q2-34 29-34t29 34v21H31Z" fill="#79cbe4"/><path d="M20 91h80M42 104v9m36-9v9"/>',
  satellite: '<path d="M43 43h34v34H43Z" fill="url(#b)"/><path d="M9 26h34v67H9Zm68 0h34v67H77Z" fill="#6f8bc7"/><path d="M26 26v67m68-67v67M60 43V15m0 62v29"/><circle cx="60" cy="12" r="7" fill="#ef7f98"/>',
  telescope: '<path d="m17 43 65-29 13 31-66 28Z" fill="url(#a)"/><path d="m78 16 15-7 17 40-16 7M54 63l6 47m0-23-28 25m28-25 27 25" fill="none" stroke-width="8"/>',
  robot: '<rect x="30" y="28" width="60" height="50" rx="12" fill="url(#a)"/><rect x="22" y="78" width="76" height="32" rx="9" fill="url(#b)"/><circle cx="48" cy="50" r="7" fill="#fff"/><circle cx="72" cy="50" r="7" fill="#fff"/><path d="M60 28V14m-8 0h16M22 87H8m90 0h14M42 110v8m36-8v8"/>',
  'moon-boot': '<path d="M38 10h42v58q0 13 21 15 16 2 13 17-4 16-31 16H29q-18 0-16-17 2-13 25-17Z" fill="#fff8e8"/><path d="M38 31h42M21 102h88M46 46h25"/>',
  comet: '<circle cx="82" cy="58" r="27" fill="url(#b)"/><path d="M61 40 8 13l42 42L5 52l57 18M70 28 46 5" fill="none" stroke="url(#a)" stroke-width="10"/>',
  'control-panel': '<rect x="10" y="23" width="100" height="82" rx="12" fill="#52677f"/><rect x="24" y="36" width="72" height="24" rx="5" fill="#bce4f2"/><g stroke="none"><circle cx="31" cy="81" r="8" fill="#ef7f98"/><circle cx="55" cy="81" r="8" fill="#f4ca63"/><circle cx="79" cy="81" r="8" fill="#65c68b"/></g><path d="M94 72v18"/>',
  wrench: '<path d="M87 10q-20 2-23 20-2 10 5 18L24 94q-11 11 0 21 10 9 20-1l45-46q10 5 20-1 16-9 10-30l-17 17-16-4-4-16 17-17q-6-7-12-7Z" fill="url(#b)"/>',
  bicycle: '<circle cx="29" cy="86" r="24" fill="none"/><circle cx="92" cy="86" r="24" fill="none"/><path d="m29 86 25-41 38 41H29Zm25-41 17 41m-27-53h23m25 53-8-50h17" fill="none" stroke-width="6"/>',
  balloon: '<path d="M60 8q34 0 34 37 0 30-34 55Q26 75 26 45 26 8 60 8Z" fill="url(#a)"/><path d="m54 99 6 10 6-10M60 109q-12 5 0 11" fill="none"/>',
  ticket: '<path d="M10 33h100v25q-18 2-18 14t18 14v22H10V86q18-2 18-14T10 58Z" fill="url(#b)"/><path d="M60 34v73" stroke-dasharray="7 7"/><circle cx="78" cy="70" r="13" fill="#ef7f98"/>',
  cupcake: '<path d="M25 55h70l-9 57H34Z" fill="url(#b)"/><path d="M20 55q-2-20 18-22 3-22 24-14 17-18 30 2 21 2 16 34Z" fill="url(#a)"/><circle cx="60" cy="17" r="9" fill="#ef546d"/>',
  drum: '<path d="M25 29h70v72H25Z" fill="url(#a)"/><ellipse cx="60" cy="29" rx="35" ry="12" fill="#fff8e8"/><ellipse cx="60" cy="101" rx="35" ry="12" fill="#f4ca63"/><path d="m26 40 68 50M94 40 26 90"/><path d="m99 13-25 46m-53-46 25 46" fill="none"/>',
  crown: '<path d="m12 33 24 22 24-39 24 39 24-22-11 70H23Z" fill="url(#b)"/><path d="M22 83h76"/><g fill="#ef7f98" stroke="none"><circle cx="36" cy="73" r="6"/><circle cx="60" cy="73" r="6"/><circle cx="84" cy="73" r="6"/></g>',
  'gift-box': '<path d="M14 50h92v63H14Z" fill="url(#a)"/><path d="M8 34h104v24H8Z" fill="#f7cc67"/><path d="M52 34v79h18V34" fill="#fff3dc"/><path d="M60 34Q31 30 33 14q3-16 27 20Zm0 0q29-4 27-20-3-16-27 20Z" fill="#ef7f98"/>',
  'traffic-cone': '<path d="m46 10 28 0 22 83H24Z" fill="url(#a)"/><path d="M33 60h54M12 93h96v20H12Z" fill="#fff8e8"/>',
  'toy-train': '<path d="M17 52h69v48H17Z" fill="url(#a)"/><path d="M48 25h37v28H48Z" fill="#bce4f2"/><path d="M24 51V32h16"/><circle cx="35" cy="101" r="14" fill="#263b50"/><circle cx="78" cy="101" r="14" fill="#263b50"/><path d="M86 70h22l8 17H86" fill="url(#b)"/>',
  // Castle Kingdom (Pack 11). The frog is drawn to stay readable at the tiny
  // sizes a swarm round uses, so its silhouette is all contour and two eyes.
  frog: '<ellipse cx="60" cy="76" rx="45" ry="33" fill="url(#a)"/><circle cx="36" cy="43" r="17" fill="url(#a)"/><circle cx="84" cy="43" r="17" fill="url(#a)"/><circle cx="36" cy="42" r="7" fill="#fff"/><circle cx="84" cy="42" r="7" fill="#fff"/><circle cx="36" cy="43" r="3.5" fill="#263b50"/><circle cx="84" cy="43" r="3.5" fill="#263b50"/><path d="M40 84q20 15 40 0" fill="none"/><path d="M18 100q-10 12 4 14m80-14q10 12-4 14" fill="none"/>',
  'royal-crown': '<path d="m10 40 22 26 28-46 28 46 22-26-10 66H20Z" fill="url(#b)"/><path d="M20 88h80"/><g fill="#ef546d" stroke="none"><circle cx="32" cy="76" r="7"/><circle cx="60" cy="74" r="8"/><circle cx="88" cy="76" r="7"/></g><circle cx="60" cy="16" r="6" fill="#77cbea"/>',
  'castle-key': '<circle cx="34" cy="38" r="23" fill="none" stroke-width="9"/><circle cx="34" cy="38" r="8" fill="none"/><path d="m52 54 56 56" stroke-width="9"/><path d="m86 88 14-14m-2 26 13-13" stroke-width="8"/>',
  shield: '<path d="M60 8 108 24v42q0 34-48 48Q12 100 12 66V24Z" fill="url(#a)"/><path d="M60 8v106M12 58h96" stroke-width="5"/><path d="m60 34 8 16 17 3-12 13 3 17-16-9-16 9 3-17-12-13 17-3Z" fill="#ffe98a" stroke="none"/>',
  goblet: '<path d="M30 16h60q0 44-30 50Q30 60 30 16Z" fill="url(#b)"/><path d="M60 66v32" stroke-width="8"/><path d="M32 104q28-14 56 0Z" fill="url(#b)"/><path d="M36 30h48" stroke="#fff" opacity=".6"/>',
  scroll: '<path d="M28 26h64v68H28Z" fill="#fff6e2"/><path d="M28 26q-16 0-16 12t16 12m64-24q16 0 16 12t-16 12M28 70q-16 0-16 12t16 12m64-24q16 0 16 12t-16 12" fill="#f0dcb4"/><path d="M44 44h32M44 60h32M44 76h22" stroke-width="3"/>',
  torch: '<path d="M48 52h24v62H48Z" fill="#99643f"/><path d="M60 4q26 24 18 42-6 14-18 14t-18-14Q34 28 60 4Z" fill="url(#b)"/><path d="M60 26q11 12 7 22-3 7-7 7t-7-7q-4-10 7-22Z" fill="#ef546d" stroke="none"/><path d="M40 52h40" stroke-width="5"/>',
  banner: '<path d="M22 12h76v76L60 66 22 88Z" fill="url(#a)"/><path d="M14 6h92" stroke-width="7"/><path d="M60 30v22m-11-11h22" stroke="#ffe98a" stroke-width="6"/>',
  dragon: '<path d="M22 78q-12-34 18-46 26-11 44 8l24-16-8 26 14 12-22 8q-6 26-34 26-28 0-36-18Z" fill="url(#a)"/><path d="m40 32-6-22 22 14m8-2 8-20 10 22" fill="url(#a)"/><circle cx="88" cy="52" r="4" fill="#263b50"/><path d="M22 96q14 16 36 12" fill="none"/>',
  'chess-knight': '<path d="M46 108h44q2-40-6-56Q76 34 66 30l6-16-22-4-10 22q-16 10-18 30l16 4 6-10 10 6q-10 20-8 46Z" fill="url(#b)"/><path d="M28 108h64v10H28Z" fill="url(#b)"/><circle cx="56" cy="36" r="4" fill="#263b50"/>',
  // Workshop (Pack 12). Strong closed outlines, so two of these stacked on one
  // another still read as two things rather than one blob.
  gear: '<path d="M60 8l9 13 15-5 4 15 15 4-5 15 13 9-13 9 5 15-15 4-4 15-15-5-9 13-9-13-15 5-4-15-15-4 5-15-13-9 13-9-5-15 15-4 4-15 15 5Z" fill="url(#a)"/><circle cx="60" cy="60" r="20" fill="#e8eef5"/>',
  spring: '<path d="M32 18h56M36 34h52M32 50h56M36 66h52M32 82h56M36 98h52" fill="none" stroke-width="9" stroke="url(#a)"/><path d="M88 18 36 34m52 0L32 50m56 0L36 66m52 0L32 82m56 0L36 98" fill="none" stroke-width="9" stroke="url(#a)"/>',
  magnet: '<path d="M26 100V60a34 34 0 0 1 68 0v40H70V60a10 10 0 0 0-20 0v40Z" fill="#e0544f"/><path d="M26 100V78h24v22Zm44 0V78h24v22Z" fill="#cfd8e3"/>',
  screwdriver: '<path d="M50 12h20v46H50Z" fill="url(#a)"/><path d="M54 58h12v34H54Z" fill="#cfd8e3"/><path d="M56 92h8v18h-8Z" fill="#9aa8b8"/><path d="M50 24h20M50 36h20"/>',
  bolt: '<path d="m60 10 26 15v30L60 70 34 55V25Z" fill="url(#a)"/><circle cx="60" cy="40" r="12" fill="#e8eef5"/><path d="M48 70h24v42H48Z" fill="#b8c4d2"/><path d="M48 80h24M48 90h24M48 100h24"/>',
  'oil-can': '<path d="M22 52h60v50a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8Z" fill="url(#a)"/><path d="M82 62 112 34" stroke-width="8" fill="none"/><path d="M40 52V36h24v16Z" fill="#b8c4d2"/><path d="M30 74h44" stroke="#fff" opacity=".55"/>',
  blueprint: '<path d="M18 26h84v68H18Z" fill="#4a7fb5"/><path d="M32 40h34v22H32Zm44 0h14v40H76ZM32 70h34v12H32Z" fill="none" stroke="#dce9f7" stroke-width="3"/><path d="M18 26q-12 34 0 68" fill="#3f6d9c"/>',
  magnifier: '<circle cx="52" cy="48" r="32" fill="#cfe8f5" stroke-width="7"/><path d="m76 72 32 34" stroke-width="12" fill="none"/><path d="M38 34a22 22 0 0 1 16-6" fill="none" stroke="#fff" stroke-width="5"/>',
  'drive-belt': '<path d="M60 14c40 0 46 92 0 92S20 14 60 14Z" fill="none" stroke="url(#a)" stroke-width="16"/><path d="M60 14c40 0 46 92 0 92S20 14 60 14Z" fill="none" stroke="#3c4a5c" stroke-width="4" stroke-dasharray="8 10"/>',
  'wind-up-key': '<circle cx="40" cy="40" r="24" fill="none" stroke-width="11"/><circle cx="80" cy="40" r="24" fill="none" stroke-width="11"/><path d="M60 58v46" stroke-width="11" fill="none"/><path d="M46 104h28M50 88h20" stroke-width="8"/>',
  // Reef (Pack 13). Each one plausibly wears the reef's own texture.
  'sea-urchin': '<circle cx="60" cy="60" r="30" fill="url(#a)"/><g stroke-width="4"><path d="M60 30V6m0 108V90M30 60H6m108 0H90M39 39 22 22m76 76L81 81M81 39l17-17M39 81l-17 17M74 32l9-20M46 88l-9 20M88 74l20 9M32 46l-20-9M88 46l20-9M32 74l-20 9M74 88l9 20M46 32l-9-20"/></g>',
  'kelp-frond': '<path d="M60 114V22" stroke-width="7" fill="none"/><path d="M60 34q-30-14-38 8 26 16 38-8Zm0 24q30-14 38 8-26 16-38-8Zm0 24q-30-14-38 8 26 16 38-8Z" fill="url(#a)"/>',
  'hermit-crab': '<path d="M78 42c26 0 30 46 0 52-30 6-42-14-38-30 4-14 20-22 38-22Z" fill="url(#b)"/><path d="M78 42q14 16 0 52" fill="none"/><path d="M34 74q-18 2-22-10m22 22q-18 6-24-4" fill="none" stroke-width="5"/><circle cx="30" cy="62" r="4"/><path d="M22 58q-10-8-4-16m22 12q-6-12 2-18" fill="none" stroke-width="4"/>',
  angelfish: '<path d="M40 60 16 22q34-2 48 16 22-4 34 10-10 18-34 16-12 20-48 18Z" fill="url(#a)"/><path d="M46 40q6 24 0 44m18-46q6 26 0 46" stroke="#fff" stroke-width="7" fill="none"/><circle cx="88" cy="52" r="4" fill="#263b50"/>',
  'sand-dollar': '<circle cx="60" cy="60" r="44" fill="#f2e6cf"/><g fill="#dcc9a8" stroke="none"><ellipse cx="60" cy="34" rx="7" ry="16"/><ellipse cx="60" cy="86" rx="7" ry="16"/><ellipse cx="34" cy="60" rx="16" ry="7"/><ellipse cx="86" cy="60" rx="16" ry="7"/><ellipse cx="60" cy="60" rx="6" ry="6"/></g>',
  'sea-turtle': '<ellipse cx="58" cy="62" rx="38" ry="32" fill="url(#a)"/><g fill="none" stroke-width="4"><path d="M58 30v64M20 62h76M34 38l48 48m0-48-48 48"/></g><circle cx="102" cy="46" r="13" fill="#7fc48f"/><path d="M22 34q-14-6-18 6m18 54q-14 6-18-6m74-54q14-6 18 6" fill="#7fc48f"/><circle cx="106" cy="42" r="3" fill="#263b50"/>',
  jellyfish: '<path d="M14 58a46 40 0 0 1 92 0Z" fill="url(#b)" opacity=".92"/><path d="M22 58q6 30-4 46m22-46q4 34-6 50m26-50q0 34 0 52m24-52q-4 34 6 50m20-50q-6 30 4 46" fill="none" stroke-width="5"/>',
  'cowrie-shell': '<ellipse cx="60" cy="60" rx="42" ry="30" fill="url(#b)"/><path d="M22 62q38 16 76 0" fill="none" stroke-width="5"/><path d="M32 50q10-10 22-6m18 4q12-6 22 4" fill="none" stroke-width="4"/>',
  'sea-fan': '<path d="M56 114V78" stroke-width="7" fill="none"/><path d="M58 80q-38-8-44-44 30 0 44 20 14-20 44-20-6 36-44 44Z" fill="url(#a)"/><g fill="none" stroke="#f7dcd0" stroke-width="3"><path d="M58 78q-20-8-30-26m30 26q20-8 30-26M58 78V56"/></g>',
  'moray-eel': '<path d="M14 96q26 4 34-20T78 30q22 0 26 22" fill="none" stroke="url(#a)" stroke-width="20" stroke-linecap="round"/><path d="M104 52q6 18-10 22-14 4-16-10" fill="url(#a)"/><circle cx="96" cy="46" r="4" fill="#263b50"/><path d="M88 62q10 6 18 0" fill="none" stroke-width="3"/>',
  pinwheel: '<circle cx="60" cy="53" r="7" fill="#f7cc67"/><path d="M60 53Q31 50 23 20q30-7 37 33Zm0 0q3-29 33-37 7 30-33 37Zm0 0q29 3 37 33-30 7-37-33Zm0 0q-3 29-33 37-7-30 33-37Z" fill="url(#a)"/><path d="M60 60v58"/>',
};

const objectSvg = (body, index) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${["#72e1b3","#ff8fa3","#79d8ff"][index % 3]}"/><stop offset="1" stop-color="${["#22a878","#e95376","#258fbd"][index % 3]}"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe98a"/><stop offset="1" stop-color="#e7a93b"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#17324a" flood-opacity=".2"/></filter></defs><g filter="url(#s)" stroke="#263b50" stroke-width="3.25" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

const palettes = {
  beach: ["#75d9f5", "#2bbcc0", "#f8d695", "#f27678"],
  park: ["#9ddff0", "#63bd7f", "#b7df82", "#7657d8"],
  home: ["#f4dfd1", "#d7b894", "#f7eee5", "#ef7f98"],
  market: ["#b9e1ef", "#d79b63", "#f5d88a", "#49ae83"],
  farm: ["#a9dff0", "#70b86c", "#edcf7b", "#d9695f"],
  forest: ["#8fc8bd", "#326f58", "#d1b77b", "#ef9b54"],
  school: ["#c5e3f0", "#6b8cc7", "#e7c78c", "#ed7e8d"],
  harbor: ["#83d2e3", "#398aa5", "#e6c985", "#ef826f"],
  museum: ["#202b54", "#5368a8", "#8272b8", "#f0b956"],
  town: ["#b9e1ee", "#65ad8b", "#e6c27f", "#e96f7e"],
  castle: ["#cfe4f2", "#6f9c74", "#dfe5ea", "#9c7cc4"],
  workshop: ["#d7dee8", "#7a8899", "#c9b79c", "#e08a5c"],
  reef: ["#5cc2de", "#1f7fa8", "#e8d8a8", "#f08a6c"],
};

const sceneDecor = {
  beach: (variant) => `<path d="M0 430q190-35 370 4t350-5q145-34 280 8v313H0Z" fill="#f7d99d"/>
    <path d="M0 365q160 34 330 0t330 5q185 38 340-4v88q-160 38-340 3t-330 0Q145 491 0 450Z" fill="#54c9d6"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round"><path d="M${variant ? 96 : 74} 178h310v230H${variant ? 96 : 74}Z" fill="#fff8e8"/><path d="M${variant ? 70 : 48} 178h362l-45-78H115Z" fill="#f27678"/><path d="M143 100v78m82-78v78m82-78v78"/><path d="M158 298h175v110H158Z" fill="#d79b63"/><path d="M596 180h270v34H596Z" fill="#fff8e8"/><path d="m576 180 155-102 155 102" fill="#ffd75e"/><path d="M731 181v282M628 463h206" fill="none"/><ellipse cx="731" cy="466" rx="160" ry="31" fill="#f4bd68"/></g>
    <g fill="#fff" opacity=".78"><path d="M88 337q42-42 84 0t84 0"/><path d="M733 325q44-40 88 0t86 0"/></g>
    <g fill="#58b777" stroke="#263b50" stroke-width="5"><path d="M90 520q16-92 66-132-7 79-66 132Z"/><path d="M90 520q-42-76-82-79 12 68 82 79Z"/><path d="M890 546q4-86 60-129-7 88-60 129Z"/></g>`,
  park: (variant) => `<path d="M0 380q210-55 395 2t605-11v379H0Z" fill="#8ed17f"/><path d="M0 588q210-68 420-7t580-10v179H0Z" fill="#d7c18b" opacity=".72"/>
    <g fill="#4ea66d" stroke="#263b50" stroke-width="6"><path d="M118 194h43v356h-43Z" fill="#99643f"/><circle cx="139" cy="168" r="105"/><circle cx="63" cy="222" r="68"/><circle cx="218" cy="220" r="72"/><path d="M835 218h40v330h-40Z" fill="#99643f"/><circle cx="855" cy="188" r="99"/><circle cx="785" cy="232" r="66"/><circle cx="927" cy="228" r="70"/></g>
    ${variant ? `<path d="M355 420q150-105 300 0-35 150-150 150T355 420Z" fill="#58c5d8" stroke="#263b50" stroke-width="6"/><g fill="#f7f2dc" stroke="#263b50" stroke-width="5"><ellipse cx="468" cy="480" rx="36" ry="18"/><ellipse cx="585" cy="515" rx="43" ry="20"/></g><path d="M315 330q192-145 384 0" fill="none" stroke="#fff" stroke-width="18" opacity=".55"/>` : `<g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round"><path d="M370 236h150v30H370Z" fill="#f27678"/><path d="M388 266v154m114-154v154"/><path d="m520 242 142 180H520Z" fill="#ffd75e"/><path d="M552 422h153"/><path d="M330 520h310l-44 92H374Z" fill="#fff3d1"/></g>`}
    <g stroke="#263b50" stroke-width="5"><path d="M246 495h126v25H246Zm14 25v82m98-82v82" fill="#d79b63"/><path d="M700 470h125v25H700Zm15 25v82m95-82v82" fill="#d79b63"/></g>`,
  home: (variant) => `<path d="M0 0h1000v545H0Z" fill="${variant ? "#f2ddd0" : "#f7eadf"}"/><path d="M0 545h1000v205H0Z" fill="#d6ad82"/><path d="M0 542h1000" stroke="#263b50" stroke-width="8"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round"><path d="M82 82h250v240H82Z" fill="#bce4f2"/><path d="M207 82v240M82 202h250"/><path d="M69 67h276v270H69Z" fill="none"/><path d="M${variant ? 615 : 602} 126h288v31H${variant ? 615 : 602}Z" fill="#f7cc67"/><path d="M${variant ? 630 : 617} 157v250m258-250v250"/><path d="M630 226h258m-258 82h258"/><g fill="#ef7f98"><rect x="650" y="176" width="48" height="38" rx="6"/><rect x="720" y="176" width="48" height="38" rx="6"/><rect x="792" y="176" width="62" height="38" rx="6"/></g>${variant ? `<path d="M83 430h390v170H83Z" fill="#fff7eb"/><path d="M83 430q110-74 225 0" fill="#f6cf72"/><path d="M420 430v170"/><path d="M130 600v62m290-62v62"/>` : `<path d="M90 485h310v120H90Z" fill="#6dbfd2"/><path d="M125 452h240v35H125Z" fill="#f7cc67"/><path d="M470 475h115v125H470Z" fill="#f3a171"/>`}</g>
    <ellipse cx="500" cy="648" rx="245" ry="71" fill="${variant ? "#8ac7b0" : "#a58bd8"}" stroke="#263b50" stroke-width="6"/><g fill="#fff" opacity=".55"><circle cx="465" cy="638" r="18"/><circle cx="545" cy="662" r="25"/><circle cx="590" cy="625" r="13"/></g>`,
  market: (variant) => `<path d="M0 0h1000v445H0Z" fill="#bde3ef"/><path d="M0 445h1000v305H0Z" fill="#efcf91"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round"><path d="M54 130h395v365H54Z" fill="#fff8e8"/><path d="M550 112h398v383H550Z" fill="#fff8e8"/><path d="M35 130h433l-50-92H84Z" fill="${variant ? "#49ae83" : "#ef7f98"}"/><path d="M531 112h436l-50-76H581Z" fill="${variant ? "#ef7f98" : "#49ae83"}"/><path d="M84 38v92m84-92v92m84-92v92m84-92v92m245-94v76m84-76v76m84-76v76m84-76v76"/><path d="M88 275h328v52H88Z" fill="#d79b63"/><path d="M584 260h328v55H584Z" fill="#d79b63"/><path d="M107 327v202m290-202v202m206-214v214m290-214v214"/><path d="M93 510h320v102H93Zm500 0h314v102H593Z" fill="#c78952"/></g>
    <g stroke="#263b50" stroke-width="5"><g fill="${variant ? "#f5d88a" : "#ef7f98"}"><circle cx="145" cy="238" r="30"/><circle cx="213" cy="234" r="34"/><circle cx="290" cy="240" r="28"/><circle cx="357" cy="231" r="35"/></g><g fill="${variant ? "#ef7f98" : "#f5d88a"}"><path d="M635 244q25-74 50 0Z"/><path d="M704 244q25-74 50 0Z"/><path d="M773 244q25-74 50 0Z"/><path d="M842 244q25-74 50 0Z"/></g></g><path d="M445 750 552 445h73L535 750Z" fill="#f7e5ba" opacity=".75"/>`,
  farm: (variant) => `<path d="M0 390q210-80 430-5t570-12v377H0Z" fill="#86c875"/><path d="M0 575q240-84 465-9t535-7v191H0Z" fill="#e8c46e"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round"><path d="M70 250h360v320H70Z" fill="#d9695f"/><path d="m42 250 208-160 208 160" fill="#8f3f3b"/><path d="M170 390h160v180H170Z" fill="#fff3d5"/><path d="m170 390 160 180m0-180L170 570"/><path d="M640 256h230v275H640Z" fill="#fff7df"/><path d="M618 256h274l-46-77H664Z" fill="#6eaa68"/>${variant ? `<path d="M700 320h112v211H700Z" fill="#bce4f2"/><path d="M610 585h320v58H610Z" fill="#b18452"/>` : `<path d="M685 345h142v90H685Z" fill="#bce4f2"/><path d="M650 530h250v86H650Z" fill="#b18452"/>`}</g>
    <g stroke="#263b50" stroke-width="5" fill="none"><path d="M0 635h1000M24 605v91m90-104v104m90-102v102m610-92v92m92-102v102"/><path d="M500 392q82-85 164 0"/></g><g fill="#fff" opacity=".7"><circle cx="526" cy="118" r="42"/><circle cx="574" cy="113" r="59"/><circle cx="636" cy="122" r="35"/></g>`,
  forest: (variant) => `<path d="M0 0h1000v750H0Z" fill="#8fc8bd"/><path d="M0 410q180-66 390 3t610-25v362H0Z" fill="#4f8f63"/><path d="M0 592q245-70 500 1t500-8v165H0Z" fill="#b99c65"/>
    <g stroke="#263b50" stroke-width="6" stroke-linejoin="round"><g fill="#2f6f55"><path d="M95 560h47V210H95Z" fill="#8f5f3e"/><path d="m118 42-96 240h192Z"/><path d="m118 125-118 270h236Z"/><path d="M860 565h47V198h-47Z" fill="#8f5f3e"/><path d="m883 30-100 252h200Z"/><path d="m883 118-117 278h234Z"/></g>${variant ? `<path d="M350 265h305v257H350Z" fill="#7f5a3f"/><path d="m324 265 180-132 177 132" fill="#315f4c"/><path d="M445 382h118v140H445Z" fill="#f4c66a"/><path d="M285 584h425v56H285Z" fill="#d8bb7d"/>` : `<path d="m310 548 195-322 195 322Z" fill="#ef9b54"/><path d="m505 226 61 322H444Z" fill="#f7dd99"/><path d="M505 226v322M340 588h330"/><circle cx="725" cy="530" r="58" fill="#f1b75e"/><path d="M725 471v118M666 530h118"/>`}</g>
    <g fill="#fff3c7" opacity=".62"><circle cx="330" cy="126" r="10"/><circle cx="700" cy="158" r="14"/><circle cx="747" cy="90" r="8"/></g>`,
  school: (variant) => `<path d="M0 0h1000v750H0Z" fill="${variant ? "#e8f2f5" : "#dcecf3"}"/><path d="M0 545h1000v205H0Z" fill="#d5b77f"/><path d="M0 542h1000" stroke="#263b50" stroke-width="8"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round">${variant ? `<path d="M75 98h385v330H75Z" fill="#315d58"/><path d="M101 126h333v273H101Z" fill="#547f74"/><path d="M145 190h240M145 255h190M145 320h220" stroke="#fff4d0"/><path d="M610 95h280v338H610Z" fill="#fff7e8"/><path d="M650 140h200v70H650Z" fill="#bce4f2"/><path d="M650 245h200v52H650Z" fill="#ed7e8d"/><path d="M650 332h200v52H650Z" fill="#f2cd68"/>` : `<path d="M70 92h255v255H70Z" fill="#bce4f2"/><path d="M197 92v255M70 219h255"/><path d="M55 78h285v284H55Z" fill="none"/><path d="M555 120h355v320H555Z" fill="#fff8e8"/><path d="M595 158h275v50H595Z" fill="#6b8cc7"/><path d="M595 242h275v50H595Z" fill="#ed7e8d"/><path d="M595 326h275v50H595Z" fill="#f2cd68"/>`}<path d="M120 500h270v45H120Zm22 45v92m226-92v92" fill="#d0955e"/><path d="M515 500h310v45H515Zm24 45v92m264-92v92" fill="#d0955e"/></g>
    <g fill="#6b8cc7" stroke="#263b50" stroke-width="5"><path d="M180 635h150v56H180Z"/><path d="M590 635h160v56H590Z"/></g>`,
  harbor: (variant) => `<path d="M0 0h1000v750H0Z" fill="#91d9e7"/><path d="M0 360q180 38 360 0t355 8q148 31 285-4v386H0Z" fill="#3ea7be"/><path d="M0 515q230-42 470 4t530-7v238H0Z" fill="#287f9d" opacity=".76"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round">${variant ? `<path d="M65 130h370v330H65Z" fill="#d9f3f5"/><path d="M90 155h320v250H90Z" fill="#53b9c8"/><path d="M565 130h370v330H565Z" fill="#d9f3f5"/><path d="M590 155h320v250H590Z" fill="#53b9c8"/><path d="M80 475h840v42H80Z" fill="#d8b67c"/>` : `<path d="M100 230h290v200H100Z" fill="#fff6df"/><path d="m72 230 173-120 173 120" fill="#ef826f"/><path d="M650 170h52v330h-52Z" fill="#d8b67c"/><path d="M676 170h220v35H676Z" fill="#fff6df"/><path d="M560 520h390v55H560Z" fill="#b88a55"/>`}</g>
    <g fill="#fff" opacity=".55"><path d="M40 415q45-28 90 0t90 0m210 55q45-28 90 0t90 0m180-55q45-28 90 0t90 0"/></g><g fill="#f3cc7c" stroke="#263b50" stroke-width="4"><circle cx="490" cy="310" r="13"/><circle cx="520" cy="285" r="8"/></g>`,
  museum: (variant) => `<path d="M0 0h1000v750H0Z" fill="#202b54"/><path d="M0 545h1000v205H0Z" fill="#4d4775"/><path d="M0 542h1000" stroke="#b4b8df" stroke-width="7"/>
    <g fill="#fff" opacity=".72"><circle cx="90" cy="85" r="5"/><circle cx="190" cy="155" r="7"/><circle cx="340" cy="72" r="4"/><circle cx="470" cy="135" r="6"/><circle cx="640" cy="74" r="5"/><circle cx="815" cy="145" r="7"/><circle cx="925" cy="63" r="4"/></g>
    <g filter="url(#sh)" stroke="#c9ccef" stroke-width="6" stroke-linejoin="round">${variant ? `<path d="M70 160h360v300H70Z" fill="#394474"/><path d="M100 190h300v210H100Z" fill="#182244"/><circle cx="250" cy="292" r="75" fill="#8272b8"/><path d="M570 135h360v325H570Z" fill="#394474"/><path d="M605 175h290v65H605Z" fill="#5368a8"/><path d="M605 270h290v65H605Z" fill="#ef826f"/><path d="M605 365h290v55H605Z" fill="#f0b956"/>` : `<path d="M85 142h330v320H85Z" fill="#394474"/><path d="M120 180h260v235H120Z" fill="#182244"/><path d="M595 145h315v317H595Z" fill="#394474"/><path d="M630 185h245v230H630Z" fill="#182244"/><path d="M470 500h70V175h-70Z" fill="#6b6796"/><circle cx="505" cy="145" r="55" fill="#f0b956"/>`}</g>
    <g stroke="#c9ccef" stroke-width="5" fill="#65618c"><path d="M95 590h300v40H95Zm25 40v75m250-75v75M610 590h290v40H610Zm25 40v75m240-75v75"/></g>`,
  castle: (variant) => `<path d="M0 0h1000v430H0Z" fill="#cfe4f2"/><path d="M0 430q210-70 430-14t570-24v358H0Z" fill="#8dbb84"/>
    <g fill="none" stroke="#263b50" stroke-width="6" opacity=".9"><path d="M0 300q150-70 300-18t320-30q160-38 380 12"/></g>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round">
      <path d="M300 250h400v300H300Z" fill="#e9e3d6"/>
      <path d="M300 250h400v-46h-52v26h-60v-26h-58v26h-60v-26h-56v26h-60v-26h-54Z" fill="#ded6c6"/>
      <path d="M430 118h140v132H430Z" fill="#efe9dd"/><path d="m400 118 100-96 100 96Z" fill="#c9bda8"/>
      <path d="M${variant ? 168 : 150} 236h116v314H${variant ? 168 : 150}Z" fill="#e4ddce"/><path d="m${variant ? 140 : 122} 236 ${variant ? 226 : 208}-92 ${variant ? 86 : 86} 92Z" fill="#c9bda8"/>
      <path d="M716 236h116v314H716Z" fill="#e4ddce"/><path d="m688 236 86-92 86 92Z" fill="#c9bda8"/>
      <path d="M448 330q52-56 104 0v220H448Z" fill="#bda98c"/>
      <path d="M470 176h22v46h-22Zm52 0h22v46h-22ZM196 330h30v52h-30Zm556 0h30v52h-30Z" fill="#fff8e8"/>
      <path d="M0 556q250-46 500 0t500-12v58q-250 44-500-2T0 616Z" fill="#a8d4e6"/>
      <path d="M440 560h120v190H440Z" fill="#ded4c0"/>
      ${variant === 2 ? `<g>${[110, 300, 560, 780].map((x) => `<path d="M${x} 200h130v300H${x}Z" fill="#dceaf2"/><path d="M${x} 200h130v300H${x}Z" fill="none" stroke-width="10"/><path d="M${x + 16} 220v260m26-260v260" stroke="#fff" stroke-width="7" opacity=".7"/>`).join("")}</g>` : ""}
    </g>
    ${variant === 1 ? `<g fill="#f2e6c9" stroke="#263b50" stroke-width="5"><ellipse cx="470" cy="640" rx="34" ry="17"/><ellipse cx="556" cy="676" rx="30" ry="15"/><ellipse cx="468" cy="712" rx="32" ry="16"/></g>
      ${/* Ivy, lily pads and bushes, all sized like a rendered frog (~50 units
            across) so a green shape is never automatically the answer. */""}
      <g fill="#5f9e63" stroke="#3c6b47" stroke-width="4" opacity=".9">${[
        [126,268],[168,300],[132,346],[176,382],[138,424],[182,452],[128,486],
        [796,262],[756,298],[790,344],[748,380],[786,422],[744,454],[794,488],
        [352,214],[300,244],[664,212],[712,244],
      ].map(([x,y]) => `<path d="M${x} ${y}q26 6 24 30-2 22-26 22-22-2-22-26 0-22 24-26Z"/>`).join("")}</g>
      <g fill="none" stroke="#3f7a4c" stroke-width="5" opacity=".85"><path d="M150 262v240M772 258v244M330 214q22 20 22 42M690 212q-22 20-22 42"/></g>
      <g fill="#4f8d57" stroke="#335f3e" stroke-width="4" opacity=".8">${[
        [206,584],[318,600],[652,590],[822,606],[132,612],[900,596],[430,606],
      ].map(([x,y]) => `<ellipse cx="${x}" cy="${y}" rx="27" ry="14"/>`).join("")}</g>
      <g fill="#6aa96e" stroke="#3c6b47" stroke-width="4" opacity=".82">${[
        [96,668],[262,690],[560,700],[726,672],[880,694],
      ].map(([x,y]) => `<path d="M${x} ${y}q28-30 56 0 14 12 0 20h-56q-14-8 0-20Z"/>`).join("")}</g>` : `<g fill="#f2e6c9" stroke="#263b50" stroke-width="5"><ellipse cx="478" cy="636" rx="32" ry="16"/><ellipse cx="540" cy="672" rx="28" ry="14"/><ellipse cx="472" cy="708" rx="30" ry="15"/><ellipse cx="548" cy="742" rx="26" ry="13"/></g>`}
    <g fill="#fff" stroke="#263b50" stroke-width="5" opacity=".95"><path d="M120 96q10-40 52-32 14-30 52-14 34-6 40 30 34 4 26 34-8 24-46 20H160q-42 2-40-38Z"/><path d="M700 74q9-36 47-29 12-27 47-13 31-5 36 27 31 4 24 31-7 22-42 18H736q-38 2-36-34Z"/></g>
    <g fill="#6f9c74" stroke="#263b50" stroke-width="5"><path d="M60 700q10-64 54-92-6 56-54 92Z"/><path d="M930 690q-10-62-54-90 6 55 54 90Z"/></g>`,
  workshop: (variant) => `<path d="M0 0h1000v470H0Z" fill="#dbe3ec"/><path d="M0 470h1000v280H0Z" fill="#b99b75"/><path d="M0 468h1000" stroke="#263b50" stroke-width="8"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round">
      <path d="M60 120h320v210H60Z" fill="#e7edf4"/><path d="M60 190h320M60 260h320M168 120v210M276 120v210"/>
      <path d="M620 96h330v150H620Z" fill="#cdd7e3"/><path d="M620 160h330M736 96v150M842 96v150"/>
      <path d="M${variant ? 430 : 452} 300h190v170H${variant ? 430 : 452}Z" fill="#a97f52"/>
      <path d="M40 470h920v46H40Z" fill="#8f6b46"/><path d="M96 516v210m808-210v210"/>
      ${variant ? `<path d="M640 300h300v168H640Z" fill="#e7edf4"/><path d="M640 356h300m-150-56v168"/>` : `<circle cx="790" cy="380" r="76" fill="#e7edf4"/><path d="M790 380V320m0 60 42 30"/>`}
    </g>
    <g fill="none" stroke="#8a7358" stroke-width="5" opacity=".65"><path d="M0 560h1000M0 620h1000M0 680h1000"/></g>
    <g fill="#9aa8b8" stroke="#263b50" stroke-width="5"><path d="M120 400h44v66h-44Z"/><path d="M200 420h36v46h-36Z"/><path d="M880 402h50v64h-50Z"/></g>`,
  reef: (variant) => `<path d="M0 0h1000v750H0Z" fill="url(#bg)"/>
    <g fill="#1a6d92" opacity=".45"><path d="M0 0h1000v120q-250 60-500 0T0 120Z"/></g>
    <path d="M0 560q180-70 360-10t640-40v240H0Z" fill="#e6d6a6"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round">
      ${variant ? `<path d="M240 560q40-190 250-190t260 186q-40 60-260 60T240 560Z" fill="#7a6a58"/><path d="M330 420h90v70h-90Zm200-20h96v78h-96Z" fill="#3f5f72"/><path d="M300 372q220-70 420 0" fill="none"/>` : `<path d="M120 566q-24-150 40-206 44 44 26 122 44-96 104-66-6 78-58 128 60-40 92 2-30 40-90 46Z" fill="#ef8a72"/><path d="M880 570q24-150-40-206-44 44-26 122-44-96-104-66 6 78 58 128-60-40-92 2 30 40 90 46Z" fill="#f0a07c"/>`}
    </g>
    <g fill="#3f9e7c" stroke="#25664f" stroke-width="5" opacity=".9">${[
      [180,560],[300,584],[700,576],[860,556],[430,600],[600,596],
    ].map(([x,y]) => `<path d="M${x} ${y}q-16-52 4-84 18 30 8 84Zm18 0q6-56 30-76-2 40-14 76Z"/>`).join("")}</g>
    <g fill="#f2e0b8" opacity=".55">${[
      [140,690],[380,706],[620,690],[840,712],
    ].map(([x,y]) => `<ellipse cx="${x}" cy="${y}" rx="52" ry="16"/>`).join("")}</g>
    <g fill="#bfe8f5" opacity=".5">${[
      [160,120,9],[340,80,12],[560,140,8],[760,90,11],[900,160,7],
    ].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>`,
  town: (variant) => variant === 2 ? `<path d="M0 0h1000v750H0Z" fill="#8fa2c8"/><path d="M0 470h1000v280H0Z" fill="#d9c9a8"/>
    <circle cx="820" cy="120" r="52" fill="#f3ead0" opacity=".9"/>
    <g fill="#e8834f" stroke="#1b2038" stroke-width="5">${[[120,180],[260,140],[420,190],[600,150],[740,200],[900,160]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="30" ry="38"/><path d="M${x} ${y+38}v22"/>`).join("")}</g>
    <path d="M0 150q250 60 500 0t500 20" fill="none" stroke="#1b2038" stroke-width="5"/>
    <g filter="url(#sh)" stroke="#3a4166" stroke-width="6" stroke-linejoin="round"><path d="M80 300h240v170H80Z" fill="#e7dcc4"/><path d="M60 300h280l-40-64H100Z" fill="#c9b493"/><path d="M660 280h260v190H660Z" fill="#e7dcc4"/><path d="M640 280h300l-42-70H682Z" fill="#c9b493"/><path d="M380 330h240v140H380Z" fill="#efe6d2"/></g>
    <g fill="#fff3d0" opacity=".3">${[[120,180],[260,140],[420,190],[600,150],[740,200],[900,160]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="74"/>`).join("")}</g>` : `<path d="M0 0h1000v750H0Z" fill="#b9e1ee"/><path d="M0 480h1000v270H0Z" fill="#e6c27f"/>
    <g filter="url(#sh)" stroke="#263b50" stroke-width="6" stroke-linejoin="round"><path d="M35 185h275v315H35Z" fill="#fff7e5"/><path d="m18 185 155-110 155 110" fill="#e96f7e"/><path d="M690 165h275v335H690Z" fill="#fff7e5"/><path d="m672 165 155-105 156 105" fill="#65ad8b"/><path d="M365 270h270v230H365Z" fill="#fff7e5"/><path d="M345 270h310l-45-85H390Z" fill="#f1bd58"/>${variant ? `<path d="M405 355h190v145H405Z" fill="#8dc6d5"/><path d="M100 520h800v55H100Z" fill="#bf8958"/>` : `<path d="M430 350h140v150H430Z" fill="#8dc6d5"/><path d="M85 535h830v50H85Z" fill="#bf8958"/>`}</g>
    <g fill="#e96f7e" stroke="#263b50" stroke-width="4"><circle cx="118" cy="130" r="16"/><circle cx="370" cy="120" r="14"/><circle cx="650" cy="115" r="18"/><circle cx="910" cy="120" r="15"/></g><g stroke="#263b50" stroke-width="4"><path d="M118 146v90m252-102v95m280-96v96m260-94v95"/></g>`,
};

// Low-contrast, non-target details create the same kind of figure-ground
// confusion as knots, windows, stones, and faces in authored hidden-object art.
// They never reuse an exact target asset, so scoring remains unambiguous.
const sceneTexture = {
  beach: `<g fill="none" stroke="#b88f58" stroke-width="4" opacity=".55"><path d="m75 682 16-12 17 12m135-56q18-16 36 0m84 67 14-17 17 17m208-50q21-17 42 0m169 38 15-14 16 14"/><path d="M184 543q12-18 24 0m495 28q12-18 24 0M470 706q16-22 32 0"/></g>`,
  park: `<g fill="#6ebc72" stroke="#397956" stroke-width="4" opacity=".58"><path d="m304 170 18-15 20 15-19 25Z"/><path d="m700 165 18-15 20 15-19 25Z"/><path d="m105 650 18-15 20 15-19 25Z"/><path d="m886 650 18-15 20 15-19 25Z"/></g><g fill="none" stroke="#6e8b57" stroke-width="4" opacity=".55"><path d="M400 640q18-20 36 0m68-26q18-20 36 0m70 35q18-20 36 0"/></g>`,
  home: `<g fill="none" stroke="#a87f72" stroke-width="4" opacity=".5"><rect x="380" y="110" width="38" height="38" rx="8"/><rect x="470" y="170" width="34" height="34" rx="7"/><rect x="535" y="90" width="42" height="42" rx="9"/><path d="m370 360 18-17 18 17-18 18Zm105 65 17-17 17 17-17 18Zm60-98 17-17 17 17-17 18Z"/></g>`,
  market: `<g fill="#d99c60" stroke="#98613e" stroke-width="4" opacity=".58"><circle cx="470" cy="215" r="19"/><circle cx="510" cy="190" r="14"/><circle cx="500" cy="248" r="22"/><circle cx="455" cy="266" r="13"/><circle cx="940" cy="430" r="19"/><circle cx="54" cy="436" r="16"/></g><g fill="none" stroke="#b77b49" stroke-width="4" opacity=".5"><path d="M466 215q5-13 13-15m26-10q4-12 12-14m-70 90q4-11 12-13"/></g>`,
  farm: `<g fill="#d7b46b" stroke="#76533d" stroke-width="4" opacity=".58"><path d="M485 205q15-17 30 0 15-17 30 0v18h-60Z"/><path d="M468 205q-10-11-15 5m109-5q10-11 15 5" fill="none"/><circle cx="500" cy="212" r="3" fill="#76533d"/><circle cx="530" cy="212" r="3" fill="#76533d"/><path d="M520 493q14-15 28 0 14-15 28 0v18h-56Z"/><circle cx="535" cy="500" r="3" fill="#76533d"/><circle cx="561" cy="500" r="3" fill="#76533d"/></g><g fill="none" stroke="#aa8548" stroke-width="4" opacity=".55"><ellipse cx="480" cy="670" rx="31" ry="14"/><ellipse cx="590" cy="625" rx="27" ry="12"/><ellipse cx="720" cy="688" rx="34" ry="15"/><path d="M350 642q18-22 36 0m454-10q18-22 36 0"/></g>`,
  forest: `<g fill="none" stroke="#294f43" stroke-width="4" opacity=".58"><circle cx="118" cy="342" r="16"/><circle cx="883" cy="338" r="17"/><circle cx="118" cy="342" r="4" fill="#294f43"/><circle cx="883" cy="338" r="4" fill="#294f43"/><path d="M255 520q22-32 44 0H255Zm470 16q24-34 48 0h-48ZM390 675q19-27 38 0h-38Z"/></g><g fill="#d5c18d" opacity=".6"><circle cx="288" cy="165" r="8"/><circle cx="338" cy="125" r="12"/><circle cx="680" cy="182" r="10"/></g>`,
  school: `<g fill="none" stroke="#7687a0" stroke-width="4" opacity=".52"><path d="m400 130 44-20 15 33-44 20Zm55 165 45-18 14 34-45 18Zm-70 125 48-16 12 35-48 16Z"/><circle cx="450" cy="520" r="22"/><path d="M450 499v22l14 9M875 474h58v35h-58ZM50 465h54v38H50Z"/></g>`,
  harbor: `<g fill="none" stroke="#1f6f87" stroke-width="4" opacity=".58"><path d="M130 610q18-20 36 0m45 53q18-20 36 0m88-62q18-20 36 0m82 77q18-20 36 0m84-68q18-20 36 0m75 50q18-20 36 0m75-60q18-20 36 0"/><circle cx="315" cy="445" r="12"/><circle cx="740" cy="440" r="15"/></g><g fill="#65bfd0" opacity=".6"><circle cx="180" cy="530" r="8"/><circle cx="610" cy="575" r="10"/><circle cx="860" cy="525" r="7"/></g>`,
  museum: `<g fill="none" stroke="#8e91c2" stroke-width="4" opacity=".55"><circle cx="455" cy="310" r="17"/><circle cx="555" cy="355" r="13"/><path d="m445 310 10-25 10 25-10 24Zm91 45 19-18 18 18-18 17ZM170 510h46v26h-46Zm610 0h52v26h-52Z"/></g><g fill="#f0b956" opacity=".5"><circle cx="315" cy="120" r="9"/><circle cx="710" cy="105" r="12"/></g>`,
  castle: `<g fill="#63a86c" stroke="#3c6b47" stroke-width="4" opacity=".85">${[
      [246,600],[706,614],[150,486],[858,470],[398,216],[598,672],[318,676],
    ].map(([x,y]) => `<ellipse cx="${x}" cy="${y}" rx="26" ry="18"/><circle cx="${x-13}" cy="${y-16}" r="9"/><circle cx="${x+13}" cy="${y-16}" r="9"/>`).join("")}</g>
    <g fill="#7bb87f" opacity=".62">${[
      [336,516],[610,490],[196,664],[772,676],[470,300],[236,404],
    ].map(([x,y]) => `<ellipse cx="${x}" cy="${y}" rx="25" ry="17"/>`).join("")}</g>
    <g fill="none" stroke="#b3a892" stroke-width="4" opacity=".5"><path d="M320 300h360M320 356h360M320 412h360M320 468h360M352 300v56m64-56v56m64-56v56m64-56v56m64-56v56M320 356v56m64-56v56m64-56v56m64-56v56m64-56v56"/></g><g fill="none" stroke="#8fb9cc" stroke-width="4" opacity=".55"><path d="M120 588q18-18 36 0m64 22q18-18 36 0m560-26q18-18 36 0m-140 30q18-18 36 0"/></g>`,
  workshop: `<g fill="none" stroke="#8d99a8" stroke-width="4" opacity=".5"><circle cx="470" cy="180" r="26"/><circle cx="470" cy="180" r="9"/><circle cx="540" cy="226" r="20"/><circle cx="540" cy="226" r="7"/><path d="M170 560h60v34h-60Zm620 10h64v34h-64Z"/></g><g fill="#c6d0dc" opacity=".55"><circle cx="404" cy="196" r="15"/><circle cx="596" cy="168" r="12"/><circle cx="300" cy="620" r="14"/><circle cx="722" cy="636" r="13"/></g>`,
  reef: `<g fill="#4aa9c4" opacity=".5">${[[210,300],[400,240],[600,300],[790,250],[300,430],[690,430]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="26" ry="17"/><circle cx="${x-13}" cy="${y-15}" r="8"/><circle cx="${x+13}" cy="${y-15}" r="8"/>`).join("")}</g><g fill="none" stroke="#2b8aab" stroke-width="4" opacity=".55"><path d="M120 400q22-24 44 0m620-30q22-24 44 0M440 500q22-24 44 0"/></g>`,
  town: `<g fill="none" stroke="#a6754e" stroke-width="4" opacity=".55"><ellipse cx="170" cy="650" rx="30" ry="14"/><ellipse cx="295" cy="610" rx="26" ry="12"/><ellipse cx="470" cy="680" rx="34" ry="15"/><ellipse cx="635" cy="615" rx="28" ry="13"/><ellipse cx="820" cy="665" rx="31" ry="14"/><path d="m245 430 19-18 19 18-19 18Zm480 8 18-18 18 18-18 18Z"/></g>`,
};
const sceneSvg = (theme, variant) => {
  const [sky, , ground] = palettes[theme];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 750"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="${ground}"/></linearGradient><filter id="sh"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#263b50" flood-opacity=".18"/></filter></defs><rect width="1000" height="750" rx="36" fill="url(#bg)"/>${sceneDecor[theme](variant)}${sceneTexture[theme]}</svg>`;
};

const slots = [
  [10,24,"top-left"],[31,38,"top-left"],[57,23,"top-right"],[78,35,"top-right"],[88,14,"top-right"],
  [9,67,"bottom-left"],[30,76,"bottom-left"],[43,59,"bottom-left"],[62,68,"bottom-right"],[82,75,"bottom-right"],
];
const sceneDefs = [
  ["beach","seaside-cafe","Seaside Café","Beach Promenade",1],
  ["park","playground-picnic","Playground Picnic","City Park",0],
  ["park","botanical-pond","Botanical Pond","City Park",1],
  ["home","busy-playroom","Busy Playroom","Family Home",0],
  ["home","cozy-bedroom","Cozy Bedroom","Family Home",1],
  ["market","fruit-market","Fruit Market","Market Street",0],
  ["market","bakery-cafe","Bakery Café","Market Street",1],
  ["farm","barnyard-morning","Barnyard Morning","Farm Village",0],
  ["farm","farm-stand","Farm Stand","Farm Village",1],
  ["forest","tent-clearing","Tent Clearing","Forest Camp",0],
  ["forest","ranger-cabin","Ranger Cabin","Forest Camp",1],
  ["school","art-classroom","Art Classroom","School Campus",0],
  ["school","library-lab","Library Lab","School Campus",1],
  ["harbor","harbor-docks","Harbor Docks","Harbor & Aquarium",0],
  ["harbor","aquarium-gallery","Aquarium Gallery","Harbor & Aquarium",1],
  ["museum","planetarium","Planetarium","Science Museum",0],
  ["museum","robotics-hall","Robotics Hall","Science Museum",1],
  ["town","festival-square","Festival Square","Town Square",0],
  ["town","toy-parade","Toy Parade","Town Square",1],
  ["castle","royal-courtyard","Royal Courtyard","Castle Kingdom",0],
  ["castle","hall-of-mirrors","Hall of Mirrors","Castle Kingdom",2],
  ["town","lantern-night","Lantern Night","Town Square",2],
  ["workshop","cluttered-workbench","Cluttered Workbench","Inventor's Workshop",0],
  ["workshop","gear-room","Gear Room","Inventor's Workshop",1],
  ["reef","coral-thicket","Coral Thicket","Coral Reef",0],
  ["reef","sunken-hold","Sunken Hold","Coral Reef",1],
];

await fs.mkdir(assets, { recursive: true });
await fs.mkdir(scenes, { recursive: true });
let index = 0;
for (const [theme, names] of Object.entries(packs)) {
  for (const name of names) {
    await fs.writeFile(path.join(assets, `${theme}-${name}.svg`), objectSvg(bodies[name], index));
    index += 1;
  }
}
for (const [theme, id, name, place, variant] of sceneDefs) {
  await fs.writeFile(path.join(assets, `scene-${theme}-${id}.svg`), sceneSvg(theme, variant));
  // The Hall of Mirrors is stocked from across the catalog on purpose: it needs
  // ten objects whose reflection is visibly different, and one themed pack
  // cannot supply that many.
  const mirrorHall = ["castle-castle-key","castle-banner","castle-dragon","castle-chess-knight","home-key",
    "market-teacup","market-spoon","school-paintbrush","farm-rubber-boot","harbor-snorkel"];
  const names = theme === "beach" ? ["shell","sunglasses","crab","bucket","sunscreen","sun-hat","beach-ball","sandal","camera","kite"] : packs[theme];
  const ids = id === "hall-of-mirrors" ? mirrorHall : names.map((item) => `${theme}-${item}`);
  const objects = ids.map((full, i) => ({
    id: full, asset: `observation-${full}`, x: slots[i][0], y: slots[i][1], width: 8,
    height: 10, rotation: ((i * 7 + variant * 5) % 19) - 9, z: 3 + (i % 3), hitPadding: 3,
    visibleFraction: 1, tags: [theme, "environment-anchor"], region: slots[i][2],
  }));
  await fs.writeFile(path.join(scenes, `${theme}-${id}.json`), `${JSON.stringify({
    id: `${theme}-${id}`, name, place, backdrop: `observation-scene-${theme}-${id}`, objects,
  }, null, 2)}\n`);
}

/**
 * Swarm scene: one character hidden many times over.
 *
 * The grid is deliberately regular so no frog can overlap another or leave the
 * scene; the round shuffles which slots hold frogs, so the child never learns
 * a fixed pattern.
 */
// A regular grid reads as a spreadsheet, not a hiding place, so each slot is
// nudged by a fixed pseudo-random offset. Columns sit 19% apart and rows 22%,
// which leaves room for +/-3% of jitter without any hit box touching another.
const jitter = (n, spread) => (((Math.imul(n + 1, 2654435761) >>> 0) % (spread * 200 + 1)) / 100) - spread;
const swarmGrid = [];
let slotSeed = 0;
for (const y of [6, 28, 50, 72]) {
  for (const x of [5, 24, 43, 62, 81]) {
    const px = +(x + jitter(slotSeed, 3)).toFixed(2);
    const py = +(y + jitter(slotSeed + 97, 3)).toFixed(2);
    swarmGrid.push([px, py, `${y < 50 ? "top" : "bottom"}-${x < 43 ? "left" : "right"}`]);
    slotSeed += 1;
  }
}
const swarmCompanions = ["royal-crown", "castle-key", "shield", "torch", "banner", "dragon"];
// Spread the companions through the grid instead of parking them at the end,
// so frogs reach all four regions and every row has something to reject.
const companionSlots = new Set([3, 7, 11, 14, 17, 19]);
await fs.writeFile(path.join(assets, "scene-castle-frog-moat.svg"), sceneSvg("castle", 1));
{
  let companion = 0;
  let frog = 0;
  const objects = swarmGrid.map((slot, i) => {
    const isFrog = !companionSlots.has(i);
    const item = isFrog ? "frog" : swarmCompanions[companion++];
    if (isFrog) frog += 1;
    return {
      id: `castle-${item}`,
      ...(isFrog ? { instanceId: `castle-frog-${frog}` } : {}),
      asset: `observation-castle-${item}`,
      x: slot[0], y: slot[1], width: 8, height: 10,
      rotation: ((i * 11) % 15) - 7, z: 3 + (i % 3), hitPadding: 3,
      visibleFraction: 1, tags: ["castle", "environment-anchor"], region: slot[2],
    };
  });
  await fs.writeFile(path.join(scenes, "castle-frog-moat.json"), `${JSON.stringify({
    id: "castle-frog-moat", name: "Frog Moat", place: "Castle Kingdom",
    backdrop: "observation-scene-castle-frog-moat", swarmObjectId: "castle-frog", objects,
  }, null, 2)}\n`);
}

console.log("Wrote Observation object packs and scene packs, including Castle Kingdom + the frog swarm.");
