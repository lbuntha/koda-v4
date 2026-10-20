import { puzzlesFor } from "./build";
import { rb } from "./rb";

export const SCHOOL_MORE = puzzlesFor("school", [
  rb("Pencil and ruler", "pencil & ruler"), rb("Foot ruler", "foot + ruler"), rb("Rulebook", "ruler=rule + book", { d: 2 }), rb("Home rule", "home + ruler=rule", { d: 2 }), rb("Rule of thumb", 'ruler=rule + "OF" + thumb', { d: 2 }),
  rb("Rock paper scissors", "stone=rock + paper + scissors", { d: 2 }), rb("Nail scissors", "nail + scissors"), rb("Hair scissors", "hair + scissors"), rb("Scissors and glue", "scissors & glue"), rb("Paper and scissors", "paper & scissors"),
  rb("Glue and paper", "glue & paper"), rb("Paper glue", "paper + glue"), rb("Wood glue", "wood + glue"), rb("School glue", "school + glue"), rb("Glue pot", "glue + pot"), rb("Hot glue", "fire=hot + glue"),
  rb("Crayon box", "crayon + box"), rb("Crayon and paper", "crayon & paper"), rb("Crayon case", "crayon + case"),
  rb("Pencil eraser", "pencil + eraser"), rb("Board eraser", "board + eraser"), rb("Eraser head", "eraser + head"), rb("Pencil and eraser", "pencil & eraser"),
  rb("Calculator watch", "calculator + clock=watch", { a: ["calculator clock"] }), rb("Solar calculator", "sun + calculator"),
  rb("Desk lamp", "desk + lamp"), rb("Desktop", 'desk + "TOP"', { d: 2 }), rb("School desk", "school + desk"), rb("Desk chair", "desk + chair"), rb("Desk work", "desk + work"), rb("Desk bell", "desk + bell"),
  rb("School backpack", "school + backpack"), rb("Book backpack", "book + backpack"),
  rb("Chalkboard", "chalk + board"), rb("Chalk and cheese", "chalk & cheese", { d: 2 }), rb("White chalk", "white + chalk"), rb("Chalk box", "chalk + box"),
  rb("Snow globe", "snow + globe"), rb("Globefish", "globe + fish"), rb("Light globe", "light + globe"), rb("Desk globe", "desk + globe"), rb("School globe", "school + globe"), rb("Globeflower", "globe + flower", { d: 2 }),
  rb("Road map", "road + map"), rb("Star map", "star + map"), rb("Map pin", "map + pin"), rb("Wind map", "wind + map"), rb("School map", "school + map"),
]);

