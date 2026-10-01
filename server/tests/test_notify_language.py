"""Notifications in the family's own language.

The language is the family's choice in the app (their synced `preferences`
document); the words come from `notify_locales/<code>.json`, an operator's edit
in that language overrides them, and anything missing falls back to English.
"""

import re

from app import notify_i18n
from app.push_defaults import BY_KIND, EMAIL_FRAME
from app.services import email_notify, push
from tests.test_push import admin, seeded  # noqa: F401 — shared fixtures

FAMILY = "fam_language"


async def _choose(db, language: str | None, family_id: str = FAMILY) -> None:
    await db.docs.replace_one(
        {"familyId": family_id, "kind": "preferences", "key": "default"},
        {
            "familyId": family_id,
            "kind": "preferences",
            "key": "default",
            "body": {"theme": "light", "language": language},
        },
        upsert=True,
    )


def _names(text: str) -> set[str]:
    return set(re.findall(r"\{(\w+)\}", text))


# --- which language ------------------------------------------------------------


async def test_a_family_that_never_chose_hears_english(db):
    assert await notify_i18n.language_of_family(db, FAMILY) == "en"
    title, _ = await push.wording(db, "device.new_signin", {"device": "Mac"}, family_id=FAMILY)
    assert title == "New sign-in to Koda"


async def test_a_khmer_family_hears_khmer(db):
    await _choose(db, "km")

    title, body = await push.wording(db, "device.new_signin", {"device": "Mac"}, family_id=FAMILY)

    assert title == notify_i18n.kind_text("km", "device.new_signin")["title"]
    assert "Mac" in body


async def test_a_language_this_server_has_no_words_for_is_english(db):
    await _choose(db, "fr")

    assert await notify_i18n.language_of_family(db, FAMILY) == "en"


async def test_a_kind_the_language_file_leaves_out_falls_back_to_english(db):
    assert notify_i18n.kind_text("km", "no.such.kind") == {}
    title, _ = await push.wording(db, "learn.goal_met", {"learner": "Mia", "rounds": 3, "skill": "x"}, language="en")
    assert "Mia" in title


# --- the phrases a sender builds --------------------------------------------------


def test_phrases_count_in_each_language():
    assert notify_i18n.phrase("en", "days", 1) == "1 day"
    assert notify_i18n.phrase("en", "days", 3) == "3 days"
    assert notify_i18n.phrase("km", "days", 3) == "3 ថ្ងៃ"
    assert notify_i18n.join_names(["A", "B", "C"], "en") == "A, B and C"
    assert notify_i18n.join_names(["A", "B"], "km") == "A និង B"


# --- the shipped Khmer keeps every blank the English fills -------------------------


def test_every_khmer_kind_fills_the_same_blanks_as_english():
    for kind_id, definition in BY_KIND.items():
        local = notify_i18n.kind_text("km", kind_id)
        assert local, f"{kind_id} has no Khmer wording"
        for field in ("title", "body"):
            assert _names(local[field]) == _names(definition[field]), f"{kind_id}.{field}"
        if definition.get("email"):
            for field in ("subject", "body"):
                assert _names(local["email"][field]) == _names(definition["email"][field]), (
                    f"{kind_id}.email.{field}"
                )


def test_the_khmer_frame_keeps_what_every_email_needs():
    frame = notify_i18n.frame_text("km")
    for part in EMAIL_FRAME:
        assert _names(frame[part]) == _names(EMAIL_FRAME[part]), part


# --- an operator's edit, per language ------------------------------------------------


async def test_an_edit_in_khmer_leaves_english_alone(client, admin, db, seeded):  # noqa: F811 — pytest fixtures
    await _choose(db, "km")

    response = await client.patch(
        "/system/push/templates/device.new_signin?language=km",
        headers=admin,
        json={"title": "ចូលគណនីថ្មី", "body": "{device} បានចូល។"},
    )

    assert response.status_code == 200
    assert response.json()["language"] == "km"
    khmer, _ = await push.wording(db, "device.new_signin", {"device": "Mac"}, family_id=FAMILY)
    english, _ = await push.wording(db, "device.new_signin", {"device": "Mac"}, language="en")
    assert khmer == "ចូលគណនីថ្មី"
    assert english == "New sign-in to Koda"


async def test_resetting_khmer_goes_back_to_the_shipped_khmer(client, admin, db, seeded):  # noqa: F811 — pytest fixtures
    await client.patch(
        "/system/push/templates/device.new_signin?language=km",
        headers=admin,
        json={"title": "Anything", "body": "At all."},
    )

    await client.delete("/system/push/templates/device.new_signin?language=km", headers=admin)

    title, _ = await push.wording(db, "device.new_signin", {"device": "Mac"}, language="km")
    assert title == notify_i18n.kind_text("km", "device.new_signin")["title"]


async def test_the_templates_list_is_served_per_language(client, admin, seeded):  # noqa: F811 — pytest fixtures
    body = (await client.get("/system/push/templates?language=km", headers=admin)).json()

    assert body["language"] == "km"
    assert {row["code"] for row in body["languages"]} >= {"en", "km"}
    goal = next(row for row in body["templates"] if row["id"] == "learn.goal_met")
    assert goal["title"] == notify_i18n.kind_text("km", "learn.goal_met")["title"]
    assert goal["edited"] is False


# --- email --------------------------------------------------------------------------


async def test_a_khmer_email_is_framed_in_khmer(db):
    subject, message, text = await email_notify.compose(
        db,
        "learn.stuck",
        {"learner": "Mia", "lesson": "Take Away"},
        user_id="u_1",
        parent="Dara",
        language="km",
    )

    assert subject == notify_i18n.kind_text("km", "learn.stuck")["email"]["subject"].format(
        learner="Mia", lesson="Take Away"
    )
    assert text.startswith("សួស្ដី Dara")
    assert notify_i18n.kind_text("km", "learn.stuck")["label"] in text
