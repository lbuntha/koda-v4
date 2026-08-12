from app.features.mascots.router import PURPOSES, _starter_document
from app.features.mascots.style_router import HiddenMascotPresetsIn, MascotStyleIn


def test_starter_mascots_have_complete_editable_documents():
    for purpose in PURPOSES:
        document = _starter_document(purpose)
        assert document["id"] == f"mascot-{purpose}"
        assert document["purpose"] == purpose
        assert [layer["category"] for layer in document["layers"]] == [
            "body", "pattern", "accessory", "eyes", "mouth",
        ]
        assert all(layer["assetId"] and layer["id"] for layer in document["layers"])
        assert document["palette"]["primary"].startswith("#")


def test_starter_states_keep_distinct_real_motion_profiles():
    profiles = {
        purpose: tuple((layer["category"], layer["animation"], layer["duration"])
                       for layer in _starter_document(purpose)["layers"])
        for purpose in PURPOSES
    }
    assert len(set(profiles.values())) == len(PURPOSES)
    assert ("body", "bounce", 1.25) in profiles["excited"]
    assert ("pattern", "spin", 1.4) in profiles["loading"]
    assert ("body", "pulse", 4.0) in profiles["sad"]


def test_reusable_style_contract_accepts_a_complete_mascot_template():
    document = _starter_document("happy")
    style = MascotStyleIn.model_validate({
        "id": "style-happy-bear",
        "name": "Happy Bear",
        "document": document,
        "createdAt": document["createdAt"],
        "updatedAt": document["updatedAt"],
    })
    assert style.document.layers[0]["assetId"] == "body-boulder"


def test_hidden_mascot_presets_contract_accepts_preset_ids():
    preferences = HiddenMascotPresetsIn.model_validate({"ids": ["galaxy", "mint"]})
    assert preferences.ids == ["galaxy", "mint"]


# ── The question cast ────────────────────────────────────────────────────────
#
# Four saved styles, one per moment of a question. The frontend looks them up by
# *name* (`ACTOR_ROLES` in `useStudioMascot.ts`), so a rename here silently drops
# every board back to the built-in Koda — which is why the names are asserted
# literally rather than derived from the table under test.

from app.features.mascots.cast_styles import CAST, cast_document, style_id


def test_the_cast_covers_every_moment_a_question_has():
    assert set(CAST) == {"talking", "waiting", "oops", "celebrating"}
    assert [CAST[role][0] for role in ("talking", "waiting", "oops", "celebrating")] == [
        "Talking Style", "Waiting Style", "Oops Style", "Happy Style",
    ]


def test_every_cast_member_is_a_document_the_studio_can_open():
    for role in CAST:
        document = cast_document(role)
        assert document["id"] == f"mascot-cast-{role}"
        assert [layer["category"] for layer in document["layers"]] == ["body", "eyes", "mouth"]
        assert all(layer["assetId"] and layer["id"] for layer in document["layers"])
        assert document["canvas"]["viewBox"] == "0 0 256 256"
        assert document["palette"]["primary"].startswith("#")


def test_the_cast_is_one_character_in_four_moods():
    # Same body at the same size — a child reads Koda feeling something, not four
    # different mascots taking turns.
    bodies = {cast_document(role)["layers"][0]["assetId"] for role in CAST}
    scales = {cast_document(role)["layers"][0]["scale"] for role in CAST}
    assert bodies == {"body-soft-pentagon"}
    assert len(scales) == 1

    # ...and four faces, or the mapping buys nothing over one saved style.
    faces = {tuple(layer["assetId"] for layer in cast_document(role)["layers"][1:]) for role in CAST}
    assert len(faces) == len(CAST)


def test_every_cast_member_blinks_and_moves_differently():
    for role in CAST:
        layers = {layer["category"]: layer for layer in cast_document(role)["layers"]}
        assert layers["eyes"]["animation"] == "blink"
    motions = {(cast_document(role)["layers"][0]["animation"], cast_document(role)["layers"][0]["duration"])
               for role in CAST}
    assert len(motions) == len(CAST)


def test_style_ids_are_namespaced_so_seeding_can_recognise_its_own_work():
    # `seed_cast_styles` skips an account that already has any of these, which is
    # what stops a deleted style coming back on the next page load.
    assert all(style_id(role).startswith("mascot-style-cast-") for role in CAST)
    assert len({style_id(role) for role in CAST}) == len(CAST)
