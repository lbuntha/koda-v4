import type { AgeRange } from "../../lib/ages";
import type { CategoryId, Difficulty, Piece, Puzzle } from "../types";
import { pic, sum, word } from "./build";

/**
 * Puzzles in Khmer, for Khmer players: a Khmer word or picture plus another picture
 * makes a real Khmer compound ("កូន" + a dog = កូនឆ្កែ, a puppy). English wordplay
 * does not carry over, so these are their own puzzles, filed under the topics they
 * belong to and shown only to children reading Khmer (`onlyIn`). A Khmer reader checks
 * each one in the Studio before it is published.
 */

interface Spec {
  key: string;
  category: CategoryId;
  pieces: Piece[];
  answer: string;
  why: string;
  difficulty: Difficulty;
  ages: AgeRange;
}

const make = ({ key, category, pieces, answer, why, difficulty, ages }: Spec): Puzzle => ({
  id: `kmplay-${key}`,
  category,
  ages,
  difficulty,
  trick: "compound",
  pieces,
  answer,
  accepts: [],
  explanation: why,
  onlyIn: "km",
  source: "official",
});

export const KHMER_PLAY: Puzzle[] = [
  make({ key: "young-dog", category: "animals", pieces: sum(word("កូន"), pic("dog", "ឆ្កែ")), answer: "កូនឆ្កែ", why: "កូន + ឆ្កែ = កូនឆ្កែ។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-cat", category: "animals", pieces: sum(word("កូន"), pic("cat", "ឆ្មា")), answer: "កូនឆ្មា", why: "កូន + ឆ្មា = កូនឆ្មា។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-cow", category: "animals", pieces: sum(word("កូន"), pic("cow", "គោ")), answer: "កូនគោ", why: "កូន + គោ = កូនគោ។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-duck", category: "animals", pieces: sum(word("កូន"), pic("duck", "ទា")), answer: "កូនទា", why: "កូន + ទា = កូនទា។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-horse", category: "animals", pieces: sum(word("កូន"), pic("horse", "សេះ")), answer: "កូនសេះ", why: "កូន + សេះ = កូនសេះ។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-sheep", category: "animals", pieces: sum(word("កូន"), pic("sheep", "ចៀម")), answer: "កូនចៀម", why: "កូន + ចៀម = កូនចៀម។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-hen", category: "animals", pieces: sum(word("កូន"), pic("hen", "មាន់")), answer: "កូនមាន់", why: "កូន + មាន់ = កូនមាន់។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-fish", category: "animals", pieces: sum(word("កូន"), pic("fish", "ត្រី")), answer: "កូនត្រី", why: "កូន + ត្រី = កូនត្រី។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-pig", category: "animals", pieces: sum(word("កូន"), pic("pig", "ជ្រូក")), answer: "កូនជ្រូក", why: "កូន + ជ្រូក = កូនជ្រូក។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-monkey", category: "animals", pieces: sum(word("កូន"), pic("monkey", "ស្វា")), answer: "កូនស្វា", why: "កូន + ស្វា = កូនស្វា។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-goat", category: "animals", pieces: sum(word("កូន"), pic("goat", "ពពែ")), answer: "កូនពពែ", why: "កូន + ពពែ = កូនពពែ។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-rabbit", category: "animals", pieces: sum(word("កូន"), pic("rabbit", "ទន្សាយ")), answer: "កូនទន្សាយ", why: "កូន + ទន្សាយ = កូនទន្សាយ។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-elephant", category: "animals", pieces: sum(word("កូន"), pic("elephant", "ដំរី")), answer: "កូនដំរី", why: "កូន + ដំរី = កូនដំរី។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "young-tiger", category: "animals", pieces: sum(word("កូន"), pic("tiger", "ខ្លា")), answer: "កូនខ្លា", why: "កូន + ខ្លា = កូនខ្លា។ កូនសត្វតូចៗ។", difficulty: 1, ages: [5, 9] }),
  make({ key: "wild-cat", category: "animals", pieces: sum(pic("cat", "ឆ្មា"), pic("forest", "ព្រៃ")), answer: "ឆ្មាព្រៃ", why: "ឆ្មា + ព្រៃ = ឆ្មាព្រៃ។ សត្វដែលរស់នៅក្នុងព្រៃ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "wild-pig", category: "animals", pieces: sum(pic("pig", "ជ្រូក"), pic("forest", "ព្រៃ")), answer: "ជ្រូកព្រៃ", why: "ជ្រូក + ព្រៃ = ជ្រូកព្រៃ។ សត្វដែលរស់នៅក្នុងព្រៃ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "wild-hen", category: "animals", pieces: sum(pic("hen", "មាន់"), pic("forest", "ព្រៃ")), answer: "មាន់ព្រៃ", why: "មាន់ + ព្រៃ = មាន់ព្រៃ។ សត្វដែលរស់នៅក្នុងព្រៃ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "wild-duck", category: "animals", pieces: sum(pic("duck", "ទា"), pic("forest", "ព្រៃ")), answer: "ទាព្រៃ", why: "ទា + ព្រៃ = ទាព្រៃ។ សត្វដែលរស់នៅក្នុងព្រៃ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "wild-cow", category: "animals", pieces: sum(pic("cow", "គោ"), pic("forest", "ព្រៃ")), answer: "គោព្រៃ", why: "គោ + ព្រៃ = គោព្រៃ។ សត្វដែលរស់នៅក្នុងព្រៃ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "fish-sea", category: "animals", pieces: sum(pic("fish", "ត្រី"), pic("sea", "សមុទ្រ")), answer: "ត្រីសមុទ្រ", why: "ត្រី + សមុទ្រ = ត្រីសមុទ្រ។ ត្រីដែលរស់នៅក្នុងសមុទ្រ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "fish-river", category: "animals", pieces: sum(pic("fish", "ត្រី"), pic("river", "ទន្លេ")), answer: "ត្រីទន្លេ", why: "ត្រី + ទន្លេ = ត្រីទន្លេ។ ត្រីដែលរស់នៅក្នុងទន្លេ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "fish-lake", category: "animals", pieces: sum(pic("fish", "ត្រី"), pic("lake", "បឹង")), answer: "ត្រីបឹង", why: "ត្រី + បឹង = ត្រីបឹង។ ត្រីដែលរស់នៅក្នុងបឹង។", difficulty: 2, ages: [7, 12] }),
  make({ key: "meat-cow", category: "food", pieces: sum(word("សាច់"), pic("cow", "គោ")), answer: "សាច់គោ", why: "សាច់ + គោ = សាច់គោ។", difficulty: 1, ages: [6, 10] }),
  make({ key: "meat-pig", category: "food", pieces: sum(word("សាច់"), pic("pig", "ជ្រូក")), answer: "សាច់ជ្រូក", why: "សាច់ + ជ្រូក = សាច់ជ្រូក។", difficulty: 1, ages: [6, 10] }),
  make({ key: "meat-hen", category: "food", pieces: sum(word("សាច់"), pic("hen", "មាន់")), answer: "សាច់មាន់", why: "សាច់ + មាន់ = សាច់មាន់។", difficulty: 1, ages: [6, 10] }),
  make({ key: "meat-duck", category: "food", pieces: sum(word("សាច់"), pic("duck", "ទា")), answer: "សាច់ទា", why: "សាច់ + ទា = សាច់ទា។", difficulty: 1, ages: [6, 10] }),
  make({ key: "meat-fish", category: "food", pieces: sum(word("សាច់"), pic("fish", "ត្រី")), answer: "សាច់ត្រី", why: "សាច់ + ត្រី = សាច់ត្រី។", difficulty: 1, ages: [6, 10] }),
  make({ key: "meat-sheep", category: "food", pieces: sum(word("សាច់"), pic("sheep", "ចៀម")), answer: "សាច់ចៀម", why: "សាច់ + ចៀម = សាច់ចៀម។", difficulty: 1, ages: [6, 10] }),
  make({ key: "meat-goat", category: "food", pieces: sum(word("សាច់"), pic("goat", "ពពែ")), answer: "សាច់ពពែ", why: "សាច់ + ពពែ = សាច់ពពែ។", difficulty: 1, ages: [6, 10] }),
  make({ key: "soup-hen", category: "food", pieces: sum(pic("soup", "ស៊ុប"), pic("hen", "មាន់")), answer: "ស៊ុបមាន់", why: "ស៊ុប + មាន់ = ស៊ុបមាន់។", difficulty: 1, ages: [6, 10] }),
  make({ key: "soup-fish", category: "food", pieces: sum(pic("soup", "ស៊ុប"), pic("fish", "ត្រី")), answer: "ស៊ុបត្រី", why: "ស៊ុប + ត្រី = ស៊ុបត្រី។", difficulty: 1, ages: [6, 10] }),
  make({ key: "rice-hen", category: "food", pieces: sum(pic("rice", "បាយ"), pic("hen", "មាន់")), answer: "បាយមាន់", why: "បាយ + មាន់ = បាយមាន់។", difficulty: 1, ages: [6, 10] }),
  make({ key: "juice-orange", category: "food", pieces: sum(word("ទឹក"), pic("orange", "ក្រូច")), answer: "ទឹកក្រូច", why: "ទឹក + ក្រូច = ទឹកក្រូច។ ភេសជ្ជៈធ្វើពីក្រូច។", difficulty: 1, ages: [6, 10] }),
  make({ key: "salt-water", category: "food", pieces: sum(word("ទឹក"), pic("salt", "អំបិល")), answer: "ទឹកអំបិល", why: "ទឹក + អំបិល = ទឹកអំបិល។ ទឹកដែលមានអំបិលលាយ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "sugar-palm", category: "food", pieces: sum(pic("sugar", "ស្ករ"), word("ត្នោត")), answer: "ស្ករត្នោត", why: "ស្ករ + ត្នោត = ស្ករត្នោត។ ស្ករធ្វើពីដើមត្នោត។", difficulty: 2, ages: [7, 12] }),
  make({ key: "egg-duck", category: "food", pieces: sum(pic("egg", "ពង"), pic("duck", "ទា")), answer: "ពងទា", why: "ពង + ទា = ពងទា។", difficulty: 1, ages: [6, 10] }),
  make({ key: "fruit-apple", category: "food", pieces: sum(word("ផ្លែ"), pic("apple", "ប៉ោម")), answer: "ផ្លែប៉ោម", why: "ផ្លែ + ប៉ោម = ផ្លែប៉ោម។", difficulty: 1, ages: [6, 10] }),
  make({ key: "fruit-banana", category: "food", pieces: sum(word("ផ្លែ"), pic("banana", "ចេក")), answer: "ផ្លែចេក", why: "ផ្លែ + ចេក = ផ្លែចេក។", difficulty: 1, ages: [6, 10] }),
  make({ key: "fruit-orange", category: "food", pieces: sum(word("ផ្លែ"), pic("orange", "ក្រូច")), answer: "ផ្លែក្រូច", why: "ផ្លែ + ក្រូច = ផ្លែក្រូច។", difficulty: 1, ages: [6, 10] }),
  make({ key: "fruit-wood", category: "food", pieces: sum(word("ផ្លែ"), pic("wood", "ឈើ")), answer: "ផ្លែឈើ", why: "ផ្លែ + ឈើ = ផ្លែឈើ។ ផ្លែឈើដែលយើងបរិភោគ។", difficulty: 2, ages: [7, 12] }),
];
