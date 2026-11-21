"""Students see what others of their age finished, only with consent."""

from app.models.common import now
from app.routers.study_feed import band_for
from tests.test_leaderboard_weekly import auth, completed, connect, family_with_child, opt_in, opt_in_public


async def aged(db, family, age: int) -> None:
    await db.learners.update_one({"_id": family[1]["id"]}, {"$set": {"birthYear": now().year - age}})


def today() -> str:
    return now().date().isoformat()


async def feed(client, family):
    response = await client.get(f"/study-feed/{family[1]['id']}", headers=auth(family[0]))
    assert response.status_code == 200, response.text
    return response.json()


def test_bands():
    year = 2026
    assert band_for(2021, year) == (4, 7)  # five
    assert band_for(2024, year) == (4, 7)  # two counts as the youngest group
    assert band_for(2017, year) == (8, 10)
    assert band_for(2013, year) == (11, 14)
    assert band_for(2009, year) == (15, 18)
    assert band_for(None, year) is None


async def test_public_share_reaches_same_age_only(client, db, signup_body):
    viewer = await family_with_child(client, signup_body, "v@example.com", "Mia")
    same = await family_with_child(client, signup_body, "s@example.com", "Sam")
    older = await family_with_child(client, signup_body, "o@example.com", "Ola")
    await aged(db, viewer, 9)
    await aged(db, same, 8)
    await aged(db, older, 16)
    await opt_in_public(client, same, "SunBear")
    await opt_in_public(client, older, "TallOak")
    await completed(db, same, day=today(), correct=5, total=5, skillId="math", lessonId="add-1", ts="2026-01-01T01:00:00Z")
    await completed(db, older, day=today(), correct=5, total=5, skillId="math", lessonId="alg-1", ts="2026-01-01T02:00:00Z")

    body = await feed(client, viewer)

    assert body["band"] == [8, 10]
    assert [(i["nickname"], i["lessonId"]) for i in body["items"]] == [("SunBear", "add-1")]
    assert "Sam" not in str(body)


async def test_no_consent_means_not_shown(client, db, signup_body):
    viewer = await family_with_child(client, signup_body, "v@example.com", "Mia")
    quiet = await family_with_child(client, signup_body, "q@example.com", "Qin")
    await aged(db, viewer, 9)
    await aged(db, quiet, 9)
    await completed(db, quiet, day=today(), correct=5, total=5, skillId="math", lessonId="add-1")

    assert (await feed(client, viewer))["items"] == []


async def test_buddies_only_share_reaches_buddies_of_any_age(client, db, signup_body):
    viewer = await family_with_child(client, signup_body, "v@example.com", "Mia")
    buddy = await family_with_child(client, signup_body, "b@example.com", "Bo")
    await aged(db, viewer, 9)
    await aged(db, buddy, 13)
    await connect(client, viewer, buddy)
    await opt_in(client, buddy, "RiverOwl")
    await completed(db, buddy, day=today(), correct=5, total=5, skillId="math", lessonId="add-2")

    items = (await feed(client, viewer))["items"]
    assert [(i["nickname"], i["isBuddy"]) for i in items] == [("RiverOwl", True)]


async def test_popular_needs_two_students(client, db, signup_body):
    viewer = await family_with_child(client, signup_body, "v@example.com", "Mia")
    a = await family_with_child(client, signup_body, "a@example.com", "Ann")
    b = await family_with_child(client, signup_body, "b@example.com", "Ben")
    for family in (viewer, a, b):
        await aged(db, family, 9)
    await completed(db, a, day=today(), correct=5, total=5, skillId="koda-library", lessonId="book-1@2", type="reading_finished")
    await completed(db, b, day=today(), correct=5, total=5, skillId="koda-library", lessonId="book-1@3", type="reading_finished")
    await completed(db, b, day=today(), correct=5, total=5, skillId="math", lessonId="solo")

    popular = (await feed(client, viewer))["popular"]
    assert popular == [{"kind": "book", "skillId": "koda-library", "lessonId": "book-1", "title": None, "learners": 2}]


async def test_cheer_once_and_only_on_visible_shares(client, db, signup_body):
    viewer = await family_with_child(client, signup_body, "v@example.com", "Mia")
    same = await family_with_child(client, signup_body, "s@example.com", "Sam")
    hidden = await family_with_child(client, signup_body, "h@example.com", "Hal")
    for family in (viewer, same, hidden):
        await aged(db, family, 9)
    await opt_in_public(client, same, "SunBear")
    await completed(db, same, day=today(), correct=5, total=5, skillId="math", lessonId="add-1")
    await completed(db, hidden, day=today(), correct=5, total=5, skillId="math", lessonId="add-1")
    shared = (await feed(client, viewer))["items"][0]["id"]
    private = (await db.events.find_one({"learnerId": hidden[1]["id"]}))["eventId"]

    for _ in range(2):
        response = await client.post(f"/study-feed/{viewer[1]['id']}/cheer/{shared}", headers=auth(viewer[0]))
        assert response.status_code == 200, response.text
    assert response.json() == {"cheers": 1, "cheeredByMe": True}
    assert (await feed(client, viewer))["items"][0]["cheeredByMe"] is True

    response = await client.post(f"/study-feed/{viewer[1]['id']}/cheer/{private}", headers=auth(viewer[0]))
    assert response.status_code == 404


async def test_other_family_cannot_read_a_learners_feed(client, db, signup_body):
    viewer = await family_with_child(client, signup_body, "v@example.com", "Mia")
    stranger = await family_with_child(client, signup_body, "x@example.com", "Xi")
    response = await client.get(f"/study-feed/{viewer[1]['id']}", headers=auth(stranger[0]))
    assert response.status_code == 404


async def test_admin_default_hours_apply_to_parents_who_never_chose(db):
    from app.repos import notify_jobs, notify_schedule

    await notify_jobs.save(db, "daily-reminders", hour=8, updated_by="admin")
    await notify_jobs.save(db, "daily-digest", hour=20, updated_by="admin")
    await notify_schedule.save(db, "u_chose", reminder_hour=15)

    chose = await notify_schedule.for_user(db, "u_chose")
    never = (await notify_schedule.for_users(db, ["u_never"]))["u_never"]

    assert chose["reminderHour"] == 15  # a parent's own choice wins
    assert never["reminderHour"] == 8
    assert never["digestHour"] == 20
    assert (await notify_jobs.get(db, "daily-digest"))["hour"] == 20
    assert (await notify_jobs.get(db, "daily-digest"))["weekday"] is None
