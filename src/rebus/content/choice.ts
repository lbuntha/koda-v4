import type { AgeRange } from "../../lib/ages";
import { choiceAnswer, type ChoiceSpec } from "../choice";
import type { Difficulty, Piece, Puzzle } from "../types";

/**
 * A few multiple-choice questions to try the new kind with: English and Khmer,
 * some with a picture, one about math. They are ordinary seed drafts, so they wait
 * in the Studio like any other (approve and publish them to play them), and the
 * owner can edit, retire or reject them. The right answer is marked by its position
 * here and shuffled for each child when they play.
 */

interface Spec {
  key: string;
  category: string;
  ages: AgeRange;
  difficulty: Difficulty;
  /** The question, and optionally a drawing beside it. */
  question: string;
  picture?: { drawing: string; name: string };
  options: string[];
  correct: number;
  why: string;
  /** The same question in Khmer: the words, the answers in the same order, and the explanation. */
  km: { question: string; options: string[]; why: string };
}

const make = ({ key, category, ages, difficulty, question, picture, options, correct, why, km }: Spec): Puzzle => {
  const choice: ChoiceSpec = { options, correct };
  const drawing: Piece[] = picture ? [{ kind: "icon", id: `rebus-${picture.drawing}`, name: picture.name }] : [];
  const pieces: Piece[] = [{ kind: "word", text: question }, ...drawing];
  return {
    id: `choice-${key}`,
    category,
    ages,
    difficulty,
    trick: "compound",
    kind: "choice",
    choice,
    pieces,
    answer: choiceAnswer(choice),
    accepts: [],
    explanation: why,
    km: { pieces: [{ kind: "word", text: km.question }, ...drawing], options: km.options, explanation: km.why },
    source: "official",
  };
};

