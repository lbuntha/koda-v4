import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = new URL("../docs/library-preview/english-grade2/", import.meta.url);
/** Pages per book in each stage: Grade 2 books are longer than Grade 1 (6–10 pages). */
const targets = [10, 12, 12, 14, 14];
/** @typedef {{id: string, title: string, topic: string, icon: string, skill: string, stage: number, about: string, words: string[], cover: string, read: string, pages: {text: string, art: string}[], questions: {question: string, answer: string, page: number}[], quiz: {prompt: string, options: string[], answer: number, page: number}[]}} ReadingDraft */
/** @type {ReadingDraft[]} */
const books = [];
const files = readdirSync(directory).filter((name) => /^0[1-5]-.*\.txt$/.test(name)).sort();
// Written one stage at a time; build whatever stages exist so far.
if (files.length === 0 || files.length > targets.length) throw new Error("Expected one to five reading stages.");
const quizzes = new Map(readFileSync(new URL("quizzes.txt", directory), "utf8").trim().split(/^# /m).filter(Boolean).map((record) => {
  const [title, ...rows] = record.trim().split(/\r?\n/);
  return [title, rows.map((row) => row.split(" | "))];
}));

for (const [stageIndex, file] of files.entries()) {
  const records = readFileSync(new URL(file, directory), "utf8").trim().split(/^# /m).filter(Boolean);
  if (records.length !== 10) throw new Error(`${file}: expected ten books.`);
  for (const record of records) {
    const [header, ...lines] = record.trim().split(/\r?\n/);
    const [title, topic, icon, skill] = header.split(" | ");
    const id = title.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const book = { id, title, topic, icon, skill, stage: stageIndex + 1, pages: [], questions: [] };
    for (const line of lines.filter(Boolean)) {
      const meta = /^(about|words|cover|read): (.+)$/.exec(line);
      if (meta) {
        book[meta[1]] = meta[1] === "words" ? meta[2].split(", ") : meta[2];
      } else if (line.startsWith("? ")) {
        const [question, answer, page] = line.slice(2).split(" | ");
        book.questions.push({ question, answer, page: Number(page) });
      } else {
        const [text, art] = line.split(" | ");
        book.pages.push({ text, art });
      }
    }
    if (!title || !topic || !icon || !skill || !book.about || !book.cover || !book.read || book.words?.length !== 5) {
      throw new Error(`${title}: missing book details.`);
    }
    if (book.pages.length !== targets[stageIndex] || book.pages.some(({ text, art }) => !text || !art)) {
      throw new Error(`${title}: missing story text or page art brief.`);
    }
    if (book.questions.length !== 3 || book.questions.some(({ question, answer, page }) =>
      !question || !answer || !Number.isInteger(page) || page < 1 || page > book.pages.length)) {
      throw new Error(`${title}: invalid discussion questions.`);
    }
    const choices = quizzes.get(title);
    if (choices?.length !== 3 || choices.some((row) => row.length !== 3 || new Set(row).size !== 3 || row.some((text) => !text))) {
      throw new Error(`${title}: quiz needs three unique choices per question.`);
    }
    book.quiz = book.questions.map((item, i) => {
      const answer = (books.length + i) % 3;
      const options = choices[i].slice(1);
      options.splice(answer, 0, choices[i][0]);
      return { prompt: item.question, options, answer, page: item.page };
    });
    const story = book.pages.map(({ text }) => text.toLowerCase()).join(" ");
    for (const word of book.words) {
      if (!new RegExp(`\\b${word.toLowerCase()}(?:s|es|ed|ing)?\\b`).test(story)) {
        throw new Error(`${title}: word "${word}" is not in the story.`);
      }
    }
    books.push(book);
  }
}
if (new Set(books.map(({ id }) => id)).size !== books.length) throw new Error("Duplicate book ID.");
if (quizzes.size !== books.length) throw new Error("Quiz titles do not match the book list.");
export { books };

export function writePreview(bookData, outputName, review = null) {
  const template = readFileSync(new URL("preview-template.html", directory), "utf8");
  const payload = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  if (!template.includes("/* BOOK_DATA */") || !template.includes("/* REVIEW_DATA */ null")) {
    throw new Error("Missing preview data marker.");
  }
  const output = new URL(`../public/previews/${outputName}`, import.meta.url);
  writeFileSync(output, template
    .replace("/* BOOK_DATA */", () => payload(bookData))
    .replace("/* REVIEW_DATA */ null", () => payload(review)));
  console.log(`Built ${bookData.length} books and ${bookData.reduce((sum, book) => sum + book.pages.length, 0)} pages at ${fileURLToPath(output)}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writePreview(books, "english-grade2-books.html");
}
