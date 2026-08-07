"""First-party SVG artwork for canonical learner subjects."""

from typing import Any


MATH_SUBJECT_ICON: dict[str, Any] = {
    "id": "koda_subject_math",
    "label": "Subject — Mathematics",
    "scale": 1.0,
    "markup": (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">'
        '<defs><linearGradient id="mathBook" x1="4" y1="5" x2="28" y2="28" '
        'gradientUnits="userSpaceOnUse"><stop stop-color="#8B72F6"/>'
        '<stop offset="1" stop-color="#534AB7"/></linearGradient></defs>'
        '<path d="M4 7.2c0-1.2 1-2.12 2.2-1.96 4.55.58 7.8 2.18 9.8 4.8V28c-2.48-2.03-5.75-3.2-9.95-3.5A2.2 2.2 0 0 1 4 22.3V7.2Z" '
        'fill="url(#mathBook)"/>'
        '<path d="M28 7.2c0-1.2-1-2.12-2.2-1.96-4.55.58-7.8 2.18-9.8 4.8V28c2.48-2.03 5.75-3.2 9.95-3.5A2.2 2.2 0 0 0 28 22.3V7.2Z" '
        'fill="#6A5BD0"/>'
        '<path d="M8 12h4.8M10.4 9.6v4.8M20 10.5h4.8M20 14.6h4.8" '
        'stroke="white" stroke-width="1.7" stroke-linecap="round" opacity=".92"/>'
        '<circle cx="24.8" cy="22.2" r="2.5" fill="#FFD45A"/>'
        '<path d="M16 10v18" stroke="white" stroke-width="1.25" opacity=".55"/>'
        '</svg>'
    ),
}


THINKING_LOGIC_SUBJECT_ICON: dict[str, Any] = {
    "id": "koda_subject_thinking_logic",
    "label": "Subject — Thinking & Logic",
    "scale": 1.0,
    "markup": (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">'
        '<defs><linearGradient id="logicBrain" x1="5" y1="4" x2="27" y2="28" '
        'gradientUnits="userSpaceOnUse"><stop stop-color="#A16BF2"/>'
        '<stop offset="1" stop-color="#7044D9"/></linearGradient></defs>'
        '<path d="M13.4 5.2a4.7 4.7 0 0 0-7.55 3.72A4.45 4.45 0 0 0 4 16.7a4.7 4.7 0 0 0 4.05 6.75A4.8 4.8 0 0 0 16 27V8.1a3.55 3.55 0 0 0-2.6-2.9Z" '
        'fill="url(#logicBrain)"/>'
        '<path d="M18.6 5.2a4.7 4.7 0 0 1 7.55 3.72A4.45 4.45 0 0 1 28 16.7a4.7 4.7 0 0 1-4.05 6.75A4.8 4.8 0 0 1 16 27V8.1a3.55 3.55 0 0 1 2.6-2.9Z" '
        'fill="#7962D8"/>'
        '<path d="M10.8 9.2a3 3 0 0 0-1.1 5.7 3.15 3.15 0 0 0 .65 5.9M21.2 9.2a3 3 0 0 1 1.1 5.7 3.15 3.15 0 0 1-.65 5.9M16 11.4h-2.25l-1.2 2.05 1.2 2.05H16M16 18.1h2.25l1.2 2.05" '
        'stroke="white" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>'
        '<circle cx="11" cy="21.7" r="2.1" fill="#5ED8B0"/>'
        '<circle cx="22.2" cy="8.2" r="2.1" fill="#FFD45A"/>'
        '</svg>'
    ),
}


SUBJECT_ICON_ASSETS = (MATH_SUBJECT_ICON, THINKING_LOGIC_SUBJECT_ICON)


def default_subject_icon(key: str, code: str, name: str) -> dict[str, Any] | None:
    """Resolve legacy canonical subjects without affecting unrelated or custom subjects."""
    normalized = f"{key} {code} {name}".lower()
    if code.upper() == "MATH" or "mathematics" in normalized:
        return MATH_SUBJECT_ICON
    if code.upper() == "LOGIC" or "thinking-logic" in normalized or "thinking & logic" in normalized:
        return THINKING_LOGIC_SUBJECT_ICON
    return None
