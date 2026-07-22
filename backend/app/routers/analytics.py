"""Lightweight progress summary. The full mastery algorithm lives in the frontend
(services/logSchema.ts `computeSkillMastery`); this is a server-side aggregate a
parent dashboard can call directly. Port the full algorithm here later if needed."""

from fastapi import APIRouter, Depends

from ..models.user import User
from ..models.event import LearningEvent
from ..auth.deps import get_current_user
from .events import _authorize_read

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def summary(student_id: str, user: User = Depends(get_current_user)):
    await _authorize_read(student_id, user)

    events = await LearningEvent.find(LearningEvent.student_id == student_id).to_list()
    attempts = [e for e in events if e.event_type == "attempt"]

    def outcome(e: LearningEvent) -> str | None:
        return getattr(e, "outcome", None)

    correct = sum(1 for e in attempts if outcome(e) == "correct")
    incorrect = sum(1 for e in attempts if outcome(e) == "incorrect")

    return {
        "student_id": student_id,
        "total_events": len(events),
        "total_attempts": len(attempts),
        "correct": correct,
        "incorrect": incorrect,
        "accuracy": round(correct / len(attempts), 3) if attempts else None,
        "lessons_completed": sum(1 for e in events if e.event_type == "lesson_complete"),
    }
