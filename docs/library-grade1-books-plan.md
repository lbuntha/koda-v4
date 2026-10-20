# Grade 1 Library books: plan for 12

Audience: Band A, ages 5–7, English first. Each book is 10–14 short pages, one refrain, one real fact.
Goal: a reading habit. Short enough to finish in one sitting, ends on a small question, characters come back.

## The loop for every book (do these in order)

1. **Brief**: confirm title, fact, refrain, 5 picture words, 5 spelling words (table below).
2. **Story**: write 12–16 short sentences. Grade 1 rules: 4–8 words a sentence, one idea a page, the refrain at least 3 times, no word the child can't sound out unless it has a picture.
3. **Title check**: search Google Books and Amazon for the exact title. Rename if it clashes.
4. **Questions**: 5 comprehension (each with an evidence sentence), 4–5 picture words, 5 spelling words.
5. **JSON**: `src/library/data/passages/starter-<slug>.json`, `provenance: "Original story written for Koda, 2026"`, `band: "A"`, `ages: [5,7]`, topics from `src/lib/topics.ts`.
6. **Register** in `starterPassages.ts` and run the scoped vitest (`starterPassages`, `verifyPassage`).
7. **Pictures**: use only picture keys the library has; list any missing ones and draw them before publishing.
8. **Read it in the app** at 390px: page turns, text size, quiz. Fix, then commit locally.

A book is done when step 8 passes. Start the next one only then.

## Order and briefs

Order is easiest first, then books that match a lesson the child may be doing.

| # | Slug | Title | Topic | Fact learned | Refrain | Status |
|---|------|-------|-------|--------------|---------|--------|
| 1 | bot-and-the-seed | Bot and the Seed | nature | A plant grows from a seed, and it needs time; a helper can be unsure; draw new things | "Not yet," said Mia. | Draft in Library Studio |
| 2 | sleepy-night-animals | Sleepy Night Animals | animals | Some animals wake when we sleep | a different night sound each page | |
| 3 | water-goes-round | Water Goes Round | nature | The water cycle, told by one drop | "And round it goes!" | |
| 4 | the-bus-that-said-please | The Bus That Said Please | feelings, school | Please, thank you, sorry | "Please," said the bus. | |
| 5 | zero-hero | The Zero Hero | numbers | Zero means none; it holds a place | counting up, page by page | |
| 6 | tick-tock-tiger | Tick-Tock Tiger | time | Morning, noon, night; o'clock | "Tick-tock, what time is it?" | |
| 7 | kiri-shape-robot | Kiri's Shape Robot | shapes, drawing | Circle, square, triangle build things | "What shape is this?" | |
| 8 | pocket-money-market | Pocket Money Market | money | Save, spend, share | the coin count each page | |
| 9 | fix-it-mimi | Fix It, Mimi! | logic | Steps in order; trying again | "Try again!" | |
| 10 | why-is-the-sky-blue | Why Is the Sky Blue? | nature | Sunlight, sky, sunset colours | a question on each page | |
| 11 | bedtime-for-the-tablet | Mia's Tablet Has a Bedtime | health | Screens, sleep, play outside | "Stop. Go play." | |
| 12 | my-cambodia-abc | My Cambodia ABC | culture, letters | Food, places, festivals A to Z | one letter a page | |

Book 12 is the largest (26 pages). Split it into two books of 13 if it gets too long for one sitting.

### Per-book pick lists (fill in before step 2)

Each book needs: 5 picture words, 5 spelling words, 1 closing question. Book 1 is filled in as the model.

| # | Picture words | Spelling words | Closing question |
|---|---------------|----------------|------------------|
| 1 | seed, sun, leaf, flower | seed, plant, sun, leaf, wait | What will you plant? |
| 2 to 12 | decide at step 1 | decide at step 1 | one small question to take away |

## The AI thread (learn it, then make with it)

Children now grow up with AI helpers, so each book carries one small, true idea, in kid words. Half the books are about **using AI to make things**, not only knowing about it.

| Idea (kid words) | Where it lives |
|---|---|
| A helper can learn, but it doesn't know everything: watch and check | 1 Bot and the Seed (the screen says "I am not sure. Watch it!") |
| Ask good questions to get good answers | 10 Why Is the Sky Blue? |
| Robots follow steps; people make the steps | 9 Fix It, Mimi! |
| Make a picture with a helper, then change it your way | 7 Kiri's Shape Robot (Bot draws with shapes, Kiri adds her own) |
| Make a song or story together with a helper, and say what's yours | new idea for a 13th book: Mia and Bot Make a Song |
| Be kind and safe with screens and helpers | 11 Mia's Tablet Has a Bedtime |

Rules: no real product names, no scary AI, the child is always the one who decides, and the helper is wrong or unsure at least once so children learn to check.

## Series rules (keep the habit going)

- **Recurring cast**: Bot (a little robot) and Mia appear in books 1, 3, 5, 9 and 11. Other books have their own characters. Change this if you decide otherwise.
- **No famous characters**, no copied illustrations, no title that matches a known book.
- **Same refrain style across books** so a child recognises the pattern.
- **Shelf order**: books 1 to 4 are "start here". Unlock later books after the child finishes two, so there is always a next one.
- **Parent summary**: each finished book reports the fact learned (one line) so parents hear progress.

## Open decisions

1. Bot and Mia across the series, or a fresh cast each time?
2. Khmer versions: after all 12 English books, or one at a time? A native speaker must read each before it ships.
3. Pictures: draw by hand, or use the existing image generation API in the Library?
