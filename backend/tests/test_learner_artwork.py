"""Learner artwork delivery: how a skill's thumbnail reaches the student home.

Pure logic, no database. Studio markup is authored as a JSX-style fragment, but the
student home renders a thumbnail through an `<img>` pointed at `/learning/assets/...`,
where the response is parsed as a standalone SVG *document* — and a document without the
SVG namespace does not render at all. Releases are immutable, so the repair happens at
read time.
"""

from urllib.parse import unquote

from app.features.content.release import build_release_payload
from app.features.learning.router import SVG_NAMESPACE, _ensure_svg_namespace, _thumbnail_url


def test_thumbnail_url_prefers_an_authored_path():
    presentation = {"thumbnailUrl": "/assets/owl-mascot.svg", "thumbnailAssetId": "ignored"}
    assert _thumbnail_url(presentation, "rel-1") == "/assets/owl-mascot.svg"


def test_thumbnail_url_points_a_library_asset_at_the_published_release():
    url = _thumbnail_url({"thumbnailAssetId": "star svg"}, "rel/1")
    # API-relative, and it must match the route this router actually registers. A hardcoded
    # "/api" prefix resolved against the browser's origin instead, so the image 404'd
    # wherever the API is not proxied under /api on the same host.
    assert url == "/learning/assets/rel%2F1/star%20svg"


def test_thumbnail_url_is_absent_without_artwork():
    assert _thumbnail_url({}, "rel-1") is None


def test_published_library_asset_round_trips_from_url_back_to_its_markup():
    """The id the URL carries must be the id the asset route looks up in the manifest.

    Publish and delivery are written in different modules; this pins the one thing that has
    to agree between them, so a skill's chosen SVG cannot silently 404 on the student home.
    """
    markup = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>'
    asset = {"id": "custom_svg_star", "label": "Star", "markup": markup, "scale": 1}
    skill = {
        "id": "s1",
        "unitId": "u1",
        "label": "Count to 10",
        "order": 1,
        "minQuestions": 1,
        "presentation": {"thumbnailAssetId": asset["id"]},
    }
    payload = build_release_payload(
        tree={
            "grades": [{"id": "g1", "label": "Grade 1", "order": 1}],
            "subjects": [{"id": "sub1", "gradeId": "g1", "label": "Math", "order": 1}],
            "units": [{"id": "u1", "subjectId": "sub1", "label": "Unit 1", "order": 1}],
            "skills": [skill],
        },
        questions=[],
        assets=[asset],
    )

    url = _thumbnail_url(skill["presentation"], "rel-1")
    served_asset_id = unquote(url.rsplit("/", 1)[-1])
    entry = next(
        row for row in payload["asset_manifest"] if row["asset_id"] == served_asset_id
    )
    assert entry["snapshot"]["markup"] == markup


def test_namespace_is_added_to_studio_markup():
    served = _ensure_svg_namespace('<svg viewBox="0 0 24 24" fill="none"><circle r="4"/></svg>')
    assert served == (
        f'<svg xmlns="{SVG_NAMESPACE}" viewBox="0 0 24 24" fill="none"><circle r="4"/></svg>'
    )


def test_existing_namespace_is_left_alone():
    markup = f'<svg xmlns="{SVG_NAMESPACE}" viewBox="0 0 8 8"></svg>'
    assert _ensure_svg_namespace(markup) == markup


def test_non_svg_payloads_are_returned_untouched():
    assert _ensure_svg_namespace("not markup") == "not markup"
    assert _ensure_svg_namespace("<svg unterminated") == "<svg unterminated"
