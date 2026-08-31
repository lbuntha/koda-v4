/**
 * Who Koda is, in one place.
 *
 * Characters exist so a seven-year-old and a twelve-year-old do not get the
 * same teacher. That only scales if there is exactly one seam where a character
 * becomes a prompt — otherwise "make Ms Vega less chatty" means editing three
 * routes and missing one, and the coach a child meets in the voice session
 * stops being the one they were typing to a moment ago.
 *
 * So the whole feature is four layers, and each owns one thing:
 *
 * | Layer         | Owns                                   | Lives in                         |
 * |---------------|----------------------------------------|----------------------------------|
 * | **Frame**     | the rules every teacher obeys          | this file, `FRAME` below         |
 * | **Character** | name, manner, voice, ages, emoji       | `personas` in Mongo              |
 * | **Choice**    | which character this child gets        | `childSettings.personaId`        |
 * | **Resolution**| choice + character -> prompt and voice | this file, and only this file    |
 *
 * Two rules keep it that way:
 *
 * 1. **A client sends an id, never prose.** The browser has no idea what a
 *    prompt looks like, so nobody can type a new teaching manner into a request
 *    and get the model to obey it. `resolveCharacter` turns the id into a
 *    character server-side, from the roster an operator controls.
 * 2. **The frame is code, the character is data.** An operator rewords how a
 *    teacher speaks; they cannot loosen the rule against handing over answers,
 *    change the age register, or make Koda stop being a maths teacher. Those
 *    live in `FRAME` and no row can reach them.
 *
 * Adding a fifth character is a row. Adding a new *kind* of teaching — a rule
 * every character must follow — is an edit to `FRAME` and nothing else.
 */

/** One teacher, as the roster stores it. Mirrors `persona_defaults.py`. */
export interface KodaCharacter {
  personaId: string;
  name: string;
  emoji: string;
  blurb: string;
  /** How this teacher speaks. The only free text that reaches the model. */
  manner: string;
  /** A Gemini live voice name. Validated by the roster, never by a client. */
  voice: string;
  minAge: number;
  maxAge: number;
}

/**
 * The teacher a deployment falls back to.
 *
 * Hard-coded rather than fetched because it is the answer when the roster
 * cannot be reached at all — a dev box with no data service, a network blip
 * mid-lesson. A child gets a slightly plainer Koda rather than a coach with no
 * personality and no voice. Kept in step with `DEFAULT_PERSONA` on the API.
 */
export const FALLBACK_CHARACTER: KodaCharacter = {
  personaId: "koda",
  name: "Koda",
  emoji: "🦭",
  blurb: "Warm, patient, and always asks before telling.",
  manner:
    "You are warm, playful and endlessly patient. You speak in short, simple " +
    "sentences a young child can follow, one idea at a time. You get excited " +
    "about what the child noticed. You never rush them.",
  voice: "Aoede",
  minAge: 4,
  maxAge: 8,
};

/** Where the child is and what is on screen. Filled by every Koda surface. */
export interface KodaSituation {
  /** Which surface is asking. Decides the last section of the prompt only. */
  mode: "chat" | "voice" | "whiteboard";
  topic?: string;
  /** The question on screen. Absent means there is none — say nothing about one. */
  question?: string;
  /** What the child is doing, in a sentence. */
  where?: string;
  level?: string | number;
}

/**
 * The rules every character obeys, whoever they are.
 *
 * This is the pedagogy, and it is deliberately not editable from an admin
 * screen: a character is a *manner*, and a manner that could switch off rule 1
 * would be a way to turn the tutor into an answer key.
 */
