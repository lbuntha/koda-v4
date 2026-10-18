import { and, pic, puzzlesFor, stack, sum, word } from "./build";

export const SAYINGS = puzzlesFor("sayings", [
  { pieces: [pic("broken", "broken heart")], answer: "Broken heart", why: "A heart that is split in two.", trick: "compound" },
  { pieces: sum(pic("cat"), pic("sleep", "nap")), answer: "Cat nap", why: "A cat having a nap: a short sleep.", trick: "compound", accepts: ["catnap"] },
  { pieces: sum(pic("clock", "time"), pic("fly", "flies")), answer: "Time flies", why: "time + flies: time goes by fast.", trick: "compound", difficulty: 2 },
  { pieces: sum(pic("cross"), word("WORD")), answer: "Crossword", why: "cross + word = crossword.", trick: "compound", difficulty: 2 },
  { pieces: sum(pic("black"), pic("sheep")), answer: "Black sheep", why: "black + sheep: the odd one out.", trick: "compound", difficulty: 2 },
  { pieces: sum(pic("hog", "piggy"), pic("money", "bank")), answer: "Piggy bank", why: "A piggy that keeps your money.", trick: "compound", difficulty: 2, accepts: ["pig bank"] },
  { pieces: [{ kind: "word", text: "UPSIDE", style: "upside-down" }], answer: "Upside down", why: "The word UPSIDE is written upside down.", trick: "style", difficulty: 2, accepts: ["up side down"] },
  { pieces: [stack("TROUBLE", "TROUBLE")], answer: "Double trouble", why: "Trouble, twice.", trick: "position", difficulty: 2 },
  { pieces: [stack("STAND", "I")], answer: "I understand", why: "I is under STAND.", trick: "position", difficulty: 2, accepts: ["understand"] },
  { pieces: [stack("MAN", "BOARD")], answer: "Man overboard", why: "MAN is over BOARD.", trick: "position", difficulty: 2 },
  { pieces: [pic("rain", "raining"), ...and(pic("cat", "cats"), pic("dog", "dogs"))], answer: "Raining cats and dogs", why: "Rain, then cats and dogs.", trick: "compound", difficulty: 2, accepts: ["its raining cats and dogs"] },
  { pieces: and(pic("tooth"), pic("nail")), answer: "Tooth and nail", why: "tooth and nail: with all your strength.", trick: "compound", difficulty: 3 },
  { pieces: sum(pic("fire", "hot"), pic("water")), answer: "In hot water", why: "hot + water: in trouble.", trick: "compound", difficulty: 3, accepts: ["hot water"] },
  { pieces: sum(pic("drop"), pic("sea", "ocean")), answer: "A drop in the ocean", why: "One drop in a big sea: a very small amount.", trick: "compound", difficulty: 3, accepts: ["drop in the ocean", "drop in the sea"] },
  { pieces: sum(pic("blue"), pic("moon")), answer: "Once in a blue moon", why: "blue + moon: something that hardly ever happens.", trick: "compound", difficulty: 3, accepts: ["blue moon"] },
  { pieces: [stack("MIND", "MATTER")], answer: "Mind over matter", why: "MIND is over MATTER.", trick: "position", difficulty: 3 },
  { pieces: [stack("HEAD", "HEELS")], answer: "Head over heels", why: "HEAD is over HEELS.", trick: "position", difficulty: 3 },
  { pieces: [pic("fish", "a big fish", "big"), { kind: "word", text: "pond", style: "small" }], answer: "Big fish in a small pond", why: "A big fish and a tiny pond.", trick: "size", difficulty: 3, accepts: ["big fish small pond"] },
]);
