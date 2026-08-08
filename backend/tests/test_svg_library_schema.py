"""Validation for presentation links stored with an owner's SVG library."""

import pytest
from pydantic import ValidationError

from app.features.content.schemas import SvgLibraryIn


ASSET = {
    "id": "mastery-beginner",
    "label": "Beginner badge",
    "markup": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    "scale": 1,
}


def test_mastery_gate_assets_reference_the_svg_library():
    library = SvgLibraryIn(
        assets=[ASSET],
        masteryGateAssets={"beginner": ASSET["id"]},
    )

    assert library.mastery_gate_assets == {"beginner": "mastery-beginner"}


@pytest.mark.parametrize(
    "links",
    [
        {"expert": "mastery-beginner"},
        {"beginner": "missing-asset"},
    ],
)
def test_mastery_gate_assets_reject_unknown_levels_and_dangling_assets(links):
    with pytest.raises(ValidationError):
        SvgLibraryIn(assets=[ASSET], masteryGateAssets=links)
