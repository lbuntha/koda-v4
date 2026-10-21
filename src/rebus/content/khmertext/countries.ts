import type { KhmerText } from "./index";

/**
 * Countries, in Khmer. The puzzle itself is English wordplay, so only the "why" is
 * translated; a child may also type the country's Khmer name. A Khmer reader checks
 * these in the Studio, where each card shows its Khmer version.
 */
export const COUNTRIES_KM: Record<string, KhmerText> = {
  "countries-iceland": { explanation: "“ice” + “land” = Iceland។ នេះជាប្រទេសអ៊ីស្លង់។", accepts: ["អ៊ីស្លង់", "ប្រទេសអ៊ីស្លង់"] },
  "countries-greenland": { explanation: "“green” + “land” = Greenland។ នេះជាប្រទេសហ្គ្រីនឡង់។", accepts: ["ហ្គ្រីនឡង់", "ប្រទេសហ្គ្រីនឡង់"] },
  "countries-finland": { explanation: "“fin” + “land” = Finland។ នេះជាប្រទេសហ្វាំងឡង់។", accepts: ["ហ្វាំងឡង់", "ប្រទេសហ្វាំងឡង់"] },
  "countries-poland": { explanation: "“pole” + “land” = Poland។ នេះជាប្រទេសប៉ូឡូញ។", accepts: ["ប៉ូឡូញ", "ប្រទេសប៉ូឡូញ"] },
  "countries-norway": { explanation: "“no” + “way” = Norway។ នេះជាប្រទេសន័រវែស។", accepts: ["ន័រវែស", "ប្រទេសន័រវែស"] },
  "countries-spain": { explanation: "“S” + “pain” = Spain។ នេះជាប្រទេសអេស្ប៉ាញ។", accepts: ["អេស្ប៉ាញ", "ប្រទេសអេស្ប៉ាញ"] },
  "countries-thailand": { explanation: "“tie” + “land” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Thailand។ នេះជាប្រទេសថៃ។", accepts: ["ថៃ", "ប្រទេសថៃ"] },
  "countries-holland": { explanation: "“hole” + “land” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Holland។ នេះជាប្រទេសហូឡង់។", accepts: ["ហូឡង់", "ប្រទេសហូឡង់"] },
  "countries-germany": { explanation: "“germ” + “money” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Germany។ នេះជាប្រទេសអាល្លឺម៉ង់។", accepts: ["អាល្លឺម៉ង់", "ប្រទេសអាល្លឺម៉ង់"] },
  "countries-japan": { explanation: "“jam” + “pan” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Japan។ នេះជាប្រទេសជប៉ុន។", accepts: ["ជប៉ុន", "ប្រទេសជប៉ុន"] },
  "countries-cuba": { explanation: "“cube” + “a” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Cuba។ នេះជាប្រទេសគុយបា។", accepts: ["គុយបា", "ប្រទេសគុយបា"] },
  "countries-ireland": { explanation: "“eye” + “land” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Ireland។ នេះជាប្រទេសអៀរឡង់។", accepts: ["អៀរឡង់", "ប្រទេសអៀរឡង់"] },
  "countries-haiti": { explanation: "“hay” + “tea” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Haiti។ នេះជាប្រទេសហៃទី។", accepts: ["ហៃទី", "ប្រទេសហៃទី"] },
  "countries-congo": { explanation: "“cone” + “go” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Congo។ នេះជាប្រទេសកុងហ្គោ។", accepts: ["កុងហ្គោ", "ប្រទេសកុងហ្គោ"] },
  "countries-oman": { explanation: "“o” + “man” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Oman។ នេះជាប្រទេសអូម៉ង់។", accepts: ["អូម៉ង់", "ប្រទេសអូម៉ង់"] },
  "countries-iran": { explanation: "“i” + “ran” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Iran។ នេះជាប្រទេសអ៊ីរ៉ង់។", accepts: ["អ៊ីរ៉ង់", "ប្រទេសអ៊ីរ៉ង់"] },
  "countries-togo": { explanation: "“toe” + “go” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Togo។ នេះជាប្រទេសតូហ្គោ។", accepts: ["តូហ្គោ", "ប្រទេសតូហ្គោ"] },
  "countries-panama": { explanation: "“pan” + “ama” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Panama។ នេះជាប្រទេសប៉ាណាម៉ា។", accepts: ["ប៉ាណាម៉ា", "ប្រទេសប៉ាណាម៉ា"] },
  "countries-bhutan": { explanation: "“boot” + “tan” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Bhutan។ នេះជាប្រទេសប៊ូតង់។", accepts: ["ប៊ូតង់", "ប្រទេសប៊ូតង់"] },
  "countries-italy": { explanation: "“eye” + “tally” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Italy។ នេះជាប្រទេសអ៊ីតាលី។", accepts: ["អ៊ីតាលី", "ប្រទេសអ៊ីតាលី"] },
  "countries-china": { explanation: "“chain” + “a” ប្រកាសលឿនៗ ស្តាប់ទៅដូច China។ នេះជាប្រទេសចិន។", accepts: ["ចិន", "ប្រទេសចិន"] },
  "countries-tibet": { explanation: "“tea” + “bet” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Tibet។ នេះជាទីបេ។", accepts: ["ទីបេ", "ទីបេ"] },
  "countries-turkey": { explanation: "Turkey ជាបក្សីមួយប្រភេទ ហើយក៏ជាឈ្មោះប្រទេសតួកគីដែរ។", accepts: ["តួកគី", "ប្រទេសតួកគី"] },
  "countries-wales": { explanation: "“whales” (ត្រីបាឡែន) ស្តាប់ទៅដូច Wales។ នេះជាប្រទេសវែល។", accepts: ["វែល", "ប្រទេសវែល"] },
  "countries-chile": { explanation: "“chili” (ម្ទេស) ស្តាប់ទៅដូច Chile។ នេះជាប្រទេសឈីលី។", accepts: ["ឈីលី", "ប្រទេសឈីលី"] },
  "countries-cambodia": { explanation: "“cam” + “bow” + “dia” ប្រកាសលឿនៗ ស្តាប់ទៅដូច Cambodia។ នេះជាប្រទេសកម្ពុជា។", accepts: ["កម្ពុជា", "ប្រទេសកម្ពុជា"] },
};
