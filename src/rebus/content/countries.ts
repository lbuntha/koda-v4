import { pic, puzzlesFor, sum, word } from "./build";
import { rb } from "./rb";

export const COUNTRIES = puzzlesFor("countries", [
  { pieces: sum(pic("ice"), pic("land")), answer: "Iceland", why: "ice + land = Iceland.", trick: "compound" },
  { pieces: sum(pic("green"), pic("land")), answer: "Greenland", why: "green + land = Greenland.", trick: "compound" },
  { pieces: [pic("turkey")], answer: "Turkey", why: "A turkey bird: the bird and the country share a name.", trick: "sound-alike" },
  { pieces: [pic("whale", "whales")], answer: "Wales", why: "Whales sounds just like Wales.", trick: "sound-alike" },
  { pieces: [pic("chili")], answer: "Chile", why: "A chili pepper sounds like Chile.", trick: "sound-alike" },
  { pieces: sum(pic("fin"), pic("land")), answer: "Finland", why: "fin + land = Finland.", trick: "compound", difficulty: 2 },
  { pieces: sum(pic("tie"), pic("land")), answer: "Thailand", why: "tie + land sounds like Thailand.", trick: "sound-alike", difficulty: 2 },
  { pieces: sum(pic("pole"), pic("land")), answer: "Poland", why: "pole + land = Poland.", trick: "compound", difficulty: 2 },
  { pieces: sum(pic("hole"), pic("land")), answer: "Holland", why: "hole + land sounds like Holland.", trick: "sound-alike", difficulty: 2 },
  { pieces: sum(pic("no"), pic("way")), answer: "Norway", why: "no + way = Norway.", trick: "sound-alike", difficulty: 2 },
  { pieces: sum(word("S"), pic("pain")), answer: "Spain", why: "S + pain = Spain.", trick: "add-remove", difficulty: 2 },
  { pieces: sum(pic("germ"), pic("money")), answer: "Germany", why: "germ + money, said fast, sounds like Germany.", trick: "sound-alike", difficulty: 2 },
  { pieces: sum(pic("jam"), pic("pan")), answer: "Japan", why: "jam + pan sounds like Japan.", trick: "sound-alike", difficulty: 2 },
  { pieces: sum(pic("cube"), word("A")), answer: "Cuba", why: "cube + a sounds like Cuba.", trick: "sound-alike", difficulty: 2 },
  { pieces: sum(pic("eye"), pic("land")), answer: "Ireland", why: "eye + land sounds like Ireland.", trick: "sound-alike", difficulty: 3 },
  { pieces: sum(pic("hay"), pic("tea")), answer: "Haiti", why: "hay + tea sounds like Haiti.", trick: "sound-alike", difficulty: 3 },
]);

/**
 * Say the pictures aloud and a country comes out, like Spain and Japan above.
 * Each drawing is read as what it plainly shows (a seal, a knee, a pear for "pair").
 */
export const COUNTRIES_SAY_IT = puzzlesFor("countries", [
  rb("New Zealand", '"NEW" + seal + land', { d: 2, t: "sound-alike", why: "new + seal + land sounds like New Zealand." }),
  rb("India", '"IN" + deer + "A"', { d: 2, t: "sound-alike", why: "in + deer + a sounds like India." }),
  rb("Jamaica", 'jam + "MAKE" + "A"', { d: 2, t: "sound-alike", why: "jam + make + a sounds like Jamaica." }),
  rb("Iraq", "eye + stone=rock", { d: 2, t: "sound-alike", why: "eye + rock sounds like Iraq." }),
  rb("Sweden", 'candy=sweet + "DEN"', { d: 2, t: "sound-alike", why: "sweet + den sounds like Sweden." }),
  rb("Bahrain", "sheep=baa + rain", { d: 3, t: "sound-alike", why: "A sheep says baa: baa + rain sounds like Bahrain." }),
  rb("Seychelles", '"SAY" + shell=shells', { d: 3, t: "sound-alike", why: "say + shells sounds like Seychelles." }),
  rb("Morocco", '"MO" + stone=rock + "O"', { d: 3, t: "sound-alike", why: "mo + rock + o sounds like Morocco." }),
  rb("Andorra", '"AND" + door + "A"', { d: 3, t: "sound-alike", why: "and + door + a sounds like Andorra." }),
  rb("Pakistan", 'backpack=pack + "IS" + "TAN"', { d: 3, t: "sound-alike", why: "pack + is + tan sounds like Pakistan." }),
  rb("Ukraine", '"U" + crane', { d: 2, t: "sound-alike", why: "U + crane (the tall bird) sounds like Ukraine." }),
  rb("Denmark", '"DEN" + tick=mark', { d: 2, t: "sound-alike", why: "den + mark (a tick is a mark) = Denmark." }),
  rb("Tonga", 'tongue + "A"', { d: 2, t: "sound-alike", why: "tongue + a sounds like Tonga." }),
  rb("Austria", '"OS" + tree + "A"', { d: 3, t: "sound-alike", why: "os + tree + a sounds like Austria." }),
  rb("Guinea", 'guinea-pig=guinea_pig + "PIG"|crossed', { d: 3, t: "add-remove", why: "A guinea pig with the pig taken away leaves Guinea." }),
]);
