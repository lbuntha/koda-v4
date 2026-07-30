from types import SimpleNamespace

from app.features.learning.router import _assignment_release_bindings, _run_matches_assignments


def assignment(identifier: str, release_id: str):
    return SimpleNamespace(id=identifier, release_id=release_id)


def run(*bindings: str):
    return SimpleNamespace(assignment_release_ids=list(bindings))


def test_assignment_release_bindings_are_stable():
    rows = [assignment("a1", "r1"), assignment("a2", "r2")]
    assert _assignment_release_bindings(rows) == ["a1:r1", "a2:r2"]


def test_cached_run_is_rejected_after_a_release_upgrade():
    rows = [assignment("a1", "new")]
    assert _run_matches_assignments(run("a1:old"), rows) is False
    assert _run_matches_assignments(run("a1:new"), rows) is True


def test_binding_order_does_not_invalidate_an_equivalent_plan():
    rows = [assignment("a1", "r1"), assignment("a2", "r2")]
    assert _run_matches_assignments(run("a2:r2", "a1:r1"), rows) is True
