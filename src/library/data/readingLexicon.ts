import type { AgeRange } from "../../lib/ages";
import type { Band, Language } from "./passage";

/** Optional reading vocabulary used by the Studio's advisory rule 4 check. */
const BAND_A = new Set(
  "a about after again afraid all am an and animal answer are around as ask at away back banana be because bed been before big bird black blue boat boy but by came can car cat children close come could day did do dog does down eat eight every find first five for four from fun get girl give go good got had happened has have he help her here high higher him his home how i if in into is it its jump jumped just keep know last laugh let like little live look made make man many may me more most mother much my new next night no not now of off old on one only open or other our out over picture place play please puddle put ran read red right run said saw say school see she should show six small so some start stay still stop take tell ten than that the their them then there these they thing think this three time to too try two under up us very walk want was water way we well went were what when where which white who why will with wolf word work would yellow you your".split(" "),
);

const BAND_B = new Set([
  ...BAND_A,
  ..."able across almost along another answer asked become began better between build change close cold country different door early enough even face family fast father field follow found friends game great green grow hard heard high learn letter light long mean might move near never next once place part people picture question really remember room round same second sentence story strong sure together through turn until warm while whole without young".split(" "),
]);

/**
 * The sight words a Grade 2 reader (age 7–8) knows: the Dolch lists through
 * Grade 3, the Dolch nouns and Fry's first 300, with their everyday endings.
 * Grade 1 books keep the short list above; this opens up once a book is for
 * children of 8 or over, which is where Grade 2 questions are written.
 */
const GRADE_2_BASE = (
  "after again always any around ask ate away be because been before best better big black blue both bring brown buy by call came carry clean cold come could cut did do does done down draw drink eat eight every fall far fast find first five fly for found four from full funny gave get give go goes going good got green grow had has have help her here him his hold hot how hurt if into its jump just keep kind know laugh let light like little live long look made make many may me much must my myself never new no not now of off old on once one only open or our out over own pick play please pretty pull put ran read red ride right round run said saw say see seven shall she show sing sit six sleep small so some soon start stop take tell ten thank that the their them then there these they think this those three to today together too try two under up upon us use very walk want warm was wash we well went were what when where which white who why will wish with work would write yellow yes you your " +
  // Dolch nouns
  "apple baby back ball bear bed bell bird birthday boat box boy bread brother cake car cat chair chicken children coat corn cow day dog doll door duck egg eye farm farmer father feet fire fish floor flower game garden girl goodbye grass ground hand head hill home horse house kitty leg letter man men milk money morning mother name nest night paper party picture pig rabbit rain ring robin school seed sheep shoe sister snow song squirrel stick street sun table thing time top toy tree watch water way wind window wood " +
  // Fry's first 300 not already above
  "above add air almost along also animal another answer air began begin being below between book boy change city close country different earth end enough even example eye face family few follow food form great group hard head hear high idea important land large last later learn leave left life line list mean might mile miss mountain move near need next number often page part people place plant point river same sea second seem sentence set side something sometimes sound spell state still story study such talk than thought through turn until while without word world year young " +
  // Everyday words a story about home, school and feelings asks with
  "angry bad bottom bug colour color draw end excited feel fix happen happy idea inside outside person problem real sad scared shop sleepy tired wrong " +
  "arm bake beach behind bike bite broke broken bucket cannot choose cloud cool count cover cry dark deep dig drive eleven empty fact float flow free glue herself hide himself hour hundred ice itself leaf lid low nothing oil oven pencil plan pool pot question race rope sand sell share shine short shout sink soil spot stand string sugar swim tail tape teacher tool trip twelve wait wing " +
  "alone bend block blow cost danger east hit hole hungry instead less loud mistake north ocean offer paint piece south spoon thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty west yet"
).split(" ").filter(Boolean);
/** Past tenses that do not just add -ed. */
const IRREGULAR = "bent blew eaten bought brought built caught fell felt flew forgot found grew heard held hid kept knew left lost meant met paid sang sat slept sold spent stood taught thought told took understood woke won wore wrote".split(" ");
/** The pieces a word with an apostrophe splits into: didn't → didn, t. */
const CONTRACTIONS = "didn doesn don isn wasn weren hadn couldn wouldn shouldn won aren t s ll re ve d m".split(" ");
const inflect = (w: string): string[] => {
  const stem = w.endsWith("e") ? w.slice(0, -1) : w;
  const forms = [w, `${w}s`, `${w}es`, `${stem}ed`, `${stem}ing`, `${w}er`, `${stem}er`, `${w}est`, `${stem}est`, `${w}ly`];
  // big → bigger, swim → swimming; cry → cried, happy → happier.
  if (/[^aeiou][aeiou][bdgmnpt]$/.test(w)) forms.push(...["er", "est", "ed", "ing"].map((end) => w + w.slice(-1) + end));
  if (/[^aeiou]y$/.test(w)) forms.push(...["ied", "ies", "ier", "iest", "ily"].map((end) => w.slice(0, -1) + end));
  return forms;
};
const GRADE_2 = new Set([...BAND_B, ...GRADE_2_BASE.flatMap(inflect), ...IRREGULAR, ...CONTRACTIONS]);

/**
 * The reading list for a book. Level A is Grade 1 unless the book's own ages
 * reach 8, which makes it a Grade 2 book; Level B and above read at least that.
 */
export const readingLexiconFor = (band: Band, language: Language, ages?: AgeRange): ReadonlySet<string> | undefined => {
  if (language !== "en") return undefined;
  if (band !== "A" || (ages && ages[1] >= 8)) return GRADE_2;
  return BAND_A;
};

export const readingWordsFor = (band: Band, language: Language, ages?: AgeRange): string[] =>
  [...(readingLexiconFor(band, language, ages) ?? [])].sort();
