# Skill build-plan template

Optional: use for a multi-engine release. For a small skill, put the same decisions
in a short task note. Do not copy the implementation guide into each plan.

## Release scope

- **ID / name / ages:**
- **Learner outcome:** observable capability assessed by this release.
- **Prerequisites:** existing conceptKeys required at entry.
- **Included / deferred techniques:**
- **Closest reference engine:** one path, plus relevant test paths.

## Lesson map

| Order / lesson ID | Objective / conceptKey | Requires | Engine / mode | Question constraints | Hint strategy | Practice coverage |
|---|---|---|---|---|---|---|
| 1 / … | … | … | … | valid inputs, expected answer, exclusions | nudge → contextual → worked | practice lesson ID |

Add a row per lesson, including practice. Keep local levels contiguous; practice
uses existing conceptKeys and separate course units. Reuse engines where suitable.

## Engine decisions

For each new engine, record only decisions not already in the guide:

- Modes for this release, interaction and answer-judging rules.
- Boundary/impossible inputs, distractors and repeat-exhaustion behavior.
- New configuration, artwork or speech needs; reuse existing helpers first.
- Supported printed modes and required figures, or why paper changes the task.

## Delivery

Build one engine and its behavior driver, then expand by the lesson map. Track
only outstanding work. Use [the validation matrix](SKILL_DEVELOPMENT.md#11-validation-matrix)
and record actual results; do not duplicate its checklist here.

## Complete lesson JSON example

This two-lesson example uses the existing `addition/tray` engine. It demonstrates
the file wrapper, nested question/copy fields and prerequisites. It is not a new
registered skill: adapt IDs, activity reference, content and ranges to your engine.
The teaching lesson is drawn from addition; practice reuses its mode. A skill using
this example needs `counter` in manifest `requires` and `count-all` in `teaches`.
Standards and trajectory values describe this example, not arbitrary new topics.

```json
{
  "lessons": [
    {
      "id": "count-all",
      "title": "Count Them All",
      "concept": "Joining Two Groups by Counting Every One",
      "conceptKey": "count-all",
      "requires": [
        "counter"
      ],
      "activity": "addition/tray",
      "params": {
        "level": 1,
        "question": {
          "mode": "count_all",
          "addendRange": [
            1,
            5
          ],
          "sumMax": 10,
          "questionsPerRound": 5
        },
        "play": {
          "targetObjective": "Count both groups, one object at a time.",
          "stepByStep": [
            "Look at the two groups.",
            "Touch every object in the first group, then keep going into the second.",
            "The last number you say is how many there are altogether."
          ],
          "kidTip": "Do not start again at the second group. Keep counting on.",
          "audioPrompt": "Count them all! Touch every one in both groups to find how many altogether.",
          "prompts": {
            "default": "Count them all. How many altogether?"
          }
        }
      },
      "standards": [
        "CCSS.K.OA.A.1",
        "CCSS.K.OA.A.2"
      ],
      "trajectoryLevel": "find-result",
      "ageBand": [
        5,
        6
      ]
    },
    {
      "id": "practice-count-all",
      "title": "Practice: Count Them All",
      "concept": "Practice Without Help",
      "conceptKey": "count-all",
      "requires": [
        "count-all"
      ],
      "activity": "addition/tray",
      "params": {
        "level": 2,
        "question": {
          "practice": true,
          "modes": [
            "count_all"
          ],
          "addendRange": [
            1,
            5
          ],
          "sumMax": 10,
          "questionsPerRound": 10
        }
      },
      "standards": [
        "CCSS.K.OA.A.1",
        "CCSS.K.OA.A.2"
      ],
      "trajectoryLevel": "find-result",
      "ageBand": [
        5,
        6
      ]
    }
  ]
}
```

`params.level` orders lessons; `params.question` configures the engine;
`params.play` contains teaching copy. The host does not deep-merge these objects:
normalize nested question values over activity defaults in the engine. A course
references `<your-skill-id>/<lesson-id>`, even when a lesson reuses another skill's
activity. Append teaching and practice references in separate units.
