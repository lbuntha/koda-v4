# Skill launcher

The skill launcher is a dedicated play page, not a home-page modal.

## Route

The first simulated skill opens at:

```text
#/play/count-objects
```

Opening the route unmounts the learner home page. Closing or finishing the skill
returns to `#/home`. Refreshing the browser keeps the play page open.

## Layout

The launcher uses three fixed zones:

1. **Status header** — leave action, session progress, and remaining lives.
2. **Interaction canvas** — the only scrollable area; contains one prompt and one interaction.
3. **Action tray** — fixed to the viewport bottom with Skip, Check, Retry, or Continue.

This keeps the main action reachable on phones and tablets. Safe-area padding is
included for installed apps and devices with a home indicator.

## Session lifecycle

`SkillLauncher` manages:

- the current Learn → Practice → Challenge → Review → Master stage;
- the selected answer separately from the submitted answer;
- Check, correct, retry, skip, and continue transitions;
- lives and progress;
- correct-answer history, mastery completion, XP, and badge presentation.

State is currently held in React. A backend can later receive the same transition
events without changing question renderers.

## Question renderers

Question JSON selects its renderer through `type`:

- `count-choice` — count a displayed object group and choose a number.
- `group-choice` — choose the group containing the requested quantity.
- `dialogue-choice` — complete a character conversation from text choices.

Dialogue questions may define `audioText`. The launcher uses the browser speech
engine when the learner presses the audio button; no backend is required.
