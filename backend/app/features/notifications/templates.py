"""Pure message-composition functions — no I/O, so wording can be unit-tested
directly. Mirrors the `compose(...) -> Message` shape in `auth/reset.py`."""

from __future__ import annotations

from ...core.mail import Message


def achievement_notification(student_name: str, skill_name: str, level: str) -> tuple[str, str]:
    """`level` is always "proficient" or "master" — see the achievement threshold
    note in the notifications plan: routine level-ups are not "achievements"."""
    verb = "leveled up to Proficient on" if level == "proficient" else "mastered"
    return (
        f"🌟 {student_name} {verb} {skill_name}!",
        f"Great work — {student_name} just reached {level.title()} on {skill_name}. Keep it up!",
    )


def streak_notification(student_name: str, days: int) -> tuple[str, str]:
    return (
        f"🔥 {days}-day streak!",
        f"{student_name} has practiced {days} days in a row. That's real consistency — nice work!",
    )


def review_reminder_notification(student_name: str, due_count: int) -> tuple[str, str]:
    """One note for the whole backlog. Per-skill reminders would fire five to ten
    times a day at a realistic review load, which is the fastest way to teach
    someone to ignore the bell."""
    skills = "skill" if due_count == 1 else "skills"
    return (
        f"📚 {due_count} {skills} ready to review",
        f"{student_name}, you have {due_count} {skills} due for a quick review. "
        "Reviewing them now is what makes them stick.",
    )


def inactivity_nudge(parent_name: str, student_name: str, days: int) -> tuple[str, str]:
    """Deliberately not a guilt trip: it reports, it does not scold."""
    return (
        f"We haven't seen {student_name} in {days} days",
        f"Hi {parent_name},\n\n"
        f"{student_name} hasn't practised for {days} days. No problem if life got busy — "
        "a single short session is enough to pick the thread back up.\n\n"
        "You can turn these emails off from Notifications in your dashboard.\n\n"
        "— The Koda team",
    )


def pin_lockout_alert(parent_name: str, student_name: str, unlock_at: str) -> tuple[str, str]:
    """An account alert, not a progress update — see EMAIL_OPT_OUT_FIELD in service.py
    for why this one is not gated on a preference."""
    return (
        f"{student_name}'s PIN is locked",
        f"Hi {parent_name},\n\n"
        f"There were too many incorrect PIN attempts for {student_name}, so their sign-in is "
        f"locked until {unlock_at}.\n\n"
        "You don't have to wait: open your dashboard, find "
        f"{student_name} under Children, and choose \"Unlock PIN\". That clears the lockout "
        "without changing their PIN.\n\n"
        "If this wasn't them, changing their PIN is worth doing.\n\n"
        "— The Koda team",
    )


def weekly_digest_email(parent_name: str, children: list[dict]) -> Message:
    """`children`: [{"name", "xp_earned", "current_streak_days", "lessons_completed"}, ...].

    The figures are lifetime totals (the same numbers the parent's own analytics
    screen shows), not a windowed "this week" delta — the copy below is worded to
    stay honest about that rather than imply otherwise.
    """
    lines = []
    for child in children:
        lines.append(
            f"  • {child['name']}: {child['current_streak_days']}-day streak, "
            f"{child['lessons_completed']} lessons completed, {child['xp_earned']} XP so far"
        )
    body = (
        f"Hi {parent_name},\n\n"
        "Here's where your kids stand this week:\n\n"
        + "\n".join(lines)
        + "\n\nKeep going — a little practice most days adds up.\n\n"
        "You can turn this weekly email off anytime from Notifications in your dashboard.\n\n"
        "— The Koda team"
    )
    return Message(to="", subject="Your weekly Koda update", body=body)


def feature_announcement_email(parent_name: str) -> Message:
    """The one-off email introducing the notifications feature to existing users."""
    body = (
        f"Hi {parent_name},\n\n"
        "We've added a small new feature: Koda now keeps a running notifications inbox.\n\n"
        "For you, that means a weekly digest email (like this one) summarizing what your\n"
        "kids practiced, any new skills they mastered, and their current streaks — sent\n"
        "once a week, never more. You're in control of it: look for \"Notifications\" under\n"
        "Settings in your dashboard to turn the weekly email on or off.\n\n"
        "For your kids, it means a small bell in the corner of their learning screen. When\n"
        "they hit a streak or master a new skill, a friendly note is waiting there for them\n"
        "— no pop-ups, nothing that interrupts their practice.\n\n"
        "Nothing you need to do — it's already on. Thanks for learning with Koda.\n\n"
        "— The Koda team"
    )
    return Message(to="", subject="New in Koda: a notifications inbox for you and your kids", body=body)