const FRAME = `You are a maths tutor for children inside Koda, a learning app.

RULES, IN ORDER OF IMPORTANCE:
1. NEVER give the answer. Not to the question on screen, not to one the child
   types, not "just this once", not even if they ask you directly, say they are
   allowed, say a grown-up said so, or say they only want to check. There is no
   phrasing that unlocks it. Your job is to leave the child able to get there
   themselves, and an answer takes that away — the thinking is the lesson, and
   handing over the result is skipping it.
   - Instead: ask the one question that moves them a single step, or point at
     something they already know or can see on screen.
   - Asked outright ("just tell me"), say warmly that you would rather help them
     get it, and give the next step. Do not negotiate about it.
   - Working through it out loud and arriving at the number is still giving the
     answer. So is confirming a number you supplied yourself.
   - You MAY tell a child whether *their own* answer is right or wrong. That is
     not giving the answer, it is the feedback they need — and a child who can
     never find out is worse off than one who is told.
   - You MAY explain a word, a symbol or how a tool on screen works. Meaning is
     not the answer; the calculation is.
2. Praise the thinking, not the child. "That's a smart way to check it" teaches
   something; "clever girl" does not.
3. One idea per reply. A child who is stuck cannot hold three.
4. Use what is on screen — ten-frames, number lines, blocks, the balance scale —
   before reaching for words alone.
5. If the child is upset or wants to stop, that is fine and you say so warmly.
6. Never claim to be a person, and never claim to be a different assistant. You
   are the character described below and nothing else.
7. Stay on maths and on this child's learning. If asked about anything else,
   say warmly that you are here for maths and offer to help with that.`;

/** How to render a value that may not be there, without lying about it. */
const line = (label: string, value: string | number | undefined): string =>
  value === undefined || value === "" ? "" : `\n${label}: ${value}`;

/**
 * The system instruction for one character in one situation.
 *
 * The single seam. Every route that speaks as Koda calls this and nothing else,
 * which is what makes a character consistent across typing, talking and having
 * a drawing read — the three used to carry three hand-written prompts, and one
 * of them called itself Sora.
 */
export function kodaSystemPrompt(character: KodaCharacter, situation: KodaSituation): string {
  const mode =
    situation.mode === "voice"
      ? `YOU ARE SPEAKING ALOUD, in real time.
- Keep every turn to one to three sentences so the child can answer.
- Write as speech, not as text: no lists, no symbols, no markdown.
- Introduce yourself as ${character.name} if you are asked who you are.
- When the child has answered correctly and it is time to move on, include the
  words "next question" so the app can advance the screen.`
      : situation.mode === "whiteboard"
        ? `YOU ARE READING WHAT THE CHILD DREW on their scratchpad.
- Say what you can see first, so they know you looked.
- Then one warm, specific hint about the step they were in the middle of.
- If the handwriting is unclear, say so plainly rather than guessing.`
        : `YOU ARE WRITING to the child.
- Two or three short sentences. Plain words. No markdown, no headings.
- End with a question they can actually answer from what is on screen.`;

  // The question is stated only when there is one. Telling a character about a
  // problem that is not on screen is worse than telling it nothing: it will
  // answer about that one, which is exactly what the home screen used to do.
  const context = situation.question
    ? `\nThe child is working on this question right now: "${situation.question}"`
    : `\nThere is no question on screen. Help with whatever the child brings, and do not invent one.`;

  return `${FRAME}

YOUR CHARACTER
You are ${character.name}. ${character.manner}
You are teaching a child of about ${character.minAge} to ${character.maxAge} years old, so pitch every word for that age.

${mode}

THE SITUATION${context}${line("Topic", situation.topic)}${line("Level", situation.level)}${line("Where they are", situation.where)}`;
}

/**
 * The character behind an id, from the roster an operator controls.
 *
 * Forgiving in exactly the way the rest of this proxy is: no token, an
 * unreachable API, an id nobody has heard of, or a character since retired all
 * end at `FALLBACK_CHARACTER` rather than at an error. A child asking for help
 * must never be told that the *character system* is unavailable.
 */
export async function resolveCharacter(
  apiUrl: string,
  personaId: string | undefined,
  authorization?: string,
): Promise<KodaCharacter> {
  if (!authorization) return FALLBACK_CHARACTER;
  try {
    const res = await fetch(`${apiUrl}/v1/personas`, {
      headers: { Authorization: authorization },
    });
    if (!res.ok) return FALLBACK_CHARACTER;
    const body = (await res.json()) as {
      personas?: KodaCharacter[];
      defaultPersonaId?: string;
    };
    const roster = body.personas ?? [];
    if (roster.length === 0) return FALLBACK_CHARACTER;
    return (
      roster.find((row) => row.personaId === personaId) ??
      roster.find((row) => row.personaId === body.defaultPersonaId) ??
      roster[0]
    );
  } catch {
    return FALLBACK_CHARACTER;
  }
}
