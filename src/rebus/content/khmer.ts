import type { AgeRange } from "../../lib/ages";
import type { CategoryId, Difficulty, Piece, Puzzle } from "../types";
import { pic, sum } from "./build";

/**
 * Khmer words, filed under the topics they belong to (animals, science, school,
 * food, sayings) and playable in both languages.
 *
 * A picture is read as its English name in English and as its Khmer word in Khmer
 * (`km.answer`); typing either one is right. The compound words are Khmer
 * wordplay, so their English version says what the Khmer word means. Every one is
 * a draft for a Khmer speaker to read before it is published, like any other
 * puzzle. The id keeps its old `khmer-` start (a Khmer word has no Latin letters to
 * make one from) so puzzles already in a database are updated, not doubled.
 */

interface Spec {
  key: string;
  category: CategoryId;
  /** The question as English and as Khmer: the same drawings, read differently. */
  en: Piece[];
  km: Piece[];
  answer: string;
  khmerAnswer: string;
  accepts: string[];
  why: string;
  khmerWhy: string;
  difficulty: Difficulty;
  ages: AgeRange;
}

const make = (s: Spec): Puzzle => ({
  id: `khmer-${s.key}`,
  category: s.category,
  ages: s.ages,
  difficulty: s.difficulty,
  trick: "compound",
  pieces: s.en,
  answer: s.answer,
  // What a child may type in either language: the Khmer word and its other spellings.
  accepts: [s.khmerAnswer, ...s.accepts],
  explanation: s.why,
  km: { pieces: s.km, answer: s.khmerAnswer, explanation: s.khmerWhy },
  source: "official",
});

