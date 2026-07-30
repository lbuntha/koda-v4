"""The assignment PATCH contract.

Releases are immutable and an assignment pins one, so published content — a skill's
thumbnail, a new question — reaches a learner only when an adult moves the assignment onto
a newer release (docs/progression-design.md §13.3). Before this field existed there was no
such path at all: PATCH took a status and nothing else, so artwork attached after the
assignment was created could never be delivered.

The endpoint itself needs a database; these pin the input contract that reaches it.
"""

import pytest
from pydantic import ValidationError

from app.features.placement.schemas import AssignmentStatusIn


def test_a_release_upgrade_needs_no_status_change():
    body = AssignmentStatusIn(release_id="rel-4")
    assert body.release_id == "rel-4"
    assert body.status is None


def test_a_status_change_needs_no_release():
    body = AssignmentStatusIn(status="paused")
    assert body.status == "paused"
    assert body.release_id is None


def test_release_ids_are_trimmed_and_blank_means_absent():
    assert AssignmentStatusIn(release_id="  rel-4  ").release_id == "rel-4"
    # An empty string must not reach the router as a falsy "upgrade" that clears the pin.
    with pytest.raises(ValidationError):
        AssignmentStatusIn(release_id="")


def test_an_unknown_status_is_still_rejected():
    with pytest.raises(ValidationError):
        AssignmentStatusIn(status="deleted")
