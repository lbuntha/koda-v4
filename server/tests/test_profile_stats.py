"""The profile's figures are a stored row, not a calculation.

What these pin down is the difference: a read creates the row from the shipped
samples and says so, a write flips it to `recorded` and survives the next read,
and the row a caller reaches is decided by their token and nothing else.
"""


async def test_first_read_seeds_the_row_and_admits_the_figures_are_samples(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    first = await client.get("/profile/stats", headers=auth)
    assert first.status_code == 200, first.text
    body = first.json()

    assert body["source"] == "placeholder"
    # Every field the page prints exists from the first read, so no reading of
    # the profile has to cope with a missing figure.
    for field in (
        "dayStreak", "totalXp", "level", "starsEarned", "lessonsMastered",
        "lessonsAvailable", "dailyGoal", "dailySolved", "topThreeFinishes",
        "league", "badges", "childrenCount", "codesWaiting", "permissionsCount",
    ):
        assert field in body, field


async def test_a_recorded_figure_survives_the_next_read(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    await client.get("/profile/stats", headers=auth)
    written = await client.patch(
        "/profile/stats", headers=auth, json={"childrenCount": 2, "codesWaiting": 1}
    )
    assert written.status_code == 200, written.text
    assert written.json()["childrenCount"] == 2
    # The row is no longer samples, and says so.
    assert written.json()["source"] == "recorded"

    # The read that follows must not seed over what was just written.
    again = (await client.get("/profile/stats", headers=auth)).json()
    assert again["childrenCount"] == 2
    assert again["codesWaiting"] == 1
    assert again["source"] == "recorded"


async def test_a_partial_write_leaves_the_other_figures_alone(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    await client.patch("/profile/stats", headers=auth, json={"totalXp": 400, "dayStreak": 6})
    after = (await client.patch("/profile/stats", headers=auth, json={"dayStreak": 7})).json()

    assert after["dayStreak"] == 7
    # Whatever measures a streak has no opinion about XP and must not zero it.
    assert after["totalXp"] == 400


async def test_a_child_and_their_parent_keep_separate_rows(client, signup_body):
    parent = (await client.post("/auth/signup", json=signup_body())).json()
    parent_auth = {"Authorization": f"Bearer {parent['accessToken']}"}
    learner = (
        await client.post("/learners", headers=parent_auth, json={"displayName": "Mia"})
    ).json()
    child = (await client.post(f"/auth/switch/{learner['id']}", headers=parent_auth)).json()
    child_auth = {"Authorization": f"Bearer {child['accessToken']}"}

    await client.patch("/profile/stats", headers=child_auth, json={"totalXp": 120})
    await client.patch(
        "/profile/stats", headers=parent_auth, json={"totalXp": 0, "childrenCount": 1}
    )

    assert (await client.get("/profile/stats", headers=child_auth)).json()["totalXp"] == 120
    # The token picks the row, so a child's XP is never the parent's.
    parent_row = (await client.get("/profile/stats", headers=parent_auth)).json()
    assert parent_row["totalXp"] == 0
    assert parent_row["childrenCount"] == 1


async def test_a_field_nobody_declared_is_not_stored(client, db, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    saved = await client.patch(
        "/profile/stats", headers=auth, json={"dayStreak": 3, "smuggled": "anything"}
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["dayStreak"] == 3

    row = await db.profile_stats.find_one({})
    assert "smuggled" not in row


async def test_the_figures_need_a_session(client):
    assert (await client.get("/profile/stats")).status_code == 401