export const KHMER: Puzzle[] = [
  make({ key: "sun", category: "science", en: [pic("sun", "sun")], km: [pic("sun", "ព្រះអាទិត្យ")], answer: "sun", khmerAnswer: "ព្រះអាទិត្យ", accepts: ["ថ្ងៃ"], why: "This picture is read as \"sun\".", khmerWhy: "រូបនេះជាព្រះអាទិត្យ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "moon", category: "science", en: [pic("moon", "moon")], km: [pic("moon", "ព្រះច័ន្ទ")], answer: "moon", khmerAnswer: "ព្រះច័ន្ទ", accepts: ["ខែ"], why: "This picture is read as \"moon\".", khmerWhy: "រូបនេះជាព្រះច័ន្ទ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "star", category: "science", en: [pic("star", "star")], km: [pic("star", "ផ្កាយ")], answer: "star", khmerAnswer: "ផ្កាយ", accepts: [], why: "This picture is read as \"star\".", khmerWhy: "រូបនេះជាផ្កាយ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "fish", category: "animals", en: [pic("fish", "fish")], km: [pic("fish", "ត្រី")], answer: "fish", khmerAnswer: "ត្រី", accepts: [], why: "This picture is read as \"fish\".", khmerWhy: "រូបនេះជាត្រី។", difficulty: 1, ages: [5, 10] }),
  make({ key: "bird", category: "animals", en: [pic("bird", "bird")], km: [pic("bird", "បក្សី")], answer: "bird", khmerAnswer: "បក្សី", accepts: ["សត្វស្លាប", "សត្វបក្សី"], why: "This picture is read as \"bird\".", khmerWhy: "រូបនេះជាបក្សី។", difficulty: 1, ages: [5, 10] }),
  make({ key: "dog", category: "animals", en: [pic("dog", "dog")], km: [pic("dog", "ឆ្កែ")], answer: "dog", khmerAnswer: "ឆ្កែ", accepts: ["សត្វឆ្កែ"], why: "This picture is read as \"dog\".", khmerWhy: "រូបនេះជាឆ្កែ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "cat", category: "animals", en: [pic("cat", "cat")], km: [pic("cat", "ឆ្មា")], answer: "cat", khmerAnswer: "ឆ្មា", accepts: ["សត្វឆ្មា"], why: "This picture is read as \"cat\".", khmerWhy: "រូបនេះជាឆ្មា។", difficulty: 1, ages: [5, 10] }),
  make({ key: "egg", category: "food", en: [pic("egg", "egg")], km: [pic("egg", "ពង")], answer: "egg", khmerAnswer: "ពងមាន់", accepts: ["ពង"], why: "This picture is read as \"egg\".", khmerWhy: "រូបនេះជាពង។", difficulty: 1, ages: [5, 10] }),
  make({ key: "house", category: "school", en: [pic("house", "house")], km: [pic("house", "ផ្ទះ")], answer: "house", khmerAnswer: "ផ្ទះ", accepts: [], why: "This picture is read as \"house\".", khmerWhy: "រូបនេះជាផ្ទះ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "flower", category: "science", en: [pic("flower", "flower")], km: [pic("flower", "ផ្កា")], answer: "flower", khmerAnswer: "ផ្កា", accepts: [], why: "This picture is read as \"flower\".", khmerWhy: "រូបនេះជាផ្កា។", difficulty: 1, ages: [5, 10] }),
  make({ key: "book", category: "school", en: [pic("book", "book")], km: [pic("book", "សៀវភៅ")], answer: "book", khmerAnswer: "សៀវភៅ", accepts: [], why: "This picture is read as \"book\".", khmerWhy: "រូបនេះជាសៀវភៅ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "water", category: "science", en: [pic("water", "water")], km: [pic("water", "ទឹក")], answer: "water", khmerAnswer: "ទឹក", accepts: [], why: "This picture is read as \"water\".", khmerWhy: "រូបនេះជាទឹក។", difficulty: 1, ages: [5, 10] }),
  make({ key: "fire", category: "science", en: [pic("fire", "fire")], km: [pic("fire", "ភ្លើង")], answer: "fire", khmerAnswer: "ភ្លើង", accepts: [], why: "This picture is read as \"fire\".", khmerWhy: "រូបនេះជាភ្លើង។", difficulty: 1, ages: [5, 10] }),
  make({ key: "rain", category: "science", en: [pic("rain", "rain")], km: [pic("rain", "ភ្លៀង")], answer: "rain", khmerAnswer: "ភ្លៀង", accepts: [], why: "This picture is read as \"rain\".", khmerWhy: "រូបនេះជាភ្លៀង។", difficulty: 1, ages: [5, 10] }),
  make({ key: "leaf", category: "science", en: [pic("leaf", "leaf")], km: [pic("leaf", "ស្លឹក")], answer: "leaf", khmerAnswer: "ស្លឹក", accepts: [], why: "This picture is read as \"leaf\".", khmerWhy: "រូបនេះជាស្លឹក។", difficulty: 1, ages: [5, 10] }),
  make({ key: "key", category: "school", en: [pic("key", "key")], km: [pic("key", "កូនសោ")], answer: "key", khmerAnswer: "កូនសោ", accepts: ["សោ", "សោរ"], why: "This picture is read as \"key\".", khmerWhy: "រូបនេះជាកូនសោ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "horse", category: "animals", en: [pic("horse", "horse")], km: [pic("horse", "សេះ")], answer: "horse", khmerAnswer: "សេះ", accepts: ["សត្វសេះ"], why: "This picture is read as \"horse\".", khmerWhy: "រូបនេះជាសេះ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "sheep", category: "animals", en: [pic("sheep", "sheep")], km: [pic("sheep", "ចៀម")], answer: "sheep", khmerAnswer: "ចៀម", accepts: ["សត្វចៀម"], why: "This picture is read as \"sheep\".", khmerWhy: "រូបនេះជាចៀម។", difficulty: 1, ages: [5, 10] }),
  make({ key: "frog", category: "animals", en: [pic("frog", "frog")], km: [pic("frog", "កង្កែប")], answer: "frog", khmerAnswer: "កង្កែប", accepts: ["សត្វកង្កែប"], why: "This picture is read as \"frog\".", khmerWhy: "រូបនេះជាកង្កែប។", difficulty: 1, ages: [5, 10] }),
  make({ key: "monkey", category: "animals", en: [pic("monkey", "monkey")], km: [pic("monkey", "ស្វា")], answer: "monkeys", khmerAnswer: "ស្វា", accepts: ["សត្វស្វា"], why: "This picture is read as \"monkey\".", khmerWhy: "រូបនេះជាស្វា។", difficulty: 1, ages: [5, 10] }),
  make({ key: "pencil", category: "school", en: [pic("pencil", "pencil")], km: [pic("pencil", "ខ្មៅដៃ")], answer: "pencil", khmerAnswer: "ខ្មៅដៃ", accepts: [], why: "This picture is read as \"pencil\".", khmerWhy: "រូបនេះជាខ្មៅដៃ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "cloud", category: "science", en: [pic("cloud", "cloud")], km: [pic("cloud", "ពពក")], answer: "cloud", khmerAnswer: "ពពក", accepts: [], why: "This picture is read as \"cloud\".", khmerWhy: "រូបនេះជាពពក។", difficulty: 1, ages: [5, 10] }),
  make({ key: "wind", category: "science", en: [pic("wind", "wind")], km: [pic("wind", "ខ្យល់")], answer: "wind", khmerAnswer: "ខ្យល់", accepts: [], why: "This picture is read as \"wind\".", khmerWhy: "រូបនេះជាខ្យល់។", difficulty: 1, ages: [5, 10] }),
  make({ key: "sea", category: "science", en: [pic("sea", "sea")], km: [pic("sea", "សមុទ្រ")], answer: "sea", khmerAnswer: "សមុទ្រ", accepts: [], why: "This picture is read as \"sea\".", khmerWhy: "រូបនេះជាសមុទ្រ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "bee", category: "animals", en: [pic("bee", "bee")], km: [pic("bee", "ឃ្មុំ")], answer: "bee", khmerAnswer: "ឃ្មុំ", accepts: ["សត្វឃ្មុំ"], why: "This picture is read as \"bee\".", khmerWhy: "រូបនេះជាឃ្មុំ។", difficulty: 1, ages: [5, 10] }),
  make({ key: "corn", category: "food", en: [pic("corn", "corn")], km: [pic("corn", "ពោត")], answer: "corn", khmerAnswer: "ពោត", accepts: [], why: "This picture is read as \"corn\".", khmerWhy: "រូបនេះជាពោត។", difficulty: 1, ages: [5, 10] }),
  make({ key: "water-ice", category: "sayings", en: sum(pic("water", "water"), pic("ice", "frozen")), km: sum(pic("water", "ទឹក"), pic("ice", "កក")), answer: "ice", khmerAnswer: "ទឹកកក", accepts: [], why: "In Khmer, water + frozen (ទឹកកក) is ice.", khmerWhy: "ទឹក + កក = ទឹកកក។", difficulty: 2, ages: [7, 12] }),
  make({ key: "water-fish", category: "sayings", en: sum(pic("water", "water"), pic("fish", "fish")), km: sum(pic("water", "ទឹក"), pic("fish", "ត្រី")), answer: "fish sauce", khmerAnswer: "ទឹកត្រី", accepts: [], why: "In Khmer, water + fish (ទឹកត្រី) is fish sauce.", khmerWhy: "ទឹក + ត្រី = ទឹកត្រី។", difficulty: 2, ages: [7, 12] }),
  make({ key: "water-bee", category: "sayings", en: sum(pic("water", "water"), pic("bee", "bee")), km: sum(pic("water", "ទឹក"), pic("bee", "ឃ្មុំ")), answer: "honey", khmerAnswer: "ទឹកឃ្មុំ", accepts: [], why: "In Khmer, water + bee (ទឹកឃ្មុំ) is honey.", khmerWhy: "ទឹក + ឃ្មុំ = ទឹកឃ្មុំ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "tree-wood", category: "sayings", en: sum(pic("tree", "tree trunk"), pic("wood", "wood")), km: sum(pic("tree", "ដើម"), pic("wood", "ឈើ")), answer: "tree", khmerAnswer: "ដើមឈើ", accepts: [], why: "In Khmer, trunk + wood (ដើមឈើ) is a tree.", khmerWhy: "ដើម + ឈើ = ដើមឈើ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "leaf-wood", category: "sayings", en: sum(pic("leaf", "leaf"), pic("wood", "wood")), km: sum(pic("leaf", "ស្លឹក"), pic("wood", "ឈើ")), answer: "tree leaf", khmerAnswer: "ស្លឹកឈើ", accepts: [], why: "In Khmer, leaf + wood (ស្លឹកឈើ) is a tree leaf.", khmerWhy: "ស្លឹក + ឈើ = ស្លឹកឈើ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "wind-storm", category: "sayings", en: sum(pic("wind", "wind"), pic("storm", "storm")), km: sum(pic("wind", "ខ្យល់"), pic("storm", "ព្យុះ")), answer: "storm", khmerAnswer: "ខ្យល់ព្យុះ", accepts: [], why: "In Khmer, wind + storm (ខ្យល់ព្យុះ) is a storm.", khmerWhy: "ខ្យល់ + ព្យុះ = ខ្យល់ព្យុះ។", difficulty: 2, ages: [7, 12] }),
  make({ key: "earth-sand", category: "sayings", en: sum(pic("earth", "soil"), pic("sand", "sand")), km: sum(pic("earth", "ដី"), pic("sand", "ខ្សាច់")), answer: "sandy soil", khmerAnswer: "ដីខ្សាច់", accepts: [], why: "In Khmer, soil + sand (ដីខ្សាច់) is sandy soil.", khmerWhy: "ដី + ខ្សាច់ = ដីខ្សាច់។", difficulty: 2, ages: [7, 12] }),
  make({ key: "water-earth", category: "sayings", en: sum(pic("water", "water"), pic("earth", "soil")), km: sum(pic("water", "ទឹក"), pic("earth", "ដី")), answer: "homeland", khmerAnswer: "ទឹកដី", accepts: ["country"], why: "In Khmer, water + land (ទឹកដី) is a homeland: the country we belong to.", khmerWhy: "ទឹក + ដី = ទឹកដី ជាកន្លែងដែលជាប្រទេសរបស់យើង។", difficulty: 3, ages: [9, 14] }),
];
