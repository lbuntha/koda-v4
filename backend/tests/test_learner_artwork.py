"""Learner artwork delivery: how a skill's thumbnail reaches the student home.

Pure logic, no database. Studio markup is authored as a JSX-style fragment, but the
student home renders a thumbnail through `<img src="/api/learning/assets/...">`, where
the response is parsed as a standalone SVG *document* — and a document without the SVG
namespace does not render at all. Releases are immutable, so the repair happens at
read time.
"""

from app.features.learning.router import SVG_NAMESPACE, _ensure_svg_namespace, _thumbnail_url


def test_thumbnail_url_prefers_an_authored_path():
    presentation = {"thumbnailUrl": "/assets/owl-mascot.svg", "thumbnailAssetId": "ignored"}
    assert _thumbnail_url(presentation, "rel-1") == "/assets/owl-mascot.svg"


def test_thumbnail_url_points_a_library_asset_at_the_published_release():
    url = _thumbnail_url({"thumbnailAssetId": "star svg"}, "rel/1")
    assert url == "/api/learning/assets/rel%2F1/star%20svg"


def test_thumbnail_url_is_absent_without_artwork():
    assert _thumbnail_url({}, "rel-1") is None


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
