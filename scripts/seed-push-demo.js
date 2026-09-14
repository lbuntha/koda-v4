/*
 * Practice history for the family that holds a live browser, so the scheduled
 * notification jobs have something real to report.
 *
 * Run: docker compose exec -T mongo mongosh --quiet < scripts/seed-push-demo.js
 *
 * Why this exists: the three jobs on Admin -> Notifications each read a
 * different corner of the data, and a deployment where nobody has practised
 * this week answers "nothing to summarise" to every one of them. That is the
 * jobs working, and it is also indistinguishable from the jobs being broken —
 * which is exactly the confusion this seed removes.
 *
 * Idempotent, and re-runnable: events are upserted on their eventId, and the
 * reminder hour is recomputed from the family's own clock each time, so a run
 * tomorrow moves the demo forward rather than stacking a second copy of it.
 *
 * Undo: pass --undo to remove everything it wrote.
 */

const d = db.getSiblingDB("koda_v4");

// The one family with a push token that is actually attached to a family. An
// account with no membership registers a token with a null familyId, and every
// job filters those out before it looks at anything.
const FAMILY = "f_799c7c4465cc4b1a85a9";
const LEARNER = "l_5f3e95a332044b0e8f27";
const USER = "u_42db74f12ea1448aac37";
const OFFSET = 420; // minutes east of UTC, as this family's events report it.
const TAG = "seed-push-demo";

const undo = typeof process !== "undefined" && (process.argv || []).includes("--undo");

if (undo) {
  const gone = d.events.deleteMany({ seedTag: TAG }).deletedCount;
  d.notify_schedule.deleteOne({ _id: USER, seedTag: TAG });
  const off = d.notify_prefs.deleteMany({ seedTag: TAG }).deletedCount;
  print(`Removed ${gone} seeded events, ${off} seeded preferences and the reminder hour.`);
} else {
  const local = new Date(Date.now() + OFFSET * 60000);
  const dayKey = (back) => {
    const t = new Date(local.getTime() - back * 86400000);
    return t.toISOString().slice(0, 10);
  };

  // Four days back, one, two and four — deliberately not today. A child who has
  // already practised today is skipped by the reminder job, so seeding today
  // would light up the summary and darken the reminder in the same stroke.
  const days = [4, 2, 1].map(dayKey);

  days.forEach((day, i) => {
    d.events.updateOne(
      { familyId: FAMILY, eventId: `${TAG}-${i}` },
      {
        $set: {
          familyId: FAMILY,
          eventId: `${TAG}-${i}`,
          learnerId: LEARNER,
          type: "lesson_completed",
          localDay: day,
          tzOffsetMinutes: OFFSET,
          skillId: "counting",
          conceptKey: "count-the-row",
          sessionId: `s_${TAG}`,
          deviceId: "d_12cc09c40c6641a6b70e",
          questionsAnswered: 5,
          correctFirstTry: 4,
          standards: [],
          seq: 900 + i,
          serverSeq: 900 + i,
          ts: new Date(`${day}T10:00:00.000Z`),
          receivedAt: new Date(),
          seedTag: TAG,
        },
      },
      { upsert: true },
    );
  });

  // The reminder goes at the hour each parent picked, and the default is 17:00.
  // Set it to this family's current hour so the preview shows a parent who
  // would actually be told rather than "0 parents would be told".
  d.notify_schedule.updateOne(
    { _id: USER },
    {
      $set: {
        userId: USER,
        reminderHour: local.getUTCHours(),
        tzOffsetMinutes: OFFSET,
        updatedAt: new Date(),
        seedTag: TAG,
      },
    },
    { upsert: true },
  );

  // Both nudge kinds are opt-in — `familyDefault` is false for each, because a
  // notification that asks a child to practise is not something to switch on
  // for somebody. So a family that has never opened Settings -> Notifications
  // is correctly told to nobody, and the preview says "0 parents would be
  // told". Switch them on here, which is what the parent would have done.
  ["learn.practice_reminder", "learn.streak_ending"].forEach((kind) => {
    d.notify_prefs.updateOne(
      { _id: `${USER}:${kind}` },
      { $set: { userId: USER, kind, on: true, updatedAt: new Date(), seedTag: TAG } },
      { upsert: true },
    );
  });

  print(`Seeded practice on ${days.join(", ")} for learner ${LEARNER}.`);
  print(`Switched on the practice reminder and streak warning for ${USER}.`);
  print(`Reminder hour set to ${local.getUTCHours()}:00 their time (UTC+${OFFSET / 60}).`);
  print(`Local day right now for this family: ${dayKey(0)} — deliberately left blank.`);
}