export const SCIENCE_MORE = puzzlesFor("science", [
  rb("Magnet pole", "magnet + pole", { a: ["magnetic pole"] }), rb("Magnet school", "magnet + school", { d: 2 }), rb("Magnet board", "magnet + board", { a: ["magnetic board"] }), rb("Horseshoe magnet", "horse + shoe + magnet"), rb("Magnet fish", "magnet + fish", { a: ["magnet fishing"] }), 
  rb("Eye lens", "eye + lens"), rb("Lens cap", "lens + cap"), rb("Lens case", "lens + case"), rb("Hand lens", "hand + lens"), 
  rb("Planet Earth", "planet + earth"), rb("Planet ring", "planet + ring"), rb("Planet and moon", "planet & moon"), rb("Blue planet", "blue + planet"), rb("Green planet", "green + planet"), rb("Ice planet", "ice + planet"), rb("Planet and star", "planet & star"),
  rb("Car battery", "car + battery"), rb("Battery hen", "battery + hen", { d: 2 }), rb("Battery and bulb", "battery & bulb"), rb("Bike battery", "bike + battery"), rb("Battery case", "battery + case"),
  rb("Light bulb", "light + bulb"), rb("Flower bulb", "flower + bulb"), rb("Bulb and lamp", "bulb & lamp"),
  rb("Space telescope", "space + telescope"), rb("Ship telescope", "ship + telescope"), rb("Telescope lens", "telescope + lens"), rb("Hand telescope", "hand + telescope"),
  rb("Microscope lens", "microscope + lens"), rb("Light microscope", "light + microscope"), rb("School microscope", "school + microscope"), rb("Germ microscope", "germ + microscope"),
  rb("Gearbox", "gear + box"), rb("Bike gear", "bike + gear"), rb("Gear wheel", "gear + wheel"), rb("Rain gear", "rain + gear"), rb("Ski gear", "ski + gear"), rb("Landing gear", 'land + "ING" + gear', { d: 2 }), rb("Gear and chain", "gear & chain"),
  rb("Robot arm", "robot + arm"), rb("Robot dog", "robot + dog"), rb("Robot cat", "robot + cat"), rb("Robot fish", "robot + fish"), rb("Space robot", "space + robot"), rb("Robot hand", "robot + hand"), rb("Robot head", "robot + head"),
  rb("Sea volcano", "sea + volcano"), rb("Volcano island", "volcano + island"), rb("Volcano lake", "volcano + lake"), rb("Sleeping volcano", 'sleep + "ING" + volcano', { d: 2 }),
  rb("Mountain bike", "mountain + bike"), rb("Mountain goat", "mountain + goat"), rb("Mountain lion", "mountain + lion"), rb("Snow mountain", "snow + mountain"), rb("Ice mountain", "ice + mountain"), rb("Mountain road", "mountain + road"), rb("Mountain water", "mountain + water"), rb("Mountain sheep", "mountain + sheep"), rb("Mountain lake", "mountain + lake"),
  rb("Riverbed", "river + bed"), rb("Riverboat", "river + boat"), rb("River horse", "river + horse", { d: 2 }), rb("River stone", "river + stone"), rb("River fish", "river + fish"), rb("River sand", "river + sand"), rb("River bridge", "river + bridge"), rb("River water", "river + water"),
  rb("Lake house", "lake + house"), rb("Swan lake", "swan + lake"), rb("Lakeland", "lake + land"), rb("Lake fish", "lake + fish"), rb("Lake water", "lake + water"), rb("Ice lake", "ice + lake"), rb("Lake bed", "lake + bed"), rb("Lake boat", "lake + boat"),
  rb("Island fox", "island + fox"), rb("Island bird", "island + bird"), rb("Ice island", "ice + island"), rb("Sand island", "sand + island"), rb("Island home", "island + home"),
  rb("Anthill", "ant + hill"), rb("Foothill", "foot + hill"), rb("Uphill", '"UP" + hill'), rb("Downhill", '"DOWN" + hill'), rb("Hill road", "hill + road"), rb("Hill house", "hill + house"), rb("Sand hill", "sand + hill"), rb("Snow hill", "snow + hill"), rb("Green hill", "green + hill"), rb("Hilly", 'hill + "Y"'),
  rb("Caveman", "cave + man"), rb("Cave bear", "cave + bear"), rb("Ice cave", "ice + cave"), rb("Sea cave", "sea + cave"), rb("Cave fish", "cave + fish"), rb("Cave lion", "cave + lion"), rb("Cave spider", "cave + spider"), rb("Cave in", 'cave + "IN"', { d: 2 }), rb("Cave wall", "cave + wall"), rb("Bear cave", "bear + cave"),
  rb("Desert island", "desert + island"), rb("Desert fox", "desert + fox"), rb("Desert storm", "desert + storm"), rb("Desert plant", "desert + plant"), rb("Desert snake", "desert + snake"), rb("Desert wind", "desert + wind"),
  rb("Forest fire", "forest + fire"), rb("Forest house", "forest + house"), rb("Forest owl", "forest + owl"), rb("Pine forest", "pine + forest"), rb("Forest elephant", "forest + elephant"), rb("Forest fox", "forest + fox"),
  rb("Skylight", "sky + light"), rb("Sky blue", "sky + blue"), rb("Sky tower", "sky + tower"), rb("Sky castle", "sky + castle"), rb("Sky rocket", "sky + rocket"), rb("Skyline", 'sky + "LINE"', { d: 2 }),
]);

export const COUNTRIES_MORE = puzzlesFor("countries", [
  rb("Congo", 'cone + "GO"', { d: 2, t: "sound-alike" }), rb("Oman", '"O" + man', { d: 2, t: "sound-alike" }), rb("Iran", '"I" + runner=ran', { d: 2, t: "sound-alike" }), rb("Togo", 'toe + "GO"', { d: 2, t: "sound-alike" }),
  rb("Panama", 'pan + "AMA"', { d: 3, t: "sound-alike" }), rb("Bhutan", 'boot + "TAN"', { d: 3, t: "sound-alike" }), rb("Italy", 'eye + "TALLY"', { d: 2, t: "sound-alike" }), rb("China", 'chain + "A"', { d: 2, t: "sound-alike" }),
  rb("Tibet", 'tea + "BET"', { d: 2, t: "sound-alike" }), rb("Cambodia", '"CAM" + bow + "DIA"', { d: 3, t: "sound-alike" }), 
]);
