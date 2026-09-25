"""The publish gate for Koda Library books.

A port of `src/library/data/verifyPassage.ts`, `tiles.ts` and `gapOf` from
`text.ts`. The editor runs the TypeScript version on every keystroke so an author
sees problems as they type; this runs once, on publish, because the browser is not
trusted: a book reaches children's devices only if the *server* agrees it passes.

Two implementations of one rule set can drift, so they are held together by
fixtures: `server/tests/fixtures/library/*.json` are byte-for-byte copies of the
starter stories (a vitest test fails if they differ), and both test suites assert
the same verdicts on them and on the same deliberately broken copies.

What is not here, and why:
  - rule 4 uses an optional child reading list; the publish check reports
    "skipped" when it is not available and never blocks publishing;
  - rule 7 (recordings) never fails: recordings are optional. Whether the clips a
    book points at actually exist is checked by the router on publish.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from app.khmer_spelling import is_base, is_mark, khmer_problem, normalize_khmer, spelling_units

BANDS: dict[str, dict[str, int]] = {
    "A": {"understand": 10, "words": 10, "spell": 10},
    "B": {"understand": 10, "words": 10, "spell": 10},
}
QUESTION_MINIMUM_RATIO = 0.85
MIN_TILES = 2
MAX_TILES = 8
CHOICES = 3

RULE_TITLES = {
    1: "The answer is in the story",
    2: "Wrong choices come from the story",
    3: "The right answer is not the longest",
    4: "Questions use easy words",
    5: "Spelling words fit the ring and re-join",
    6: "No two questions share an answer or a sentence",
    7: "Recordings (optional)",
    8: "Khmer word splits are confirmed by a person",
}

STOP = set(
    "the a an and is was were are to of in on at it he she they his her its with for from that "
    "this then so but or as by be had has have not all up down out into under over very we you "
    "i my your our their them him am do did does no yes if when while because".split()
)

# Khmer function words — the job STOP does for English.
KHMER_STOP = set(
    "នៅ ថា ជា និង បាន ទៅ មក ក៏ ដែល គឺ នេះ នោះ ពី ឲ្យ ឱ្យ ហើយ តែ នឹង របស់ ដើម្បី ព្រោះ គេ វា ខ្ញុំ គាត់ អ្នក យើង ទាំង ណា ដល់ លើ ក្នុង".split()
)

# --------------------------------------------------------------------------- tiles

def _is_khmer_letter(c: int) -> bool:
    return is_base(c) or is_mark(c)


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def tiles_of(word: str, lang: str) -> list[str]:
    """English in letters; Khmer in the units a Khmer class spells with (see khmer_spelling)."""
    if lang == "en":
        return list(nfc(word).upper())
    return spelling_units(word)


def why_unspellable(word: str, lang: str) -> str | None:
    w = nfc(word)
    if not w:
        return "empty"
    if lang == "en":
        if not re.fullmatch(r"[A-Za-z]+", w):
            return "not_letters"
    else:
        if not all(_is_khmer_letter(ord(ch)) for ch in w):
            return "not_letters"
        problem = khmer_problem(w)
        if problem:
            return problem
    n = len(tiles_of(w, lang))
    if n < MIN_TILES:
        return "too_few_tiles"
    if n > MAX_TILES:
        return "too_many_tiles"
    return None


# ---------------------------------------------------------------------------- text

def core(token: str) -> str:
    """A word without the punctuation around it. Khmer marks count as word characters."""
    # `\w` excludes combining marks in some positions; strip only what is plainly
    # punctuation or symbols, which is what the client does.
    def is_mark_or_letter(ch: str) -> bool:
        return unicodedata.category(ch)[0] in "LMN"

    start, end = 0, len(token)
    while start < end and not is_mark_or_letter(token[start]):
        start += 1
    while end > start and not is_mark_or_letter(token[end - 1]):
        end -= 1
    return token[start:end]


def sentence_text(words: list[str], lang: str) -> str:
    return ("" if lang == "km" else " ").join(words)


def gap_of(words: list[str], word: str, lang: str) -> tuple[str, str] | None:
    def norm(w: str) -> str:
        return normalize_khmer(w) if lang == "km" else nfc(w).lower()

    want = norm(word)
    for i, tok in enumerate(words):
        if norm(core(tok)) == want:
            original = core(tok)
            copy = list(words)
            copy[i] = copy[i].replace(original, "___", 1)
            return sentence_text(copy, lang), original
    return None


def _words(s: str) -> list[str]:
    """Split on anything that is not a letter or a mark — the client's `[^\\p{L}\\p{M}]+`.

    Not `\\w`: Python's `\\w` does not count Khmer vowel signs as word characters,
    so it would cut a Khmer word in half.
    """
    out, cur = [], []
    for ch in s.lower():
        if unicodedata.category(ch)[0] in "LM":
            cur.append(ch)
        elif cur:
            out.append("".join(cur))
            cur = []
    if cur:
        out.append("".join(cur))
    return out


def _stems(s: str) -> list[str]:
    return [w[:4] for w in _words(s) if w not in STOP and len(w) >= 3]


def _has_khmer(s: str) -> bool:
    """The Khmer block. Khmer writes without spaces, so `_words` cannot find its words."""
    return any("\u1780" <= ch <= "\u17ff" for ch in s)


def _meaningful(w: str) -> bool:
    """Long enough to mean something, and not a word every sentence uses anyway."""
    if not w or w in STOP or w in KHMER_STOP:
        return False
    return len(w) >= (2 if _has_khmer(w) else 3)


def _split_words(sentences: list[dict]) -> list[str]:
    """The words of some sentences, as the author split them.

    For Khmer this is the only reliable split there is — the one rule 8 makes a
    person confirm. Nothing here may re-derive it.
    """
    out: list[str] = []
    for s in sentences:
        for tok in s.get("words") or []:
            w = core(str(tok)).lower()
            if _meaningful(w) and w not in out:
                out.append(w)
    return out


def _draws_on(text: str, source_text: str, source_words: list[str]) -> bool:
    """Whether a choice draws on the words of the story, or of one sentence of it.

    Two scripts, two ways of asking. English splits on spaces, so stems answer it
    and "raining" still answers for "rained". Khmer does not: `_words` hands back
    a whole clause as a single token, so a four-letter stem only ever sees that
    clause's opening. A distractor that shared its word in the middle — which is
    exactly how a good Khmer distractor is built — read as story-free, and rule 2
    refused to publish an honest question no author could fix. For a script that
    writes without spaces, the source's own confirmed words are looked for inside
    the choice instead.

    Kept identical to `drawsOn` in `src/library/data/verifyPassage.ts`: the client
    shows the author a verdict and the server decides, so the two disagreeing is
    the worst outcome of all.
    """
    if any(st in source_text for st in _stems(text)):
        return True
    return _has_khmer(text) and any(w in text for w in source_words)


# -------------------------------------------------------------------------- verify


@dataclass
class Check:
    rule: int
    question: str
    status: str  # pass | fail | skipped
    message: str


@dataclass
class Verdict:
    checks: list[Check] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)
    counts_match_band: bool = False

    @property
    def failures(self) -> list[Check]:
        return [c for c in self.checks if c.status == "fail"]

    @property
    def publishable(self) -> bool:
        return not self.failures and self.counts_match_band

    def failing_rules(self) -> list[int]:
        return sorted({c.rule for c in self.failures})

    def summary(self) -> list[dict[str, Any]]:
        return [
            {"rule": c.rule, "question": c.question, "message": c.message}
            for c in self.failures
        ]


def verify_passage(p: dict[str, Any], *, confirmed_split: bool = False) -> Verdict:
    v = Verdict()

    def add(rule: int, q: str, ok: bool | str, message: str) -> None:
        status = "skipped" if ok == "skipped" else ("pass" if ok else "fail")
        v.checks.append(Check(rule, q, status, message))

    lang = p.get("language")
    sentences: list[dict[str, Any]] = p.get("sentences") or []
    questions: list[dict[str, Any]] = p.get("questions") or []

    # ---- rule 0: is this a passage
    if lang not in ("en", "km"):
        add(0, "story", False, "the language must be en or km")
        lang = "en"
    if p.get("band") not in BANDS:
        add(0, "story", False, "the band must be A or B")
    if not str(p.get("title") or "").strip():
        add(0, "story", False, "the story has no title")
    if not sentences:
        add(0, "story", False, "the story has no sentences")
    seen_s: set[str] = set()
    for s in sentences:
        sid = str(s.get("id"))
        if sid in seen_s:
            add(0, "story", False, f"two sentences are called {sid}")
        seen_s.add(sid)
        words = s.get("words") or []
        if not words or any(not str(w).strip() for w in words):
            add(0, sid, False, "the sentence has an empty word")
        elif s.get("text") != sentence_text(words, lang):
            add(0, sid, False, "the words no longer rejoin to the sentence text")

    seen_q: set[str] = set()
    usable: list[dict[str, Any]] = []
    for q in questions:
        qid = str(q.get("id"))
        if qid in seen_q:
            add(0, qid, False, "two questions share this id")
        seen_q.add(qid)
        kind = q.get("kind")
        if kind not in ("comprehension", "vocab", "spell"):
            add(0, qid, False, "unknown question kind")
            continue
        if kind != "spell":
            opts = q.get("options") or []
            ans = q.get("answer")
            if len(opts) != CHOICES:
                add(0, qid, False, f"needs exactly {CHOICES} choices")
            if not isinstance(ans, int) or not 0 <= ans < len(opts):
                add(0, qid, False, "the answer index is outside the choices")
                continue
            if len({str(o).strip().lower() for o in opts}) != len(opts) or any(not str(o).strip() for o in opts):
                add(0, qid, False, "the choices are not all different and non-empty")
        usable.append(q)

    by_id = {str(s.get("id")): s for s in sentences}
    story = " ".join(str(s.get("text", "")) for s in sentences).lower()
    # The story's own splits, for the scripts a word regex cannot read.
    story_split = _split_words(sentences)
    pictures: dict[str, str] = p.get("pictures") or {}

    # ---- rules 1, 2, 3, 4, 5
    for q in usable:
        qid, kind = str(q["id"]), q["kind"]
        if kind != "spell" and not str(q.get("prompt") or "").strip():
            add(4, qid, False, "the question has no text")
        if kind == "comprehension":
            opts = [str(o) for o in q["options"]]
            answer = opts[q["answer"]]
            ev = by_id.get(str(q.get("evidence")))
            if ev is None:
                add(1, qid, False, f"evidence {q.get('evidence')} does not exist")
            else:
                hit = _draws_on(answer, str(ev.get("text", "")).lower(), _split_words([ev]))
                add(1, qid, hit, "the answer's key word is in its evidence" if hit else "the answer's key word is not in its evidence")
            wrong = [o for i, o in enumerate(opts) if i != q["answer"]]
            from_story = sum(1 for o in wrong if _draws_on(o, story, story_split))
            add(2, qid, from_story >= 1, f"{from_story} of {len(wrong)} wrong choices use the story's words")
            lens = [len(o) for o in opts]
            top = max(lens)
            longest = lens[q["answer"]] == top and lens.count(top) == 1
            add(3, qid, not longest, "the right answer is the longest" if longest else "the right answer is not the longest")
        elif kind == "vocab":
            word = str(q.get("word") or "")
            expected = pictures.get(word.lower()) or pictures.get(word)
            if not expected:
                add(1, qid, False, f"no picture is declared for “{word}”")
            elif word.lower() not in story:
                add(1, qid, False, f"“{word}” is not in the story")
            elif q["options"][q["answer"]] != expected:
                add(1, qid, False, f"the right picture should be “{expected}”")
            else:
                add(1, qid, True, "the word is in the story and its picture matches")
        else:
            s = by_id.get(str(q.get("sentence")))
            word = str(q.get("word") or "")
            if s is None:
                add(5, qid, False, f"sentence {q.get('sentence')} does not exist")
                continue
            g = gap_of(list(s.get("words") or []), word, lang)
            if g is None:
                add(5, qid, False, f"“{word}” is not a word of {s.get('id')}")
                continue
            why = why_unspellable(word, lang)
            rejoins = g[0].replace("___", g[1], 1) == s.get("text")
            message = f"cannot be spelled: {why}" if why else ("fits and re-joins" if rejoins else "does not re-join")
            add(5, qid, why is None and rejoins, message)
    add(4, "story", "skipped", "the reading list is not available — check skipped")

    # ---- rule 6: no repeats within a part
    def answer_of(q: dict[str, Any]) -> str:
        if q["kind"] == "comprehension":
            return str(q["options"][q["answer"]]).lower()
        return str(q.get("word") or "").lower()

    def sentence_of(q: dict[str, Any]) -> str | None:
        return {"comprehension": q.get("evidence"), "spell": q.get("sentence")}.get(q["kind"])

    for kind in ("comprehension", "vocab", "spell"):
        part = [q for q in usable if q["kind"] == kind]
        for q in part:
            dup = any(
                o is not q and (answer_of(o) == answer_of(q) or (sentence_of(q) is not None and sentence_of(o) == sentence_of(q)))
                for o in part
            )
            add(6, str(q["id"]), not dup, "shares an answer or sentence" if dup else "unique")

    # ---- rule 7 (draft form until recordings exist) and rule 8
    recorded = sum(1 for s in sentences if s.get("audio"))
    add(7, "story", True, f"{recorded} of {len(sentences)} sentences recorded — the rest use the device voice (recordings are optional)")
    split_message = "split confirmed" if (lang != "km" or confirmed_split) else "Khmer word splits are not confirmed"
    add(8, "story", lang != "km" or confirmed_split, split_message)

    configured = p.get("questionCounts")
    configured_ok = isinstance(configured, dict) and all(
        isinstance(configured.get(k), int) for k in ("understand", "words", "spell")
    )
    band = configured if configured_ok else BANDS.get(str(p.get("band")))
    if isinstance(band, dict) and any(not 1 <= int(band[k]) <= 10 for k in ("understand", "words", "spell")):
        band = None
    v.counts = {k: sum(1 for q in questions if q.get("kind") == k) for k in ("comprehension", "vocab", "spell")}
    v.counts_match_band = bool(band) and all(
        int(band[k] * QUESTION_MINIMUM_RATIO + 0.999999) <= v.counts[count_key] <= band[k]
        for k, count_key in (("understand", "comprehension"), ("words", "vocab"), ("spell", "spell"))
    )
    return v
