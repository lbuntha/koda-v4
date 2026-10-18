import { COUNTABLES, type Countable } from "./subtractionAssets";
import { ts } from "../i18n";

/**
 * The fixed cast every subtraction story is told about.
 *
 * Small and fixed on purpose. A child meeting the same six names across seven
 * lessons stops spending attention on who the story is about and spends it on
 * what happened to the quantities — and a fixed cast is auditable, where names
 * assembled at random are not.
 *
 * Templates never use a pronoun for a cast member. Nothing in a maths story
 * needs one, and repeating the name costs a word and guesses nothing.
 */
export interface StoryCharacter {
  readonly name: string;
  /** Where this character's stories happen, for template variety. */
  readonly place: string;
}

/** Named through the catalog (`cast.<n>`), so a Khmer story is about Khmer names. */
const character = (n: number): StoryCharacter => ({
  get name() {
    return ts(`cast.${n}.name`);
  },
  get place() {
    return ts(`cast.${n}.place`);
  },
});

export const CAST: readonly StoryCharacter[] = [
  character(0),
  character(1),
  character(2),
  character(3),
  character(4),
  character(5),
] as const;

/** Stories count the same six things the manipulatives use. */
export const STORY_ITEMS: readonly Countable[] = COUNTABLES;

export interface StoryScene {
  who: StoryCharacter;
  other: StoryCharacter;
  item: Countable;
}

/**
 * Pick a scene from an index rather than at random.
 *
 * The question index drives it, so the five questions of a round are told about
 * five different people and things without a second random source that could
 * repeat twice in a row.
 */
export const sceneAt = (index: number, offset = 0): StoryScene => {
  const who = CAST[(index + offset) % CAST.length];
  const other = CAST[(index + offset + 3) % CAST.length];
  return { who, other, item: STORY_ITEMS[(index + offset) % STORY_ITEMS.length] };
};

/**
 * Fill a lesson's sentence template.
 *
 * `{v0}`, `{v1}`, `{v2}` are the quantities the sentence states, in the order
 * the generator produced them; the rest name the cast. A template is authored
 * in lesson JSON so the wording can be corrected without touching the engine.
 */
export const fillTemplate = (template: string, scene: StoryScene, values: number[]): string =>
  values
    .reduce((text, value, i) => text.replaceAll(`{v${i}}`, String(value)), template)
    .replaceAll("{who}", scene.who.name)
    .replaceAll("{other}", scene.other.name)
    .replaceAll("{place}", scene.who.place)
    .replaceAll("{item}", scene.item.name)
    .replaceAll("{itemOne}", scene.item.one);
