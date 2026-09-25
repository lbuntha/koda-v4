import type { Band, Language } from "./passage";

/** Optional reading vocabulary used by the Studio's advisory rule 4 check. */
const BAND_A = new Set(
  "a about after again afraid all am an and animal answer are around as ask at away back banana be because bed been before big bird black blue boat boy but by came can car cat children close come could day did do dog does down eat eight every find first five for four from fun get girl give go good got had happened has have he help her here high higher him his home how i if in into is it its jump jumped just keep know last laugh let like little live look made make man many may me more most mother much my new next night no not now of off old on one only open or other our out over picture place play please puddle put ran read red right run said saw say school see she should show six small so some start stay still stop take tell ten than that the their them then there these they thing think this three time to too try two under up us very walk want was water way we well went were what when where which white who why will with wolf word work would yellow you your".split(" "),
);

const BAND_B = new Set([
  ...BAND_A,
  ..."able across almost along another answer asked become began better between build change close cold country different door early enough even face family fast father field follow found friends game great green grow hard heard high learn letter light long mean might move near never next once place part people picture question really remember room round same second sentence story strong sure together through turn until warm while whole without young".split(" "),
]);

export const readingLexiconFor = (band: Band, language: Language): ReadonlySet<string> | undefined => {
  if (language !== "en") return undefined;
  return band === "B" ? BAND_B : BAND_A;
};

export const readingWordsFor = (band: Band, language: Language): string[] =>
  [...(readingLexiconFor(band, language) ?? [])].sort();
