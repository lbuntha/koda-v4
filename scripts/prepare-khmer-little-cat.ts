import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { layoutBook } from "../src/library/bookLayout";
import type { Passage, Question, Sentence } from "../src/library/data/passage";
import { core, gapOf } from "../src/library/data/text";

const id = "km-g1-story-little-cat";
const dir = `public/library-books/${id}`;
const docs = "docs/library-preview";
const textOnly = process.argv.includes("--check-text");
const photo = (name: string) => "photo-" + createHash("sha256")
  .update(textOnly ? name : readFileSync(`${dir}/${name}.webp`)).digest("hex");

// The separators mark proposed Khmer word breaks. Spaces before a separator
// are intentional printed spaces, including the gap after a speaker tag.
const story = [
  ["សុភា|ចាក់|ទឹក|ចូល|ចាន|តូច|មួយ។", "នាង|ចង់|ឱ្យ|ឆ្មា|ផឹក|ទឹក។"],
  ["សុភា|ហៅ|ថា៖ |«មីមី |មក|ផឹក|ទឹក!» ", "មីមី|មិន|មក|ទេ។"],
  ["សុភា|អោន|មើល|ក្រោម|តុ។", "ក្រោម|តុ|មាន|តែ|ស្បែកជើង|ប៉ា។"],
  ["នាង|មើល|ក្រោម|កៅអី។", "ក្រោម|កៅអី|គ្មាន|ឆ្មា|ទេ។"],
  ["សុភា|ឈប់ |ហើយ|ស្ដាប់។", "នាង|ឮ|សំឡេង៖ |«មៀវ! |មៀវ!»"],
  ["មីមី|នៅ|ក្រោយ|ខ្នើយ! ", "វា|យំ|ថា៖ |«មៀវ!»"],
  ["សុភា|ដាក់|ចាន|ទឹក|ក្បែរ|កន្ទេល។", "នាង|អង្គុយ|រង់ចាំ។"],
  ["មីមី|ដើរ|ចេញ|មក|ផឹក|ទឹក។", "សុភា|អង្គុយ|ស្ងៀម |ទុក|ឱ្យ|វា|ផឹក|តាម|ស្រួល។"],
];
const pageName = (i: number) => `page-${String(i + 1).padStart(2, "0")}`;
const sentences: Sentence[] = story.flatMap((lines, page) => lines.map((line, index) => {
  const words = line.split("|");
  return {
    id: `p${page + 1}s${index + 1}`,
    words,
    text: words.join(""),
    pageBreak: index === 0,
    ...(index === 0 ? {
      picture: photo(pageName(page)),
      ...(page === 4 ? { pageDesign: { heading: "ស្ដាប់សំឡេង" } } : {}),
      ...(page === 6 ? { pageDesign: { heading: "ទឹកសម្រាប់មីមី", layout: "steps" as const } } : {}),
    } : {}),
  };
}));
const wordArt = [
  { word: "ឆ្មា", asset: "word-cat" },
  { word: "ចាន", asset: "word-bowl" },
  { word: "ខ្នើយ", asset: "word-cushion" },
];
const pictures = Object.fromEntries(wordArt.map(({ word, asset }) => [word, photo(asset)]));
const questions: Question[] = [
  { id: "q-water", kind: "comprehension", prompt: "តើសុភាចាក់អ្វីចូលក្នុងចាន?", options: ["បាយ។", "ទឹក។", "ទឹកដោះគោ។"], answer: 1, evidence: "p1s1" },
  { id: "q-sandals", kind: "comprehension", prompt: "តើមានអ្វីនៅក្រោមតុ?", options: ["ចានទឹករបស់មីមី។", "ខ្នើយតូចមួយ។", "ស្បែកជើងប៉ា។"], answer: 2, evidence: "p3s2" },
  { id: "q-chair", kind: "comprehension", prompt: "បន្ទាប់ពីមើលក្រោមតុ តើសុភាមើលនៅឯណា?", options: ["ក្រោមកៅអី។", "លើកន្ទេល។", "ក្រោយខ្នើយ។"], answer: 0, evidence: "p4s1" },
  { id: "q-meow", kind: "comprehension", prompt: "តើសុភាឮសំឡេងអ្វី?", options: ["«មក! មក!»", "«មៀវ! មៀវ!»", "«ផឹកទឹក!»"], answer: 1, evidence: "p5s2" },
  { id: "q-gentle", kind: "comprehension", prompt: "តើសុភាធ្វើអ្វីពេលមីមីផឹកទឹក?", options: ["ដើរចេញទៅក្រៅ។", "ហៅប៉ាឱ្យមកមើល។", "អង្គុយស្ងៀម។"], answer: 2, evidence: "p8s2" },
  { id: "word-cat", kind: "vocab", word: "ឆ្មា", prompt: "តើរូបណាជាឆ្មា?", options: [pictures.ខ្នើយ, pictures.ចាន, pictures.ឆ្មា], answer: 2 },
  { id: "word-bowl", kind: "vocab", word: "ចាន", prompt: "តើរូបណាជាចាន?", options: [pictures.ចាន, pictures.ឆ្មា, pictures.ខ្នើយ], answer: 0 },
  { id: "word-cushion", kind: "vocab", word: "ខ្នើយ", prompt: "តើរូបណាជាខ្នើយ?", options: [pictures.ឆ្មា, pictures.ខ្នើយ, pictures.ចាន], answer: 1 },
  { id: "spell-water", kind: "spell", word: "ទឹក", sentence: "p1s1" },
  { id: "spell-table", kind: "spell", word: "តុ", sentence: "p3s1" },
  { id: "spell-meow", kind: "spell", word: "មៀវ", sentence: "p6s2" },
  { id: "match-clues", kind: "match", prompt: "អានតម្រុយ រួចភ្ជាប់ទៅនឹងពាក្យ។", pairs: [
    { left: "ដាក់ទឹកឱ្យមីមីផឹក", right: "ចាន", evidence: "p1s1" },
    { left: "ប្រើសម្រាប់កើយក្បាល", right: "ខ្នើយ", evidence: "p6s1" },
    { left: "សត្វដែលយំថា «មៀវ!»", right: "ឆ្មា", evidence: "p1s2" },
  ] },
];
const book: Passage = {
  id, rev: 0, language: "km", band: "A", ages: [6, 7], category: "Animals",
  title: "ឆ្មាតូចនៅឯណា?", topics: ["reading", "animals", "family"],
  picture: photo("cover"), sentences, questions, pictures, confirmedPictures: { ...pictures },
  questionCounts: { understand: 5, words: 3, spell: 3, match: 1 },
  wordNotes: {
    មីមី: { reading: "មី មី" },
    កៅអី: { reading: "កៅ អី" },
    សំឡេង: { reading: "សំ ឡេង" },
    ក្រោម: { opposite: "លើ" },
    ចេញ: { opposite: "ចូល" },
    តូច: { opposite: "ធំ" },
  },
  notesInQuiz: { reading: true, opposite: true },
  learningTakeaway: "ពេលថែសត្វ យើងផ្ដល់ទឹកស្អាត ហើយទុកឱ្យវាផឹកតាមស្រួល។",
  provenance: "Original Khmer story for Koda. The cover, eight page illustrations and three vocabulary cards were made with Codex’s built-in image generation. Khmer word breaks are proposed for review.",
};
const layout = layoutBook(book);
if (layout.story.length !== 8 || new Set(layout.pictures).size !== 8) throw new Error("Expected eight illustrated story pages.");
const storyWords = new Set(sentences.flatMap((s) => s.words.map(core)));
if (!Object.keys(book.wordNotes ?? {}).every((word) => storyWords.has(word))) throw new Error("A word note is missing from the story.");
for (const q of questions) {
  if (q.kind === "spell") {
    const sentence = sentences.find((s) => s.id === q.sentence);
    if (!sentence || !gapOf(sentence, q.word, "km")) throw new Error(`Missing spelling word: ${q.word}`);
  }
}
if (textOnly) {
  console.log(JSON.stringify(book));
  process.exit(0);
}
const prompts = JSON.parse(readFileSync(`${docs}/${id}-prompts.json`, "utf8")) as Record<string, string>;
const names = ["cover", ...story.map((_, i) => pageName(i)), ...wordArt.map((w) => w.asset)];
const manifest = {
  bookId: id,
  generator: "Codex built-in image generation",
  assets: names.map((name) => {
    if (!prompts[name]) throw new Error(`Missing image prompt: ${name}`);
    return { name, file: `${name}.webp`, picture: photo(name), prompt: prompts[name] };
  }),
};
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
write(`${docs}/${id}.draft.json`, book);
write(`${dir}/book.json`, book);
write(`${dir}/art-prompts.json`, manifest);
console.log(`Prepared ${layout.story.length} story pages, ${questions.length} questions, and ${names.length} images.`);
