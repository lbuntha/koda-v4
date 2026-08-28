import { render, screen, within, act } from "@testing-library/react";
import { expect } from "vitest";
import type { ReactElement } from "react";
import type { AnyActivityDefinition, Skill, SkillResult } from "../../types";
import { createFakeKoda, type FakeKoda, type FakeKodaOptions } from "./fakeKoda";

/**
 * Mount one activity the way the host mounts it, with a recording SDK.
 *
 * An activity's real contract is not what it renders — it is the sequence of
 * SDK calls a round produces. This returns the rendered screen *and* the
 * recording, so a test can drive the UI like a child and then assert on the log
 * the host would have received.
 */

export interface ActivityHarness {
  koda: FakeKoda;
  /** Results passed to `onComplete`. One per finished round. */
  results: SkillResult[];
  /** The rendered container, for queries scoped to this activity. */
  screen: typeof screen;
  within: typeof within;
  unmount(): void;
  /** Click a button by its visible text. Fails loudly if it is absent. */
  press(label: string | RegExp): Promise<void>;
  /** Every enabled, named button on screen — the child's available moves. */
  buttons(): string[];
  /** Wait for timers the last action started (a flash phase, an animation). */
  settle(ms?: number): Promise<void>;
  /** Text content of the whole activity, for asserting on feedback copy. */
  text(): string;
}

/** What a screen reader would call this button: its label, or its text. */
const accessibleName = (el: Element): string =>
  (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();

export interface RenderActivityOptions extends FakeKodaOptions {
  /** Lesson params. Merged over the activity's own defaults, as the host does. */
  params?: Record<string, unknown>;
  level?: number;
  lesson?: { id: string; title: string; concept?: string; levelNumber: number };
}

export function renderActivity(
  activity: AnyActivityDefinition,
  options: RenderActivityOptions = {},
): ActivityHarness {
  const { params, level = 1, lesson, ...kodaOptions } = options;
  const koda = createFakeKoda(kodaOptions);
  const results: SkillResult[] = [];

  const Component = activity.component;
  const element: ReactElement = (
    <Component
      params={{ ...activity.defaultParams, ...params }}
      level={level}
      koda={koda.sdk}
      onComplete={(result: SkillResult) => results.push(result)}
      lesson={
        lesson ?? {
          id: `${activity.id}-test`,
          title: `Test lesson for ${activity.name}`,
          levelNumber: level,
        }
      }
    />
  );

  const view = render(element);

  const press = async (label: string | RegExp) => {
    const matches = screen.getAllByRole("button", { name: label });
    // A loose pattern can hit both "Next" and "Next Level (3)". Prefer the
    // shortest match rather than failing: the test is describing an intent, and
    // the shortest label is the plain form of it.
    const button = matches.reduce((best, b) =>
      accessibleName(b).length < accessibleName(best).length ? b : best,
    );
    await act(async () => {
      button.click();
    });
  };

  /** Let timers and effects the click started settle (flash phases, animations). */
  const settle = async (ms = 0) => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });
  };

  return {
    koda,
    results,
    screen,
    within,
    unmount: view.unmount,
    press,
    settle,
    buttons: () =>
      screen
        .queryAllByRole("button")
        .filter((b) => !(b as HTMLButtonElement).disabled)
        .map(accessibleName)
        .filter((name) => name !== ""),
    text: () => view.container.textContent ?? "",
  };
}

/**
 * The round-loop guarantees every activity inherits from `useSkillRound`.
 *
 * These hold for any activity in any skill, which is what makes them worth
 * asserting once here rather than in each skill's tests: an activity that fails
 * one of them is not misbehaving in its own terms, it is breaking the host's.
 *
 * `answerCorrectly` drives one question to a correct answer — the only part a
 * skill has to write, because only the skill knows what its buttons mean.
 */
export async function expectStandardRound(
  activity: AnyActivityDefinition,
  answerCorrectly: (h: ActivityHarness) => Promise<void>,
  options: RenderActivityOptions & { questions?: number } = {},
): Promise<ActivityHarness> {
  const { questions = 5, ...renderOptions } = options;
  const h = renderActivity(activity, {
    ...renderOptions,
    params: { questionsPerRound: questions, ...renderOptions.params },
  });

  // Opening the round: the lesson is started before the first question is
  // presented, or the first response time is measured against nothing.
  expect(h.koda.count("learning.startLesson"), "startLesson once, on mount").toBe(1);
  expect(h.koda.count("learning.present"), "first question presented").toBe(1);
  const order = h.koda.calls.map((c) => c.name);
  expect(order.indexOf("learning.startLesson")).toBeLessThan(order.indexOf("learning.present"));

  for (let n = 1; n <= questions; n += 1) {
    await answerCorrectly(h);
    expect(h.koda.count("learning.answered"), `answer ${n} reported`).toBe(n);
    // A right answer also advances on its own after the praise, but pressing is
    // the faster path and the one a child in a hurry takes.
    await h.press(/^(next|finish|continue)$/i);
    await h.settle();
  }

  // Closing the round: the log is closed, XP is awarded through the SDK, and
  // the host is told once.
  expect(h.koda.count("learning.completeLesson"), "round closed once").toBe(1);
  expect(h.koda.count("progress.awardXp"), "XP awarded once").toBe(1);
  expect(h.results, "onComplete called once").toHaveLength(1);

  const [result] = h.results;
  expect(result.stars, "a clean round is three stars").toBe(3);
  expect(result.xpEarned).toBeGreaterThan(0);
  expect(h.koda.xpAwarded).toBe(result.xpEarned);

  return h;
}

/**
 * Every activity a skill registers mounts, opens a round and presents a
 * question — without the skill's author writing a test per activity.
 *
 * This is the cheapest test in the suite and it has caught the most: a lesson
 * routed to an activity whose params it does not supply crashes here, in a
 * second, instead of on a child's tablet.
 */
export function mountsCleanly(skill: Skill, activity: AnyActivityDefinition): void {
  const lesson = skill.lessons.find((l) => l.activity === `${skill.manifest.id}/${activity.id}`);
  const h = renderActivity(activity, {
    params: lesson?.params
      ? { ...(lesson.params as Record<string, unknown>), ...((lesson.params as { question?: Record<string, unknown> }).question ?? {}) }
      : undefined,
    level: (lesson?.params as { level?: number } | undefined)?.level ?? 1,
  });
  expect(h.koda.count("learning.startLesson")).toBe(1);
  expect(h.koda.count("learning.present")).toBe(1);
  expect(h.text().trim()).not.toBe("");
  h.unmount();
}
