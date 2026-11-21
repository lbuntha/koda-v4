/** Prepare the single illustrated draft; this script never calls AI or writes a database. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseStory } from "../src/library/data/text";
import { layoutBook } from "../src/library/bookLayout";
import type { PageDesign, Passage, PicturePlace, Question, Sentence } from "../src/library/data/passage";

const id = "km-g1-story-school-bag";
const story = JSON.parse(readFileSync("docs/library-preview/khmer-grade1-stories.json", "utf8"))
  .find((book: { id: string }) => book.id === "school-bag");
const art = JSON.parse(readFileSync(`docs/library-preview/${id}-art.json`, "utf8"));
const photo = (name: string) => "photo-" + createHash("sha256")
  .update(readFileSync(`public/library-books/${id}/${name}.webp`)).digest("hex");
const packingPages: Record<number, { at: PicturePlace; design: PageDesign }> = {
  8: { at: "top", design: { heading: "រៀបកាបូប", layout: "steps" } },
  9: { at: "top", design: { heading: "ពិនិត្យម្ដងទៀត", layout: "steps", intro: true } },
};
const editedWords: Record<string, string[]> = {
  p4s1: ["យាយ", "សួរ", "ថា៖ ", "«តើ", "មាន", "អ្វី", "ទៀត?» "],
  p4s3: ["ដារា", "យក", "សៀវភៅ", "មួយ", "ចេញ។"],
  p5s1: ["យាយ", "សួរ", "ម្ដង", "ទៀត", "ថា៖ ", "«តើ", "មាន", "អ្វី", "ទៀត?» "],
  p5s3: ["ដារា", "យក", "បន្ទាត់", "មួយ", "ចេញ។"],
  p8s1: ["ដារា", "ដាក់", "ប៊ិច ", "សៀវភៅ ", "និង", "បន្ទាត់", "ចូល", "ក្នុង", "កាបូប។"],
  p8s2: ["គាត់", "បិទ", "កាបូប។"],
  p9s1: ["ល្ងាច", "នោះ ", "ដារា", "រៀប", "កាបូប", "មុន", "ចូល", "គេង។"],
  p9s2: ["គាត់", "រាប់", "របស់", "ទាំង", "បួន ", "ដើម្បី", "កុំ", "ឱ្យ", "ភ្លេច។"],
};
const sentences: Sentence[] = story.pages.flatMap((page: string[], pageIndex: number) =>
  parseStory(page[0], "km").map((sentence, sentenceIndex) => ({
    ...sentence,
    // Keep the original answer evidence IDs after moving the dialogue tags.
    id: `p${pageIndex + 1}s${(pageIndex === 3 || pageIndex === 4) && sentenceIndex === 1 ? 3 : sentenceIndex + 1}`,
    pageBreak: sentenceIndex === 0,
    ...(sentenceIndex === 0 ? {
      picture: photo(`page-${String(pageIndex + 1).padStart(2, "0")}`),
      pictureAt: packingPages[pageIndex + 1]?.at ?? "top",
      textSize: "normal" as const,
      textAlign: "left" as const,
      ...(packingPages[pageIndex + 1] ? { pageDesign: packingPages[pageIndex + 1].design } : {}),
    } : {}),
  })),
);
for (const sentence of sentences) {
  if (editedWords[sentence.id]) {
    sentence.words = editedWords[sentence.id];
    sentence.text = sentence.words.join("");
    continue;
  }
  sentence.words = sentence.words.flatMap((token: string, i: number, tokens: string[]) => {
    if (token === "ដា" && tokens[i + 1] === "រា") return ["ដារា"];
    if (token === "រា" && tokens[i - 1] === "ដា") return [];
    if (token === "ដា" && tokens[i + 1] === "រាយ" && tokens[i + 2] === "ក") return ["ដារា", "យក"];
    if ((token === "រាយ" && tokens[i - 1] === "ដា") || (token === "ក" && tokens[i - 1] === "រាយ")) return [];
    if (token === "តែរ" && tokens[i + 1] === "ក") return ["តែ", "រក"];
    if (token === "ក" && tokens[i - 1] === "តែរ") return [];
    if (token === "ដាក់លើ") return ["ដាក់", "លើ"];
    if (token === "តើមាន") return ["តើ", "មាន"];
    if (token === "មិនឃើញ។") return ["មិន", "ឃើញ។"];
    if (token === "មួយ" && tokens[i + 1] === "ៗ") return ["មួយៗ"];
    if (token === "ៗ" && tokens[i - 1] === "មួយ") return [];
    return [token];
  });
  if (sentence.words[0] === "«") sentence.words.splice(0, 2, "«" + sentence.words[1]);
}
const wordArt = [
  { word: "ប៊ិច", name: "word-pen", prompt: "Isolated blue ballpoint pen with visible cap clip on a light lavender background, warm gouache, no text." },
  { word: "សៀវភៅ", name: "word-book", prompt: "Isolated cream exercise notebook with lavender spine on a light lavender background, warm gouache, no text." },
  { word: "បន្ទាត់", name: "word-ruler", prompt: "Isolated wooden school ruler with measurement ticks on a light lavender background, warm gouache, no text." },
];
const pictures = Object.fromEntries(wordArt.map(({word, name}) => [word, photo(name)]));
const questions: Question[] = [
  { id: "q1", kind: "comprehension", prompt: "តើយាយឃើញកាបូបនៅឯណា?", options: ["នៅលើកៅអី។", "នៅក្រោមតុ។", "នៅក្បែរទ្វារ។"], answer: 1, evidence: "p2s1" },
  { id: "q2", kind: "comprehension", prompt: "តើដារាយកអ្វីចេញពីកាបូបមុនគេ?", options: ["ប៊ិចមួយ។", "បន្ទាត់មួយ។", "ខ្មៅដៃមួយ។"], answer: 0, evidence: "p3s2" },
  { id: "q3", kind: "comprehension", prompt: "តើដារារកអ្វីមិនឃើញពេលចង់គូររូប?", options: ["សៀវភៅ។", "បន្ទាត់។", "ខ្មៅដៃ។"], answer: 2, evidence: "p6s1" },
  { id: "q4", kind: "comprehension", prompt: "តើដារាទុកខ្មៅដៃនៅឯណាកាលពីម្សិលមិញ?", options: ["នៅលើតុ។", "នៅក្នុងកាបូប។", "នៅលើកន្ទេល។"], answer: 0, evidence: "p6s2" },
  { id: "q5", kind: "comprehension", prompt: "តើដារារៀបកាបូបពេលណានៅល្ងាចនោះ?", options: ["ពេលទៅដល់សាលា។", "មុនចូលគេង។", "ពេលកំពុងគូររូប។"], answer: 1, evidence: "p9s1" },
  { id: "word-pen", kind: "vocab", prompt: "តើរូបណាជាប៊ិច?", word: "ប៊ិច", options: [pictures.បន្ទាត់, pictures.ប៊ិច, pictures.សៀវភៅ], answer: 1 },
  { id: "word-book", kind: "vocab", prompt: "តើរូបណាជាសៀវភៅ?", word: "សៀវភៅ", options: [pictures.សៀវភៅ, pictures.បន្ទាត់, pictures.ប៊ិច], answer: 0 },
  { id: "word-ruler", kind: "vocab", prompt: "តើរូបណាជាបន្ទាត់?", word: "បន្ទាត់", options: [pictures.ប៊ិច, pictures.សៀវភៅ, pictures.បន្ទាត់], answer: 2 },
  { id: "spell-table", kind: "spell", sentence: "p2s1", word: "តុ" },
  { id: "spell-pen", kind: "spell", sentence: "p3s2", word: "ប៊ិច" },
  { id: "spell-bag", kind: "spell", sentence: "p9s1", word: "កាបូប" },
  { id: "match-school-tools", kind: "match", prompt: "ភ្ជាប់តម្រុយទៅនឹងសម្ភារៈសិក្សា។", pairs: [
    { left: "មានទឹកខ្មៅ", right: "ប៊ិច", evidence: "p3s2" },
    { left: "មានទំព័រ", right: "សៀវភៅ", evidence: "p4s3" },
    { left: "ប្រើគូសខ្សែត្រង់", right: "បន្ទាត់", evidence: "p5s3" },
  ] },
];
const passage: Passage = {
  id, rev: 0, title: story.title, language: "km" as const, band: "A" as const,
  ages: [6, 7], category: "Everyday", topics: ["reading", "school", "family"],
  questionCounts: { understand: 5, words: 3, spell: 3, match: 1 },
  picture: photo("cover"), sentences, questions, pictures, confirmedPictures: { ...pictures },
  wordNotes: {
    កាបូប: { reading: "កា បូប" },
    សៀវភៅ: { reading: "សៀវ ភៅ" },
    សាលា: { reading: "សា លា" },
    បើក: { opposite: "បិទ" },
    លើ: { opposite: "ក្រោម" },
    ចេញ: { opposite: "ចូល" },
  },
  notesInQuiz: { reading: true, opposite: true },
  noRecording: [], learningTakeaway: story.meaning,
  provenance: "Original Khmer story written for Koda, 2026. Cover and ten page illustrations created with ChatGPT's built-in image generation tool, not the project's image API. Draft: Khmer wording, proposed word segmentation, images and questions await human review. Not published.",
};
const layout = layoutBook(passage);
if (layout.story.length !== 10 || new Set(layout.pictures).size !== 10) throw new Error("Expected ten illustrated story pages");
if (sentences.length > 40 || sentences.some((s) => s.text !== s.words.join(""))) throw new Error("Invalid sentence preparation");
if (layout.stepStarts[7] !== 1 || layout.stepStarts[8] !== 3) throw new Error("Packing steps do not continue across pages");
writeFileSync(`docs/library-preview/${id}.draft.json`, JSON.stringify(passage, null, 2) + "\n");
writeFileSync(`public/library-books/${id}/book.json`, JSON.stringify(passage, null, 2) + "\n");
writeFileSync(`public/library-books/${id}/art-prompts.json`, JSON.stringify({
  bookId: id, generator: art.generator,
  assets: [...art.assets, ...wordArt].map((asset: {name:string;prompt:string}) => ({ name: asset.name, file: `${asset.name}.webp`, picture: photo(asset.name), prompt: asset.prompt })),
}, null, 2) + "\n");
console.log(JSON.stringify({id, storyPages: layout.story.length, questions: questions.length, images: 11 + wordArt.length, confirmedSplit: false}));
