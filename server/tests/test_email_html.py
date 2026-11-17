from email import message_from_bytes

from app.services import email_html
from app.services.mail import _compose

APP = "https://learnwithkoda.tech"
WEEKLY = (
    "Hi Dara,\n\nThis week on Koda:\n\n"
    "• Mia: 4 days · 12 rounds · 38 minutes\n• Leo: 2 days · 5 rounds · 14 minutes\n\n"
    f"See their progress: {APP}\n\n— Koda\n\n---\n"
    "You get this because Weekly summary emails are on. "
    f"Don't want them? Unsubscribe: {APP}/v1/notifications/unsubscribe?token=abc.def"
)


def test_a_link_to_the_app_becomes_a_button_named_by_its_words():
    page = email_html.render(WEEKLY, "Your family's week on Koda", APP)
    assert f'href="{APP}"' in page and ">See their progress</a>" in page
    assert "See their progress:" not in page


def test_unsubscribe_is_one_short_word_not_the_long_address():
    page = email_html.render(WEEKLY, "s", APP)
    assert ">Unsubscribe</a>" in page
    assert "Don&#x27;t want them? " in page
    assert ">https://learnwithkoda.tech/v1/notifications" not in page


def test_each_child_is_a_row_with_the_name_in_bold():
    page = email_html.render(WEEKLY, "s", APP)
    assert "<strong" in page and ">Mia</strong>" in page and ">Leo</strong>" in page
    assert "4 days · 12 rounds · 38 minutes" in page


def test_khmer_rows_and_labels_work_the_same_way():
    text = f"សួស្ដី Dara\n\n• Mia៖ 4 ថ្ងៃ · 12 ជុំ\n\nមើលវឌ្ឍនភាព៖ {APP}\n\n---\nមិនចង់ទទួលទៀតទេ? ឈប់ទទួល៖ {APP}/v1/x?token=1"
    page = email_html.render(text, "s", APP)
    assert ">Mia</strong>" in page and ">មើលវឌ្ឍនភាព</a>" in page and ">ឈប់ទទួល</a>" in page


def test_what_an_operator_types_is_escaped():
    page = email_html.render("Hi <b>x</b> & co", "s", APP)
    assert "&lt;b&gt;x&lt;/b&gt; &amp; co" in page


def test_a_bare_app_link_is_a_button_with_the_site_name():
    page = email_html.render(f"If it wasn't you, sign it out under Settings:\n{APP}", "s", APP)
    assert ">learnwithkoda.tech</a>" in page


def test_every_message_goes_as_text_and_html(monkeypatch):
    raw = _compose("a@example.com", "Hi", WEEKLY).as_bytes()
    parsed = message_from_bytes(raw)
    assert parsed.get_content_type() == "multipart/alternative"
    kinds = [part.get_content_type() for part in parsed.walk() if not part.is_multipart()]
    assert kinds == ["text/plain", "text/html"]
