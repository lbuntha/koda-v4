"""Khmer spelling, as the Khmer Angkor keyboard (Keyman) documents it.

A port of `src/library/data/khmer.ts` — read that file for the why. The shared
cases in `server/tests/fixtures/library/khmer-cases.json` (a byte-for-byte copy
of `src/library/data/khmer-cases.json`) are asserted by both test suites.

    consonant + subscript(s) + consonant shifter + vowel + sign + diacritic
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field

COENG = 0x17D2
RO = 0x179A
DA = 0x178A
TA = 0x178F
NNO = 0x178E
NO = 0x1793
E = 0x17C1
AA = 0x17B6
II = 0x17B8
U = 0x17BB
OO = 0x17C4
OE = 0x17BE
NIKAHIT = 0x17C6
REAHMUK = 0x17C7
BANTOC = 0x17CB
MUUSIKATOAN = 0x17C9
TRIISAP = 0x17CA

ABOVE = {0x17B7, 0x17B8, 0x17B9, 0x17BA, OE}
SHIFTER_FOR = {
    **{c: MUUSIKATOAN for c in (0x1784, 0x1789, 0x1793, 0x1798, 0x1799, 0x179A, 0x179C)},
    **{c: TRIISAP for c in (0x179F, 0x17A0, 0x17A2)},
}
COMPOUND = {(U, NIKAHIT), (AA, NIKAHIT), (U, REAHMUK), (E, REAHMUK), (OO, REAHMUK)}


def is_consonant(c: int) -> bool:
    return 0x1780 <= c <= 0x17A2


def is_independent_vowel(c: int) -> bool:
    return 0x17A3 <= c <= 0x17B3


def _is_vowel(c: int) -> bool:
    return 0x17B4 <= c <= 0x17C5


def _is_shifter(c: int) -> bool:
    return c in (MUUSIKATOAN, TRIISAP)


def _is_pseudo(c: int) -> bool:
    return 0x17C6 <= c <= 0x17C8


def _is_diacritic(c: int) -> bool:
    return 0x17CB <= c <= 0x17D1 or c in (0x17D3, 0x17DD)


def is_base(c: int) -> bool:
    return is_consonant(c) or is_independent_vowel(c)


def is_mark(c: int) -> bool:
    return _is_vowel(c) or _is_shifter(c) or _is_pseudo(c) or _is_diacritic(c) or c == COENG


@dataclass
class _Syllable:
    base: int | None
    subs: list[int] = field(default_factory=list)
    shifters: list[int] = field(default_factory=list)
    vowels: list[int] = field(default_factory=list)
    pseudo: list[int] = field(default_factory=list)
    diacritics: list[int] = field(default_factory=list)
    stray: list[int] = field(default_factory=list)


def _parse(cps: list[int]) -> list[_Syllable | int]:
    out: list[_Syllable | int] = []
    cur: _Syllable | None = None
    i = 0
    while i < len(cps):
        c = cps[i]
        if is_base(c):
            cur = _Syllable(c)
            out.append(cur)
        elif is_mark(c):
            if cur is None:
                cur = _Syllable(None)
                out.append(cur)
            if c == COENG:
                if i + 1 < len(cps) and is_consonant(cps[i + 1]):
                    cur.subs.append(cps[i + 1])
                    i += 1
                else:
                    cur.stray.append(c)
            elif _is_shifter(c):
                cur.shifters.append(c)
            elif _is_vowel(c):
                cur.vowels.append(c)
            elif _is_pseudo(c):
                cur.pseudo.append(c)
            else:
                cur.diacritics.append(c)
        else:
            cur = None
            out.append(c)
        i += 1
    return out


def _correct(s: _Syllable) -> _Syllable:
    t = _Syllable(s.base, list(s.subs), list(s.shifters), list(s.vowels), list(s.pseudo), list(s.diacritics), list(s.stray))
    t.subs = [c for c in t.subs if c != RO] + [c for c in t.subs if c == RO]
    if t.subs:
        if t.base == NNO and t.subs[0] == TA:
            t.subs[0] = DA
        if t.base == NO and t.subs[0] == DA:
            t.subs[0] = TA
    if len(t.vowels) == 2 and E in t.vowels and AA in t.vowels:
        t.vowels = [OO]
    elif len(t.vowels) == 2 and E in t.vowels and II in t.vowels:
        t.vowels = [OE]
    if not t.shifters and t.base in SHIFTER_FOR and U in t.vowels:
        other = [v for v in t.vowels if v != U]
        if len(t.vowels) == 2 and len(other) == 1 and (other[0] in ABOVE or (other[0] == AA and NIKAHIT in t.pseudo)):
            t.vowels = other
            t.shifters = [SHIFTER_FOR[t.base]]
    return t


def _emit(s: _Syllable) -> list[int]:
    out = [] if s.base is None else [s.base]
    for c in s.subs:
        out += [COENG, c]
    return out + s.shifters + s.vowels + s.pseudo + s.diacritics + s.stray


def normalize_khmer(text: str) -> str:
    cps = [ord(ch) for ch in unicodedata.normalize("NFC", text)]
    if not any(0x1780 <= c <= 0x17FF for c in cps):
        return unicodedata.normalize("NFC", text)
    out: list[int] = []
    for x in _parse(cps):
        out += [x] if isinstance(x, int) else _emit(_correct(x))
    return "".join(map(chr, out))


def khmer_problem(word: str) -> str | None:
    raw = [ord(ch) for ch in unicodedata.normalize("NFC", word)]
    if any(c == COENG and i + 1 < len(raw) and raw[i + 1] == COENG for i, c in enumerate(raw)):
        return "dangling_coeng"
    for x in _parse(raw):
        if isinstance(x, int):
            continue
        s = _correct(x)
        if s.base is None:
            return "starts_with_mark"
        if s.stray:
            return "dangling_coeng"
        if len(s.vowels) > 1:
            return "two_vowels"
        if len(s.shifters) > 1:
            return "two_shifters"
        if BANTOC in s.diacritics and (s.vowels or s.pseudo or s.shifters or s.subs):
            return "bantoc_misplaced"
    return None


def spelling_units(word: str) -> list[str]:
    cps = [ord(ch) for ch in normalize_khmer(word)]
    out: list[str] = []
    for x in _parse(cps):
        if isinstance(x, int):
            out.append(chr(x))
            continue
        if x.base is not None:
            out.append(chr(x.base))
        out += [chr(COENG) + chr(c) for c in x.subs]
        out += [chr(c) for c in x.shifters]
        signs = list(x.pseudo)
        for v in x.vowels:
            k = next((j for j, p in enumerate(signs) if (v, p) in COMPOUND), None)
            if k is None:
                out.append(chr(v))
            else:
                out.append(chr(v) + chr(signs.pop(k)))
        out += [chr(c) for c in signs + x.diacritics + x.stray]
    return out
