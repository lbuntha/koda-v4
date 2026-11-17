/**
 * The words of Koda's Privacy Policy and Terms, in each language the app speaks.
 *
 * Kept here rather than in the i18n catalogs: this is a document, not a set of
 * labels — paragraphs that are read and reviewed as a whole, and changed
 * together when the app changes what it keeps. A language without its own copy
 * reads the English one.
 *
 * Everything said here has to be true of the code. When Koda starts keeping
 * something new, or sends it somewhere new, this is the file to change — and
 * `UPDATED` with it.
 */

export type LegalKind = "privacy" | "terms";

export interface LegalSection {
  heading: string;
  /** Paragraphs; a line starting with "• " is drawn as a bullet. */
  body: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export const CONTACT_EMAIL = "support@learnwithkoda.tech";
/** The day this text last changed, ISO. Shown on the page. */
export const UPDATED = "2026-11-17";

const en: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    intro:
      "Koda is a learning app for children, and parents trust us with their family's information. This page says, in plain words, what Koda keeps, why, who else sees it, and how you can have it removed. \"We\" means Koda; \"you\" means the parent or guardian who made the account.",
    sections: [
      {
        heading: "What we keep",
        body: [
          "• Your account: your name, your email address and your password (stored scrambled, never readable). If you sign in with Google, we receive your name and email from Google — never your Google password.",
          "• Your child's profile: the name or nickname you type, the year they were born (if you give it), and the cartoon avatar they pick. We do not ask for a child's email, phone number, school or address.",
          "• Learning progress: which lessons and books your child opens, their answers, scores, stars, points and streaks, and how long they play. This is what makes the parent report.",
          "• Voice messages: when your child records themself reading and presses send, the recording is kept so you can listen. You can delete any recording.",
          "• Photos for colouring pages: if your family uses \"picture from a photo\", the photo you choose is sent to make one colouring page.",
          "• Devices: a name for each phone or tablet signed in to your family, so you can see and remove them, and — if you allow notifications — a notification address for that device.",
        ],
      },
      {
        heading: "Why we keep it",
        body: [
          "Only to run Koda for your family: to sign you in, to save progress so it follows your child between devices, to show you what they learned, to send the emails and notifications you asked for, and to keep the app safe and working.",
          "We do not sell your information. We do not show advertising. We do not use your child's information to build advertising profiles.",
        ],
      },
      {
        heading: "Who else handles it",
        body: [
          "A few companies do part of the work for us, and only see what that work needs:",
          "• Our server and email providers, who store Koda's data and deliver our emails.",
          "• Google: \"Sign in with Google\" (if you choose it), Firebase Cloud Messaging to deliver notifications to your device, and Google Gemini to turn a chosen photo into a colouring page.",
          "Nobody else receives your family's information, unless the law requires us to share it.",
        ],
      },
      {
        heading: "What other people can see",
        body: [
          "Your child's learning is private to your family. Leaderboards and learning buddies are off until a parent turns sharing on; then other learners see only the nickname you choose and the avatar, never a real name or email.",
          "In a group puzzle game, the other players in the same room see each player's nickname and score.",
        ],
      },
      {
        heading: "On your device",
        body: [
          "So Koda works with weak or no internet, lessons, books and your child's recent progress are also saved on the phone or tablet. Signing out of Koda on a device removes the family's session from it.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "We keep your family's information while your account is open. When you delete a child's profile or a voice message, it is removed. When you ask us to close your account, we delete your family's information within 30 days, except what the law makes us keep.",
        ],
      },
      {
        heading: "Your choices",
        body: [
          "• See your child's progress at any time in the parent report.",
          "• Delete a child's profile, a voice message or a device from the app.",
          "• Turn notifications and leaderboard sharing on or off.",
          "• Ask us for a copy of your family's information, to correct it, or to delete your whole account, by emailing us at the address below.",
        ],
      },
      {
        heading: "Children",
        body: [
          "Koda is made for children, but accounts are made by parents and guardians. A child uses Koda inside their parent's family account, with the settings the parent chooses — including screen-time limits and play hours. If you believe a child has given us information without a parent, write to us and we will delete it.",
        ],
      },
      {
        heading: "Keeping it safe",
        body: [
          "Koda is reached only over an encrypted connection (https), passwords are never stored in readable form, and only the people who run Koda can reach its servers.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "If we change what we keep or who sees it, we will update this page and its date. If the change is important, we will also tell you in the app or by email.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    intro:
      "These terms are the simple rules for using Koda. By making an account or using Koda, you agree to them. \"We\" means Koda; \"you\" means the parent or guardian who made the account.",
    sections: [
      {
        heading: "Who can make an account",
        body: [
          "Accounts are made by adults — parents, guardians or teachers — who are responsible for the children who learn on them. Children use Koda inside that account.",
        ],
      },
      {
        heading: "Your account",
        body: [
          "Keep your password and family PIN to yourself, and tell us if you think someone else is using your account. You are responsible for what happens in your family's account.",
        ],
      },
      {
        heading: "Using Koda well",
        body: [
          "Please don't misuse Koda: don't try to break into it or slow it down, don't copy its lessons or books to publish elsewhere, and don't use it to bully or upset anyone, including in group games.",
        ],
      },
      {
        heading: "What you add",
        body: [
          "Voice messages, photos and anything else you or your child add stay yours. You let us store and process them only to run Koda for your family, as the Privacy Policy explains.",
        ],
      },
      {
        heading: "Koda's lessons and books",
        body: [
          "Koda's lessons, books, pictures and sounds belong to Koda or to the people who made them, and are for your family's own learning.",
        ],
      },
      {
        heading: "Free and paid plans",
        body: [
          "Some of Koda is free. If a plan costs money, its price and what it includes are shown before you choose it, and nothing is charged without your agreement.",
        ],
      },
      {
        heading: "Changes and availability",
        body: [
          "We keep improving Koda, so lessons and features may change. We work to keep it running, but cannot promise it will never be unavailable or never have a mistake. Koda supports learning; it does not replace school or a teacher.",
        ],
      },
      {
        heading: "Closing an account",
        body: [
          "You can stop using Koda at any time and ask us to delete your account. We may close an account that breaks these terms, after telling you when we can.",
        ],
      },
      {
        heading: "Changes to these terms",
        body: [
          "If we change these terms, we will update this page and its date, and tell you in the app or by email if the change matters.",
        ],
      },
    ],
  },
};

const km: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: "គោលការណ៍ឯកជនភាព",
    intro:
      "Koda គឺជាកម្មវិធីសិក្សាសម្រាប់កុមារ ដែលពឹងលើការទុកចិត្តពីឪពុកម្ដាយ។ ទំព័រនេះពន្យល់ដោយពាក្យងាយៗថា Koda រក្សាទុកអ្វីខ្លះ ហេតុអ្វី អ្នកណាផ្សេងទៀតឃើញ និងរបៀបដែលអ្នកអាចស្នើឱ្យលុបវាចោល។ \"យើង\" មានន័យថា Koda ហើយ \"អ្នក\" មានន័យថា ឪពុកម្ដាយ ឬអាណាព្យាបាល ដែលបានបង្កើតគណនី។",
    sections: [
      {
        heading: "អ្វីដែលយើងរក្សាទុក",
        body: [
          "• គណនីរបស់អ្នក៖ ឈ្មោះ អាសយដ្ឋានអ៊ីមែល និងពាក្យសម្ងាត់របស់អ្នក (រក្សាទុកជាទម្រង់កូដ ដែលគ្មាននរណាអានបាន)។ បើអ្នកចូលតាម Google យើងទទួលបានឈ្មោះ និងអ៊ីមែលរបស់អ្នកពី Google ប៉ុន្តែមិនដែលទទួលពាក្យសម្ងាត់ Google របស់អ្នកទេ។",
          "• ប្រវត្តិរូបកូនរបស់អ្នក៖ ឈ្មោះ ឬឈ្មោះហៅក្រៅដែលអ្នកវាយបញ្ចូល ឆ្នាំកំណើត (បើអ្នកផ្ដល់ឱ្យ) និងរូបតុក្កតាដែលកូនជ្រើសរើស។ យើងមិនសួររកអ៊ីមែល លេខទូរស័ព្ទ សាលារៀន ឬអាសយដ្ឋានរបស់កុមារទេ។",
          "• វឌ្ឍនភាពសិក្សា៖ មេរៀន និងសៀវភៅដែលកូនបើក ចម្លើយ ពិន្ទុ ផ្កាយ និងរយៈពេលលេង។ ទាំងនេះជាអ្វីដែលបង្កើតរបាយការណ៍សម្រាប់ឪពុកម្ដាយ។",
          "• សារសំឡេង៖ ពេលកូនថតសំឡេងខ្លួនឯងអាន ហើយចុចផ្ញើ យើងរក្សាការថតនោះទុក ដើម្បីឱ្យអ្នកស្ដាប់បាន។ អ្នកអាចលុបការថតណាមួយក៏បាន។",
          "• រូបថតសម្រាប់ទំព័រគូរពណ៌៖ បើគ្រួសារអ្នកប្រើមុខងារ \"រូបភាពពីរូបថត\" រូបថតដែលអ្នកជ្រើសរើសត្រូវបានផ្ញើទៅ ដើម្បីបង្កើតទំព័រគូរពណ៌មួយ។",
          "• ឧបករណ៍៖ ឈ្មោះទូរស័ព្ទ ឬថេប្លេតនីមួយៗដែលចូលក្នុងគ្រួសារអ្នក ដើម្បីឱ្យអ្នកមើល និងដកវាចេញបាន ហើយ — បើអ្នកអនុញ្ញាតការជូនដំណឹង — អាសយដ្ឋានជូនដំណឹងសម្រាប់ឧបករណ៍នោះ។",
        ],
      },
      {
        heading: "ហេតុអ្វីយើងរក្សាទុក",
        body: [
          "គ្រាន់តែដើម្បីដំណើរការ Koda សម្រាប់គ្រួសារអ្នក៖ ដើម្បីឱ្យអ្នកចូលបាន រក្សាវឌ្ឍនភាពឱ្យតាមកូនពីឧបករណ៍មួយទៅមួយ បង្ហាញអ្នកពីអ្វីដែលកូនបានរៀន ផ្ញើអ៊ីមែល និងការជូនដំណឹងដែលអ្នកបានស្នើ និងរក្សាកម្មវិធីឱ្យមានសុវត្ថិភាព និងដំណើរការល្អ។",
          "យើងមិនលក់ព័ត៌មានរបស់អ្នកទេ។ យើងមិនបង្ហាញការផ្សាយពាណិជ្ជកម្មទេ។ យើងមិនប្រើព័ត៌មានកូនរបស់អ្នក ដើម្បីការផ្សាយពាណិជ្ជកម្មទេ។",
        ],
      },
      {
        heading: "អ្នកណាផ្សេងទៀតដែលដោះស្រាយវា",
        body: [
          "ក្រុមហ៊ុនមួយចំនួនធ្វើការងារមួយផ្នែកឱ្យយើង ហើយឃើញតែអ្វីដែលការងារនោះត្រូវការប៉ុណ្ណោះ៖",
          "• អ្នកផ្ដល់សេវាម៉ាស៊ីនមេ និងអ៊ីមែលរបស់យើង ដែលរក្សាទិន្នន័យ Koda និងបញ្ជូនអ៊ីមែលរបស់យើង។",
          "• Google៖ \"ចូលតាម Google\" (បើអ្នកជ្រើសរើស) Firebase Cloud Messaging ដើម្បីបញ្ជូនការជូនដំណឹងទៅឧបករណ៍អ្នក និង Google Gemini ដើម្បីប្ដូររូបថតដែលបានជ្រើសទៅជាទំព័រគូរពណ៌។",
          "គ្មាននរណាផ្សេងទៀតទទួលបានព័ត៌មានគ្រួសាររបស់អ្នកទេ លើកលែងតែច្បាប់តម្រូវឱ្យយើងចែករំលែក។",
        ],
      },
      {
        heading: "អ្វីដែលអ្នកដទៃអាចឃើញ",
        body: [
          "ការសិក្សារបស់កូនអ្នក ជារឿងឯកជនរបស់គ្រួសារអ្នក។ តារាងចំណាត់ថ្នាក់ និងមិត្តសិក្សា ត្រូវបានបិទ រហូតដល់ឪពុកម្ដាយបើកការចែករំលែក។ ពេលនោះ សិស្សផ្សេងទៀតឃើញតែឈ្មោះហៅក្រៅដែលអ្នកជ្រើសរើស និងរូបតុក្កតា មិនដែលឃើញឈ្មោះពិត ឬអ៊ីមែលទេ។",
          "ក្នុងល្បែងផ្គុំរូបជាក្រុម អ្នកលេងផ្សេងទៀតក្នុងបន្ទប់តែមួយ ឃើញឈ្មោះហៅក្រៅ និងពិន្ទុរបស់អ្នកលេងម្នាក់ៗ។",
        ],
      },
      {
        heading: "នៅលើឧបករណ៍របស់អ្នក",
        body: [
          "ដើម្បីឱ្យ Koda ដំណើរការបាន ទោះអ៊ីនធឺណិតខ្សោយ ឬគ្មាន មេរៀន សៀវភៅ និងវឌ្ឍនភាពថ្មីៗរបស់កូន ក៏ត្រូវបានរក្សាទុកនៅលើទូរស័ព្ទ ឬថេប្លេតផងដែរ។ ការចាកចេញពី Koda លើឧបករណ៍មួយ ដកគណនីគ្រួសារចេញពីឧបករណ៍នោះ។",
        ],
      },
      {
        heading: "យើងរក្សាទុកយូរប៉ុណ្ណា",
        body: [
          "យើងរក្សាព័ត៌មានគ្រួសាររបស់អ្នក ដរាបណាគណនីអ្នកនៅបើក។ ពេលអ្នកលុបប្រវត្តិរូបកូន ឬសារសំឡេង វាត្រូវបានលុបចោល។ ពេលអ្នកស្នើឱ្យយើងបិទគណនី យើងលុបព័ត៌មានគ្រួសាររបស់អ្នកក្នុងរយៈពេល ៣០ ថ្ងៃ លើកលែងតែអ្វីដែលច្បាប់តម្រូវឱ្យយើងរក្សាទុក។",
        ],
      },
      {
        heading: "ជម្រើសរបស់អ្នក",
        body: [
          "• មើលវឌ្ឍនភាពកូនរបស់អ្នក គ្រប់ពេល ក្នុងរបាយការណ៍ឪពុកម្ដាយ។",
          "• លុបប្រវត្តិរូបកូន សារសំឡេង ឬឧបករណ៍ ពីក្នុងកម្មវិធី។",
          "• បើក ឬបិទការជូនដំណឹង និងការចែករំលែកតារាងចំណាត់ថ្នាក់។",
          "• ស្នើសុំច្បាប់ចម្លងព័ត៌មានគ្រួសាររបស់អ្នក ដើម្បីកែតម្រូវ ឬលុបគណនីទាំងមូល ដោយផ្ញើអ៊ីមែលមកយើង តាមអាសយដ្ឋានខាងក្រោម។",
        ],
      },
      {
        heading: "កុមារ",
        body: [
          "Koda ត្រូវបានបង្កើតសម្រាប់កុមារ ប៉ុន្តែគណនីត្រូវបង្កើតដោយឪពុកម្ដាយ ឬអាណាព្យាបាល។ កុមារប្រើ Koda ក្នុងគណនីគ្រួសាររបស់ឪពុកម្ដាយ ជាមួយការកំណត់ដែលឪពុកម្ដាយជ្រើសរើស — រួមទាំងការកំណត់ពេលប្រើអេក្រង់ និងម៉ោងលេង។ បើអ្នកគិតថាកុមារបានផ្ដល់ព័ត៌មានមកយើង ដោយគ្មានឪពុកម្ដាយ សូមសរសេរមកយើង ហើយយើងនឹងលុបវាចោល។",
        ],
      },
      {
        heading: "ការរក្សាសុវត្ថិភាព",
        body: [
          "Koda ចូលប្រើបានតែតាមការតភ្ជាប់ដែលបានអ៊ិនគ្រីប (https) ពាក្យសម្ងាត់មិនដែលរក្សាទុកជាទម្រង់អានបានទេ ហើយមានតែអ្នកដែលដំណើរការ Koda ទេ ដែលអាចចូលដល់ម៉ាស៊ីនមេរបស់វា។",
        ],
      },
      {
        heading: "ការផ្លាស់ប្ដូរ",
        body: [
          "បើយើងផ្លាស់ប្ដូរអ្វីដែលយើងរក្សាទុក ឬអ្នកណាឃើញវា យើងនឹងធ្វើបច្ចុប្បន្នភាពទំព័រនេះ និងកាលបរិច្ឆេទរបស់វា។ បើការផ្លាស់ប្ដូរសំខាន់ យើងក៏នឹងប្រាប់អ្នកក្នុងកម្មវិធី ឬតាមអ៊ីមែលផងដែរ។",
        ],
      },
    ],
  },
  terms: {
    title: "លក្ខខណ្ឌប្រើប្រាស់",
    intro:
      "លក្ខខណ្ឌទាំងនេះ ជាច្បាប់សាមញ្ញសម្រាប់ការប្រើ Koda។ ដោយបង្កើតគណនី ឬប្រើ Koda អ្នកយល់ព្រមតាមលក្ខខណ្ឌទាំងនេះ។ \"យើង\" មានន័យថា Koda ហើយ \"អ្នក\" មានន័យថា ឪពុកម្ដាយ ឬអាណាព្យាបាល ដែលបានបង្កើតគណនី។",
    sections: [
      {
        heading: "អ្នកណាអាចបង្កើតគណនី",
        body: [
          "គណនីត្រូវបង្កើតដោយមនុស្សពេញវ័យ — ឪពុកម្ដាយ អាណាព្យាបាល ឬគ្រូ — ដែលទទួលខុសត្រូវចំពោះកុមារដែលរៀនលើគណនីនោះ។ កុមារប្រើ Koda ក្នុងគណនីនោះ។",
        ],
      },
      {
        heading: "គណនីរបស់អ្នក",
        body: [
          "សូមរក្សាពាក្យសម្ងាត់ និងលេខ PIN គ្រួសារជាការសម្ងាត់ ហើយប្រាប់យើង បើអ្នកគិតថាមាននរណាម្នាក់ផ្សេងកំពុងប្រើគណនីអ្នក។ អ្នកទទួលខុសត្រូវចំពោះអ្វីដែលកើតឡើងក្នុងគណនីគ្រួសាររបស់អ្នក។",
        ],
      },
      {
        heading: "ការប្រើ Koda ឱ្យបានល្អ",
        body: [
          "សូមកុំប្រើ Koda ខុស៖ កុំព្យាយាមលួចចូល ឬធ្វើឱ្យវាយឺត កុំចម្លងមេរៀន ឬសៀវភៅរបស់វាទៅផ្សព្វផ្សាយកន្លែងផ្សេង ហើយកុំប្រើវាដើម្បីសម្លុត ឬធ្វើឱ្យនរណាម្នាក់អាក់អន់ចិត្ត រួមទាំងក្នុងល្បែងជាក្រុមផងដែរ។",
        ],
      },
      {
        heading: "អ្វីដែលអ្នកបន្ថែម",
        body: [
          "សារសំឡេង រូបថត និងអ្វីៗផ្សេងទៀតដែលអ្នក ឬកូនរបស់អ្នកបន្ថែម នៅតែជារបស់អ្នក។ អ្នកអនុញ្ញាតឱ្យយើងរក្សាទុក និងដំណើរការវា គ្រាន់តែដើម្បីដំណើរការ Koda សម្រាប់គ្រួសារអ្នក ដូចដែលគោលការណ៍ឯកជនភាពបានពន្យល់។",
        ],
      },
      {
        heading: "មេរៀន និងសៀវភៅរបស់ Koda",
        body: [
          "មេរៀន សៀវភៅ រូបភាព និងសំឡេងរបស់ Koda ជាកម្មសិទ្ធិរបស់ Koda ឬរបស់អ្នកដែលបានបង្កើតវា ហើយគឺសម្រាប់ការសិក្សារបស់គ្រួសារអ្នកផ្ទាល់។",
        ],
      },
      {
        heading: "គម្រោងឥតគិតថ្លៃ និងបង់ប្រាក់",
        body: [
          "ផ្នែកខ្លះនៃ Koda គឺឥតគិតថ្លៃ។ បើគម្រោងណាមួយត្រូវបង់ប្រាក់ តម្លៃ និងអ្វីដែលវាមាន នឹងបង្ហាញមុនពេលអ្នកជ្រើសរើស ហើយគ្មានការគិតប្រាក់ណាមួយ ដោយគ្មានការយល់ព្រមពីអ្នកទេ។",
        ],
      },
      {
        heading: "ការផ្លាស់ប្ដូរ និងភាពអាចប្រើបាន",
        body: [
          "យើងបន្តកែលម្អ Koda ដូច្នេះមេរៀន និងមុខងារអាចផ្លាស់ប្ដូរ។ យើងខិតខំរក្សាឱ្យវាដំណើរការ ប៉ុន្តែមិនអាចសន្យាថាវានឹងមិនដែលគាំង ឬមិនដែលមានកំហុសទេ។ Koda ជួយគាំទ្រការសិក្សា វាមិនជំនួសសាលារៀន ឬគ្រូទេ។",
        ],
      },
      {
        heading: "ការបិទគណនី",
        body: [
          "អ្នកអាចឈប់ប្រើ Koda គ្រប់ពេល ហើយស្នើឱ្យយើងលុបគណនីរបស់អ្នក។ យើងអាចបិទគណនីដែលបំពានលក្ខខណ្ឌទាំងនេះ ក្រោយពីប្រាប់អ្នក នៅពេលដែលយើងអាចធ្វើបាន។",
        ],
      },
      {
        heading: "ការផ្លាស់ប្ដូរលក្ខខណ្ឌទាំងនេះ",
        body: [
          "បើយើងផ្លាស់ប្ដូរលក្ខខណ្ឌទាំងនេះ យើងនឹងធ្វើបច្ចុប្បន្នភាពទំព័រនេះ និងកាលបរិច្ឆេទរបស់វា ហើយប្រាប់អ្នកក្នុងកម្មវិធី ឬតាមអ៊ីមែល បើការផ្លាស់ប្ដូរនោះសំខាន់។",
        ],
      },
    ],
  },
};

const DOCS: Record<string, Record<LegalKind, LegalDoc>> = { en, km };

/** The document in `language`, or in English when there is no copy in it. */
export const legalDoc = (kind: LegalKind, language: string): LegalDoc => (DOCS[language] ?? en)[kind];

/** `/privacy` and `/terms` (with or without a trailing slash); null for any other path. */
export const legalKindOf = (pathname: string): LegalKind | null => {
  const path = pathname.replace(/\/+$/, "").toLowerCase();
  return path === "/privacy" ? "privacy" : path === "/terms" ? "terms" : null;
};
