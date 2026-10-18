import { puzzlesFor, pic, sum } from "./build";

/**
 * Khmer words: name the picture, or put two pictures together, and answer in Khmer.
 *
 * A first small pack for early readers (about 5 to 12). Answers are typed in
 * Khmer script; the typo allowance, spacing and the like work as for any other
 * answer. Every one is saved as a draft for a Khmer speaker to read before it
 * is published, like any other puzzle. The id is spelled out (`key`) because a
 * Khmer word has no Latin letters to make one from.
 */
export const KHMER = puzzlesFor("khmer", [
  { key: "sun", pieces: [pic("sun")], answer: "ព្រះអាទិត្យ", why: "រូបនេះជាព្រះអាទិត្យ។", trick: "compound", ages: [5, 10], accepts: ["ថ្ងៃ"] },
  { key: "moon", pieces: [pic("moon")], answer: "ព្រះច័ន្ទ", why: "រូបនេះជាព្រះច័ន្ទ។", trick: "compound", ages: [5, 10], accepts: ["ខែ"] },
  { key: "star", pieces: [pic("star")], answer: "ផ្កាយ", why: "រូបនេះជាផ្កាយ។", trick: "compound", ages: [5, 10] },
  { key: "fish", pieces: [pic("fish")], answer: "ត្រី", why: "រូបនេះជាត្រី។", trick: "compound", ages: [5, 10] },
  { key: "bird", pieces: [pic("bird")], answer: "បក្សី", why: "រូបនេះជាបក្សី។", trick: "compound", ages: [5, 10], accepts: ["សត្វស្លាប", "សត្វបក្សី"] },
  { key: "dog", pieces: [pic("dog")], answer: "ឆ្កែ", why: "រូបនេះជាឆ្កែ។", trick: "compound", ages: [5, 10], accepts: ["សត្វឆ្កែ"] },
  { key: "cat", pieces: [pic("cat")], answer: "ឆ្មា", why: "រូបនេះជាឆ្មា។", trick: "compound", ages: [5, 10], accepts: ["សត្វឆ្មា"] },
  { key: "egg", pieces: [pic("egg")], answer: "ពងមាន់", why: "រូបនេះជាពង។", trick: "compound", ages: [5, 10], accepts: ["ពង"] },
  { key: "house", pieces: [pic("house")], answer: "ផ្ទះ", why: "រូបនេះជាផ្ទះ។", trick: "compound", ages: [5, 10] },
  { key: "flower", pieces: [pic("flower")], answer: "ផ្កា", why: "រូបនេះជាផ្កា។", trick: "compound", ages: [5, 10] },
  { key: "book", pieces: [pic("book")], answer: "សៀវភៅ", why: "រូបនេះជាសៀវភៅ។", trick: "compound", ages: [5, 10] },
  { key: "water", pieces: [pic("water")], answer: "ទឹក", why: "រូបនេះជាទឹក។", trick: "compound", ages: [5, 10] },
  { key: "fire", pieces: [pic("fire")], answer: "ភ្លើង", why: "រូបនេះជាភ្លើង។", trick: "compound", ages: [5, 10] },
  { key: "rain", pieces: [pic("rain")], answer: "ភ្លៀង", why: "រូបនេះជាភ្លៀង។", trick: "compound", ages: [5, 10] },
  { key: "leaf", pieces: [pic("leaf")], answer: "ស្លឹក", why: "រូបនេះជាស្លឹក។", trick: "compound", ages: [5, 10] },
  { key: "key", pieces: [pic("key")], answer: "កូនសោ", why: "រូបនេះជាកូនសោ។", trick: "compound", ages: [5, 10], accepts: ["សោ", "សោរ"] },
  { key: "horse", pieces: [pic("horse")], answer: "សេះ", why: "រូបនេះជាសេះ។", trick: "compound", ages: [5, 10], accepts: ["សត្វសេះ"] },
  { key: "sheep", pieces: [pic("sheep")], answer: "ចៀម", why: "រូបនេះជាចៀម។", trick: "compound", ages: [5, 10], accepts: ["សត្វចៀម"] },
  { key: "frog", pieces: [pic("frog")], answer: "កង្កែប", why: "រូបនេះជាកង្កែប។", trick: "compound", ages: [5, 10], accepts: ["សត្វកង្កែប"] },
  { key: "monkey", pieces: [pic("monkey")], answer: "ស្វា", why: "រូបនេះជាស្វា។", trick: "compound", ages: [5, 10], accepts: ["សត្វស្វា"] },
  { key: "pencil", pieces: [pic("pencil")], answer: "ខ្មៅដៃ", why: "រូបនេះជាខ្មៅដៃ។", trick: "compound", ages: [5, 10] },
  { key: "cloud", pieces: [pic("cloud")], answer: "ពពក", why: "រូបនេះជាពពក។", trick: "compound", ages: [5, 10] },
  { key: "wind", pieces: [pic("wind")], answer: "ខ្យល់", why: "រូបនេះជាខ្យល់។", trick: "compound", ages: [5, 10] },
  { key: "sea", pieces: [pic("sea")], answer: "សមុទ្រ", why: "រូបនេះជាសមុទ្រ។", trick: "compound", ages: [5, 10] },
  { key: "bee", pieces: [pic("bee")], answer: "ឃ្មុំ", why: "រូបនេះជាឃ្មុំ។", trick: "compound", ages: [5, 10], accepts: ["សត្វឃ្មុំ"] },
  { key: "corn", pieces: [pic("corn")], answer: "ពោត", why: "រូបនេះជាពោត។", trick: "compound", ages: [5, 10] },
  { key: "water-ice", pieces: sum(pic("water"), pic("ice")), answer: "ទឹកកក", why: "ទឹក + កក = ទឹកកក។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "water-fish", pieces: sum(pic("water"), pic("fish")), answer: "ទឹកត្រី", why: "ទឹក + ត្រី = ទឹកត្រី។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "water-sea", pieces: sum(pic("water"), pic("sea")), answer: "ទឹកសមុទ្រ", why: "ទឹក + សមុទ្រ = ទឹកសមុទ្រ។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "water-bee", pieces: sum(pic("water"), pic("bee")), answer: "ទឹកឃ្មុំ", why: "ទឹក + ឃ្មុំ = ទឹកឃ្មុំ។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "water-rain", pieces: sum(pic("water"), pic("rain")), answer: "ទឹកភ្លៀង", why: "ទឹក + ភ្លៀង = ទឹកភ្លៀង។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "tree-wood", pieces: sum(pic("tree"), pic("wood")), answer: "ដើមឈើ", why: "ដើម + ឈើ = ដើមឈើ។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "leaf-wood", pieces: sum(pic("leaf"), pic("wood")), answer: "ស្លឹកឈើ", why: "ស្លឹក + ឈើ = ស្លឹកឈើ។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "wind-storm", pieces: sum(pic("wind"), pic("storm")), answer: "ខ្យល់ព្យុះ", why: "ខ្យល់ + ព្យុះ = ខ្យល់ព្យុះ។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "earth-sand", pieces: sum(pic("earth"), pic("sand")), answer: "ដីខ្សាច់", why: "ដី + ខ្សាច់ = ដីខ្សាច់។", trick: "compound", difficulty: 2, ages: [7, 12] },
  { key: "water-earth", pieces: sum(pic("water"), pic("earth")), answer: "ទឹកដី", why: "ទឹក + ដី = ទឹកដី ជាកន្លែងដែលជាប្រទេសរបស់យើង។", trick: "compound", difficulty: 3, ages: [9, 14] },
]);
