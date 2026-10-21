

def test_a_room_is_dealt_puzzles_that_suit_the_host_age():
    from app.rebus_room import suited_to_age

    young = [{"id": f"y{i}", "ages": [6, 7]} for i in range(40)]
    old = [{"id": f"o{i}", "ages": [12, 14]} for i in range(40)]
    assert [p["id"] for p in suited_to_age(young + old, 7)] == [p["id"] for p in young]
    assert [p["id"] for p in suited_to_age(young + old, 14)] == [p["id"] for p in old]
    assert len(suited_to_age(young + old, None)) == 80
    # Too few that fit: age is ignored rather than leave the room with nothing.
    assert len(suited_to_age(young[:5] + old, 7)) == 45
