"""Math questions on the server: the same rules as `src/rebus/math.ts`, tested against the same cases.

An author gives the numbers, the operation and which part is missing; the
prompt and the answer are worked out here, so a math question cannot be wrong.
Whole numbers only, never negative, division exact, nothing past 9999.
"""

from __future__ import annotations

from typing import Any

OPS = ("+", "−", "×", "÷")
UNKNOWNS = ("result", "a", "b")
MATH_MAX = 9999


def _whole(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= MATH_MAX


def result_of(a: int, op: str, b: int) -> int | None:
    """The result of `a op b`, or None when it is not a whole number in range."""
    if op == "+":
        value = a + b
    elif op == "−":
        value = a - b
    elif op == "×":
        value = a * b
    elif op == "÷":
        if b == 0 or a % b != 0:
            return None
        value = a // b
    else:
        return None
    return value if _whole(value) else None


def problem(spec: dict[str, Any]) -> str | None:
    """What is wrong with these numbers, as a code, or None when the question is sound."""
    a, b, op, unknown = spec.get("a"), spec.get("b"), spec.get("op"), spec.get("unknown")
    if not _whole(a) or not _whole(b):
        return "bad-math-numbers"
    if op not in OPS or unknown not in UNKNOWNS:
        return "bad-math-op"
    result = result_of(a, op, b)
    if result is None:
        return "bad-math-result"
    if unknown != "result" and op == "×" and (b if unknown == "a" else a) == 0:
        return "bad-math-missing"
    if unknown == "b" and op == "÷" and result == 0:
        return "bad-math-missing"
    return None


def answer(spec: dict[str, Any]) -> int:
    result = result_of(spec["a"], spec["op"], spec["b"]) or 0
    unknown = spec["unknown"]
    return result if unknown == "result" else spec["a"] if unknown == "a" else spec["b"]


def prompt(spec: dict[str, Any]) -> str:
    result = result_of(spec["a"], spec["op"], spec["b"]) or 0
    a = "?" if spec["unknown"] == "a" else str(spec["a"])
    b = "?" if spec["unknown"] == "b" else str(spec["b"])
    r = "?" if spec["unknown"] == "result" else str(result)
    return f"{a} {spec['op']} {b} = {r}"


def explanation(spec: dict[str, Any]) -> str:
    result = result_of(spec["a"], spec["op"], spec["b"]) or 0
    return f"{spec['a']} {spec['op']} {spec['b']} = {result}."


def normalise(puzzle: dict[str, Any]) -> dict[str, Any]:
    """A math puzzle with everything derived from its numbers: pieces, answer, explanation. Others are untouched."""
    spec = puzzle.get("math")
    if puzzle.get("kind") != "math" or not isinstance(spec, dict) or problem(spec) is not None:
        return puzzle
    return {
        **puzzle,
        "pieces": [{"kind": "word", "text": prompt(spec)}],
        "answer": str(answer(spec)),
        "accepts": [],
        "explanation": puzzle.get("explanation") or explanation(spec),
    }
