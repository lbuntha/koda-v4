from app.services.sync import REBUS_SEEN_CAP, merge_rebus_play


def test_seen_keeps_every_puzzle_and_puts_the_incoming_ones_newest():
    merged = merge_rebus_play({"seen": ["a", "b", "c"]}, {"seen": ["c", "d"]})
    assert merged["seen"] == ["a", "b", "c", "d"]


def test_seen_forgets_the_oldest_past_the_cap():
    existing = {"seen": [f"p{i}" for i in range(REBUS_SEEN_CAP)]}
    merged = merge_rebus_play(existing, {"seen": ["new"]})
    assert len(merged["seen"]) == REBUS_SEEN_CAP
    assert merged["seen"][-1] == "new" and "p0" not in merged["seen"]


def test_results_keep_the_device_that_played_a_puzzle_more():
    tablet = {"results": {"x": {"plays": 3, "last": "clean"}, "y": {"plays": 1, "last": "missed"}}}
    phone = {"results": {"x": {"plays": 1, "last": "missed"}, "z": {"plays": 2, "last": "helped"}}}
    merged = merge_rebus_play(tablet, phone)["results"]
    assert merged["x"] == {"plays": 3, "last": "clean"}
    assert merged["y"]["last"] == "missed"
    assert merged["z"]["plays"] == 2


def test_a_tie_goes_to_the_incoming_record_and_junk_is_ignored():
    merged = merge_rebus_play(
        {"seen": ["a", 5], "results": {"x": {"plays": 2, "last": "missed"}, "bad": "no"}},
        {"seen": ["b", None], "results": {"x": {"plays": 2, "last": "clean"}, "junk": 7}},
    )
    assert merged["seen"] == ["a", "b"]
    assert merged["results"] == {"x": {"plays": 2, "last": "clean"}}