export const CHOICE: Puzzle[] = [
  make({ key: "capital-france", category: "countries", ages: [7, 12], difficulty: 1, question: "What is the capital of France?", options: ["Paris", "Rome", "Madrid", "Berlin"], correct: 0, why: "Paris is the capital of France.", km: { question: "រាជធានីនៃប្រទេសបារាំងគឺអ្វី?", options: ["ប៉ារីស", "រ៉ូម", "ម៉ាឌ្រីដ", "បែរឡាំង"], why: "ប៉ារីសជារាជធានីនៃប្រទេសបារាំង។" } }),
  make({ key: "boot-country", category: "countries", ages: [8, 13], difficulty: 2, question: "Which country is shaped like a boot?", options: ["Italy", "Spain", "Japan", "Egypt"], correct: 0, why: "Italy looks like a boot on the map.", km: { question: "ប្រទេសមួយណាមានរាងដូចស្បែកជើងកវែង?", options: ["អ៊ីតាលី", "អេស្ប៉ាញ", "ជប៉ុន", "អេហ្ស៊ីប"], why: "អ៊ីតាលីមើលទៅដូចស្បែកជើងកវែងនៅលើផែនទី។" } }),
  make({ key: "capital-cambodia", category: "countries", ages: [6, 12], difficulty: 1, question: "What is the capital of Cambodia?", options: ["Phnom Penh", "Siem Reap", "Battambang", "Kampot"], correct: 0, why: "Phnom Penh is the capital of Cambodia.", km: { question: "រាជធានីនៃប្រទេសកម្ពុជាគឺអ្វី?", options: ["ភ្នំពេញ", "សៀមរាប", "បាត់ដំបង", "កំពត"], why: "ភ្នំពេញជារាជធានីនៃប្រទេសកម្ពុជា។" } }),
  make({ key: "which-animal-moo", category: "animals", ages: [5, 9], difficulty: 1, question: "Which animal says moo?", options: ["Cow", "Duck", "Cat", "Sheep"], correct: 0, why: "A cow says moo.", km: { question: "សត្វអ្វីស្រែកម៉ូ?", options: ["គោ", "ទា", "ឆ្មា", "ចៀម"], why: "គោស្រែកម៉ូ។" } }),
  make({ key: "animal-picture", category: "animals", ages: [5, 8], difficulty: 1, question: "Which animal is this?", picture: { drawing: "cat", name: "animal" }, options: ["Cat", "Dog", "Fish", "Horse"], correct: 0, why: "The picture shows a cat.", km: { question: "នេះជាសត្វអ្វី?", options: ["ឆ្មា", "ឆ្កែ", "ត្រី", "សេះ"], why: "រូបនេះជាឆ្មា។" } }),
  make({ key: "which-is-a-bird", category: "animals", ages: [6, 10], difficulty: 1, question: "Which of these is a bird?", options: ["Eagle", "Shark", "Frog", "Horse"], correct: 0, why: "An eagle is a bird. It has feathers and wings.", km: { question: "តើមួយណាជាបក្សី?", options: ["ឥន្ទ្រី", "ត្រីឆ្លាម", "កង្កែប", "សេះ"], why: "ឥន្ទ្រីជាបក្សី។ វាមានស្លាប និងរោមស្លាប។" } }),
  make({ key: "what-is-this-sun", category: "science", ages: [5, 8], difficulty: 1, question: "What is this?", picture: { drawing: "sun", name: "picture" }, options: ["The sun", "The moon", "A star", "A cloud"], correct: 0, why: "The picture shows the sun.", km: { question: "នេះជាអ្វី?", options: ["ព្រះអាទិត្យ", "ព្រះច័ន្ទ", "ផ្កាយ", "ពពក"], why: "រូបនេះជាព្រះអាទិត្យ។" } }),
  make({ key: "plant-food", category: "science", ages: [8, 13], difficulty: 2, question: "Which one helps a plant make its food?", options: ["Sunlight", "Plastic", "Sand", "Metal"], correct: 0, why: "A plant uses sunlight, water and air to make its food.", km: { question: "តើអ្វីជួយឲ្យរុក្ខជាតិផលិតអាហាររបស់វា?", options: ["ពន្លឺព្រះអាទិត្យ", "ផ្លាស្ទិក", "ខ្សាច់", "លោហៈ"], why: "រុក្ខជាតិប្រើពន្លឺព្រះអាទិត្យ ទឹក និងខ្យល់ ដើម្បីផលិតអាហាររបស់វា។" } }),
  make({ key: "spider-legs", category: "science", ages: [7, 12], difficulty: 2, question: "How many legs does a spider have?", options: ["6", "8", "10", "4"], correct: 1, why: "A spider has 8 legs.", km: { question: "ពីងពាងមានជើងប៉ុន្មាន?", options: ["6", "8", "10", "4"], why: "ពីងពាងមាន 8 ជើង។" } }),
  make({ key: "which-vegetable", category: "food", ages: [5, 9], difficulty: 1, question: "Which one is a vegetable?", options: ["Carrot", "Apple", "Banana", "Mango"], correct: 0, why: "A carrot is a vegetable. The others are fruit.", km: { question: "មួយណាជាបន្លែ?", options: ["ការ៉ុត", "ប៉ោម", "ចេក", "ស្វាយ"], why: "ការ៉ុតជាបន្លែ។ ផ្សេងទៀតជាផ្លែឈើ។" } }),
  make({ key: "days-in-week", category: "school", ages: [6, 10], difficulty: 1, question: "How many days are in a week?", options: ["5", "7", "10", "12"], correct: 1, why: "A week has 7 days.", km: { question: "មួយសប្តាហ៍មានប៉ុន្មានថ្ងៃ?", options: ["5", "7", "10", "12"], why: "មួយសប្តាហ៍មាន 7 ថ្ងៃ។" } }),
  make({ key: "piece-of-cake", category: "sayings", ages: [10, 14], difficulty: 3, question: "What does \"a piece of cake\" mean?", options: ["Very easy", "Very sweet", "A birthday", "A small gift"], correct: 0, why: "If something is a piece of cake, it is very easy to do.", km: { question: "តើ \"a piece of cake\" មានន័យថាអ្វី?", options: ["ងាយស្រួលណាស់", "ផ្អែមណាស់", "ខួបកំណើត", "អំណោយតូចមួយ"], why: "បើអ្វីមួយជា \"a piece of cake\" មានន័យថាធ្វើបានយ៉ាងងាយ។" } }),
  make({ key: "leaf-colour", category: "science", ages: [5, 9], difficulty: 1, question: "What colour are most leaves?", options: ["Green", "Red", "Black", "White"], correct: 0, why: "Most leaves are green.", km: { question: "ស្លឹកឈើភាគច្រើនមានពណ៌អ្វី?", options: ["បៃតង", "ក្រហម", "ខ្មៅ", "ស"], why: "ស្លឹកឈើភាគច្រើនមានពណ៌បៃតង។" } }),
  make({ key: "eggs-two-boxes", category: "math", ages: [7, 10], difficulty: 2, question: "A box has 12 eggs. How many eggs are in 2 boxes?", options: ["14", "24", "122", "20"], correct: 1, why: "12 + 12 = 24.", km: { question: "ប្រអប់មួយមានពងមាន់ 12។ ប្រអប់ 2 មានពងមាន់ប៉ុន្មាន?", options: ["14", "24", "122", "20"], why: "12 + 12 = 24។" } }),
];
