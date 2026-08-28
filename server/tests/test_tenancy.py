"""One family must never reach another's rows, by any route."""


async def test_devices_are_scoped_to_the_calling_family(client, signup_body):
    a = (await client.post("/auth/signup", json=signup_body("a@example.com"))).json()
    b = (await client.post("/auth/signup", json=signup_body("b@example.com"))).json()

    auth_a = {"Authorization": f"Bearer {a['accessToken']}"}
    listed = (await client.get("/devices", headers=auth_a)).json()["devices"]
    ids = {d["id"] for d in listed}

    assert a["deviceId"] in ids
    assert b["deviceId"] not in ids

    # And the id cannot be borrowed: it is filtered by familyId, not just hidden.
    denied = await client.delete(f"/devices/{b['deviceId']}", headers=auth_a)
    assert denied.status_code == 404
