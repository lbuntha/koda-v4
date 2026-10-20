import { puzzlesFor } from "./build";
import { rb } from "./rb";

export const MORE_FOOD = puzzlesFor("food", [
  rb("Buttercup", "butter + cup"), 
  
  
  
  
  rb("Blackberry", "black + berry"), rb("Sweetcorn", 'cake=sweet + corn', { a: ["sweet corn"] }),
  rb("Teacup", "tea + cup"), rb("Tea bag", "tea + bag"),
  rb("Honey pot", "honey + pot"), rb("Hot pot", "fire=hot + pot"), rb("Chili pepper", "chili + pepper"),
  rb("Ice tea", "ice + tea", { a: ["iced tea"] }), 
  rb("Green tea", "green + tea"), rb("Black tea", "black + tea"), rb("Black pepper", "black + pepper"),
  rb("White bread", "white + bread"), rb("Milk tea", "milk + tea"), 
  rb("Sea salt", "sea + salt"), rb("Honey cake", "honey + cake"), 
  rb("Hot milk", "fire=hot + milk"), rb("Hot tea", "fire=hot + tea"),
  
  rb("Pepper pot", "pepper + pot"), 
  
]);

export const MORE_ANIMALS = puzzlesFor("animals", [
  
  
  
  rb("Dogfish", "dog + fish"), 
  rb("Glow worm", "light=glow + worm"),
  rb("Cold turkey", "ice=cold + turkey", { d: 2 }),
  rb("Bull ring", "bull + ring"), rb("Monkfish", "monk + fish"), rb("Seabird", "sea + bird"),
  rb("Sea dog", "sea + dog"), 
  rb("Green frog", "green + frog"),
  rb("White cat", "white + cat"), rb("White horse", "white + horse"), rb("Black horse", "black + horse"),
  rb("Black dog", "black + dog"), rb("White dog", "white + dog"), rb("White whale", "white + whale"), 
  rb("Lion fish", "lion + fish"),
  
]);

export const MORE_SCIENCE = puzzlesFor("science", [
  
  rb("Moonstone", "moon + stone"), 
  rb("Snowdrop", "snow + drop"), 
  rb("Sandstone", "sand + stone"), rb("Sandstorm", "sand + storm"),
  rb("Fireman", "fire + man"), rb("Icebox", "ice + box"),
  rb("Pine tree", "pine + tree"), rb("Tree house", "tree + house"), rb("Woodland", "wood + land"), 
  rb("Spaceman", "space + man"), rb("Plant pot", "plant + pot"), 
  rb("Raincloud", "rain + cloud"), rb("Windstorm", "wind + storm"), rb("Pothole", "pot + hole"), rb("Keyhole", "key + hole"),
  rb("Moonrise", "moon + rise"), 
  rb("Snowflake", 'snow + "FLAKE"', { d: 2 }), rb("Sun and moon", "sun & moon"),
  rb("Rain and snow", "rain & snow"), rb("Fire and ice", "fire & ice"), rb("Sea and sky", 'sea & "SKY"', { d: 2 }),
  rb("Water and sand", "water & sand"), rb("Wind and rain", "wind & rain"), rb("Sun and rain", "sun & rain"),
  rb("Star and moon", "star & moon"), rb("Tree and flower", "tree & flower"), rb("Leaf and flower", "leaf & flower"),
  rb("Fire and water", "fire & water"), rb("Earth and sea", "earth & sea"),
]);

export const MORE_SAYINGS = puzzlesFor("sayings", [
  rb("Crossbow", "cross + bow"), rb("Broken home", "broken + home"), rb("Money bag", "money + bag"), rb("Money box", "money + box"),
  rb("Toothache", "tooth + pain=ache"), rb("Keynote", "key + note"), rb("Keyboard", "key + board"), rb("Bluebell", "blue + bell"),
  rb("Dollhouse", "doll + house"), rb("Clockwork", "clock + work"), rb("Homesick", 'home + "SICK"', { d: 2 }),
]);
