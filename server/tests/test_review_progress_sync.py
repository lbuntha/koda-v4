from app.services.sync import REVIEW_FIXED_CAP, merge_review_progress


def mistake(key, last_wrong, updated):
    return {"key": key, "lastWrongDay": last_wrong, "updatedAt": updated, "rightDays": []}


def test_each_entry_keeps_the_copy_changed_last():
    tablet = {"mistakes": {"a/x": mistake("a/x", "2026-11-20", 5)}, "topics": {"c": {"step": 2, "updatedAt": 9}}}
    phone = {"mistakes": {"a/x": mistake("a/x", "2026-11-21", 7), "b/y": mistake("b/y", "2026-11-21", 1)},
             "topics": {"c": {"step": 0, "updatedAt": 3}}}
    merged = merge_review_progress(tablet, phone)
    assert merged["mistakes"]["a/x"]["lastWrongDay"] == "2026-11-21"
    assert set(merged["mistakes"]) == {"a/x", "b/y"}
    assert merged["topics"]["c"]["step"] == 2


def test_a_mistake_fixed_on_one_device_stays_fixed():
    server = {"mistakes": {"a/x": mistake("a/x", "2026-11-20", 5)}}
    phone = {"mistakes": {}, "fixed": [{"key": "a/x", "conceptKey": "c", "day": "2026-11-22"}]}
    merged = merge_review_progress(server, phone)
    assert merged["mistakes"] == {}
    assert merged["fixed"] == [{"key": "a/x", "conceptKey": "c", "day": "2026-11-22"}]


def test_a_newer_slip_after_the_fix_brings_it_back():
    server = {"fixed": [{"key": "a/x", "conceptKey": "c", "day": "2026-11-22"}]}
    phone = {"mistakes": {"a/x": mistake("a/x", "2026-11-25", 9)}}
    assert "a/x" in merge_review_progress(server, phone)["mistakes"]


def test_fixed_is_a_capped_union_and_junk_is_ignored():
    old = {"fixed": [{"key": f"k{i}", "day": "2026-01-01"} for i in range(REVIEW_FIXED_CAP)] + ["junk", {"key": 3}]}
    new = {"fixed": [{"key": "k0", "day": "2026-01-01"}, {"key": "late", "day": "2026-12-01"}], "mistakes": "nope"}
    merged = merge_review_progress(old, new)
    assert len(merged["fixed"]) == REVIEW_FIXED_CAP
    assert merged["fixed"][-1]["key"] == "late"
    assert merged["mistakes"] == {}
