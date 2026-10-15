"""A child reads aloud and sends it; their grown-ups hear it, and nobody else."""

import base64

import pytest

from app import audio_store
from app.settings import settings

WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 28


@pytest.fixture(autouse=True)
def audio_files(tmp_path, monkeypatch):
    monkeypatch.setattr(settings(), "library_audio_dir", str(tmp_path / "library-audio"))
    monkeypatch.setattr(settings(), "library_audio_bucket", None)
    monkeypatch.setattr(audio_store, "_encode_m4a", lambda data, _mime: b"test-m4a:" + data)


async def _family(client, signup_body, email="parent@example.com"):
    parent = (await client.post("/auth/signup", json=signup_body(email))).json()
    auth = {"Authorization": f"Bearer {parent['accessToken']}"}
    learner = (await client.post("/learners", headers=auth, json={"displayName": "Mia", "birthYear": 2018})).json()
    child = (await client.post(f"/auth/switch/{learner['id']}", headers=auth)).json()
    return auth, {"Authorization": f"Bearer {child['accessToken']}"}, learner["id"]


def _note(**extra):
    return {
        "mime": "audio/wav",
        "data": base64.b64encode(WAV).decode(),
        "bookId": "rainy-day",
        "bookTitle": "The Rainy Day",
        "pages": [2, 1, 1],
        "durationMs": 4200,
        **extra,
    }


async def test_a_child_sends_a_reading_and_their_parent_hears_it(client, db, signup_body):
    parent, child, learner_id = await _family(client, signup_body)

    sent = await client.post("/library/voice-notes", json=_note(), headers=child)
    assert sent.status_code == 201, sent.text
    note = sent.json()
    assert note["learnerId"] == learner_id
    assert note["pages"] == [1, 2]
    assert note["heard"] is False

    # The parent is told, and the tap opens this child.
    told = (await client.get("/notifications", headers=parent)).json()["notifications"]
    assert told[0]["kind"] == "learn.voice_note"
    assert told[0]["title"] == "Mia read to you"
    assert "The Rainy Day" in told[0]["body"]
    assert told[0]["path"] == f"/children/{learner_id}"

    listed = (await client.get("/library/voice-notes", params={"learnerId": learner_id}, headers=parent)).json()
    assert listed["unheard"] == 1 and listed["notes"][0]["id"] == note["id"]

    played = await client.get(f"/library/voice-notes/{note['id']}/audio", headers=parent)
    assert played.status_code == 200 and played.content.startswith(b"test-m4a:")
    assert played.headers["content-type"] == "audio/mp4"

    assert (await client.post(f"/library/voice-notes/{note['id']}/heard", headers=parent)).status_code == 204
    listed = (await client.get("/library/voice-notes", params={"learnerId": learner_id}, headers=parent)).json()
    assert listed["unheard"] == 0 and listed["notes"][0]["heard"] is True

    assert (await client.delete(f"/library/voice-notes/{note['id']}", headers=parent)).status_code == 204
    assert (await client.get("/library/voice-notes", params={"learnerId": learner_id}, headers=parent)).json()["notes"] == []


async def test_only_a_child_sends_and_only_their_own_family_listens(client, db, signup_body):
    parent, child, learner_id = await _family(client, signup_body)
    stranger, _, _ = await _family(client, signup_body, "stranger@example.com")

    # A grown-up's session cannot pose as the child.
    assert (await client.post("/library/voice-notes", json=_note(), headers=parent)).status_code == 403
    note = (await client.post("/library/voice-notes", json=_note(), headers=child)).json()

    # The child cannot list or play the family's messages.
    assert (await client.get("/library/voice-notes", params={"learnerId": learner_id}, headers=child)).status_code == 403

    # Another family sees nothing and can touch nothing.
    assert (await client.get("/library/voice-notes", params={"learnerId": learner_id}, headers=stranger)).json()["notes"] == []
    assert (await client.get(f"/library/voice-notes/{note['id']}/audio", headers=stranger)).status_code == 404
    assert (await client.post(f"/library/voice-notes/{note['id']}/heard", headers=stranger)).status_code == 404
    assert (await client.delete(f"/library/voice-notes/{note['id']}", headers=stranger)).status_code == 404


async def test_a_voice_message_is_checked(client, db, signup_body):
    _, child, _ = await _family(client, signup_body)
    assert (await client.post("/library/voice-notes", json=_note(durationMs=6 * 60 * 1000), headers=child)).status_code == 413
    assert (await client.post("/library/voice-notes", json=_note(mime="video/mp4"), headers=child)).status_code == 415
    assert (await client.post("/library/voice-notes", json=_note(data="not base64!"), headers=child)).status_code == 400


async def test_removing_a_child_removes_their_voice_messages(client, db, signup_body):
    parent, child, learner_id = await _family(client, signup_body)
    await client.post("/library/voice-notes", json=_note(), headers=child)
    assert await db.voice_notes.count_documents({"learnerId": learner_id}) == 1
    assert (await client.delete(f"/learners/{learner_id}", headers=parent)).status_code == 204
    assert await db.voice_notes.count_documents({"learnerId": learner_id}) == 0
