"""Grade → student-page layout band resolution (Phase 1 redesign)."""

from types import SimpleNamespace

from app.models.academic import default_band_for_order, resolve_layout_band


def _grade(order: int, layout_band=None):
    # resolve_layout_band only reads .order and .layout_band; a Beanie Grade
    # can't be constructed without DB init, so a duck-typed stand-in suffices.
    return SimpleNamespace(order=order, layout_band=layout_band)


def test_default_band_for_order_boundaries():
    assert [default_band_for_order(o) for o in (1, 6)] == ["kid", "kid"]
    assert [default_band_for_order(o) for o in (7, 9)] == ["student", "student"]
    assert [default_band_for_order(o) for o in (10, 12)] == ["focus", "focus"]


def test_resolve_uses_order_when_unset():
    assert resolve_layout_band(_grade(3)) == "kid"
    assert resolve_layout_band(_grade(8)) == "student"
    assert resolve_layout_band(_grade(11)) == "focus"


def test_explicit_band_overrides_order():
    # A grade-2 that the admin pinned to the mature "focus" layout.
    assert resolve_layout_band(_grade(2, layout_band="focus")) == "focus"


def test_invalid_band_falls_back_to_order_default():
    assert resolve_layout_band(_grade(4, layout_band="bogus")) == "kid"
