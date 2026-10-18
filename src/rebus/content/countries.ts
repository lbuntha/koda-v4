import { pic, puzzlesFor, sum, word } from "./build";

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
