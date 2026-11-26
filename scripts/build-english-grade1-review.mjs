import { readFileSync } from "node:fs";
import { books, writePreview } from "./build-english-grade1-preview.mjs";

const editorial = new URL("../docs/library-preview/english-grade1/", import.meta.url);
const publicArt = new URL("../public/previews/english-grade1-art/", import.meta.url);
function readRecords(name) {
  const records = readFileSync(new URL(name, editorial), "utf8").trim().split(/^# /m).filter(Boolean);
  const entries = records.map((record) => {
    const [title, ...lines] = record.trim().split(/\r?\n/);
    return [title, lines];
  });
  const mapped = new Map(entries);
  if (mapped.size !== entries.length || entries.some(([title]) => !books.some((b) => b.title === title))) {
    throw new Error(`Unknown or duplicate title in ${name}.`);
  }
  return mapped;
}
const notes = readRecords("benchmark-review.txt");
const samples = readRecords("revised-samples.txt");
if (notes.size !== 50 || samples.size !== 8) throw new Error("Expected 50 benchmark notes and eight revised samples.");

const numberOfWords = (text) => text.match(/[A-Za-z]+(?:[’'-][A-Za-z]+)*/g)?.length ?? 0;
const pageMetrics = (pages) => {
  const lengths = pages.map(({ text }) => numberOfWords(text));
  return { words: lengths.reduce((sum, n) => sum + n, 0), longestPage: Math.max(...lengths) };
};
const references = {
  "Bob Books": "https://bobbooks.com/product/set-1-beginning-readers/",
  Biscuit: "https://alyssasatincapucilli.com/books/biscuit/",
  "Elephant & Piggie": "https://books.disney.com/book/we-are-in-a-book/",
  "Nat Geo Kids": "https://sites.prh.com/national-geographic-kids/leveled-readers/",
};
const image = (name) => "data:image/webp;base64," + readFileSync(new URL(`${name}.webp`, publicArt)).toString("base64");
const stageOnePractice = {
  "pip-and-the-red-lid": "Blend Pip, sit, lid, and tip. Preview the and still if needed.",
  "a-bag-for-pat": "Blend Pat, bag, cap, map, and nap. Preview goes and wants if needed.",
};
const reviewBooks = books.map((original) => {
  const book = structuredClone(original);
  const sample = samples.get(book.title);
  const [note, words] = notes.get(book.title);
  const [reference, mode, finding] = note.split(" | ");
  const [word, meaning, wrong1, wrong2] = words.split(" | ");
  if (!references[reference] || !mode || !finding || !word || !meaning || !wrong1 || !wrong2) {
    throw new Error(`Missing benchmark or vocabulary data for ${book.title}.`);
  }
  if (sample) {
    book.pages = [];
    for (const line of sample) {
      const metadata = /^(about|read|cover|words): (.+)$/.exec(line);
      if (metadata) {
        book[metadata[1]] = metadata[1] === "words" ? metadata[2].split(", ") : metadata[2];
      } else {
        const [text, art] = line.split(" | ");
        if (!text || !art) throw new Error(`Missing page in ${book.title}.`);
        book.pages.push({ text, art });
      }
    }
    if (book.pages.length !== original.pages.length) throw new Error(`Page count changed in ${book.title}.`);
    for (const focus of book.words) {
      if (!book.pages.some(({ text }) => new RegExp(`\\b${focus}(?:s|es|ed|ing)?\\b`, "i").test(text))) {
        throw new Error(`Practice word "${focus}" is absent from the ${book.title} revision.`);
      }
    }
  }
  if (book.id === "dot-follows-the-steps") {
    book.quiz[1] = { prompt: "What does Dot turn at first?", options: ["The list", "The mat", "A picture card"], answer: 1, page: 4 };
    book.questions[1] = { question: book.quiz[1].prompt, answer: "Dot turns the mat.", page: 4 };
  }
  const wordPattern = new RegExp(`\\b${word}(?:s|ed|ing)?\\b`, "i");
  const wordPage = book.pages.findIndex(({ text }) => wordPattern.test(text)) + 1;
  if (wordPage < 1) throw new Error(`Vocabulary word "${word}" is absent from ${book.title}.`);
  const answer = books.indexOf(original) % 3;
  const options = [wrong1, wrong2];
  options.splice(answer, 0, meaning);
  return {
    ...book,
    editorial: {
      reference, mode, finding, revised: !!sample,
      before: sample ? original.pages.map(({ text }) => text) : null,
      originalMetrics: pageMetrics(original.pages),
      metrics: pageMetrics(book.pages),
      preteach: stageOnePractice[book.id] ?? null,
      wordQuiz: { word, options, answer, page: wordPage },
    },
  };
});

const pictureCards = [
  { word: "lid", alt: "A round red cover with a shallow rim", image: image("word-lid") },
  { word: "mat", alt: "A flat woven rectangle with teal edges", image: image("word-mat") },
  { word: "cat", alt: "A ginger animal with whiskers and four white paws", image: image("word-cat") },
];
const review = {
  references,
  pilot: {
    id: "pip-and-the-red-lid",
    pictures: ["pip-cover", ...Array.from({ length: 6 }, (_, index) => `pip-page-${index + 1}`)].map(image),
    cards: pictureCards,
  },
};
writePreview(reviewBooks, "english-grade1-review.html", review);
