"""Owner-scoped authored content: the curriculum tree and the question deck.
Whole-document GET/PUT mirrors the frontend's localStorage read/write."""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..models.user import User
from ..models.content import Curriculum, QuestionDeck
from ..auth.deps import get_current_user

router = APIRouter(tags=["content"])


# ── Curriculum tree ──────────────────────────────────────────────────────────

class CurriculumIn(BaseModel):
    tree: dict[str, Any]


@router.get("/curriculum")
async def get_curriculum(user: User = Depends(get_current_user)):
    doc = await Curriculum.find_one(Curriculum.owner_id == str(user.id))
    return {"tree": doc.tree if doc else None}


@router.put("/curriculum")
async def put_curriculum(body: CurriculumIn, user: User = Depends(get_current_user)):
    doc = await Curriculum.find_one(Curriculum.owner_id == str(user.id))
    if doc:
        doc.tree = body.tree
        await doc.save()
    else:
        await Curriculum(owner_id=str(user.id), tree=body.tree).insert()
    return {"ok": True}


# ── Question deck ────────────────────────────────────────────────────────────

class QuestionsIn(BaseModel):
    questions: list[dict[str, Any]]


@router.get("/questions")
async def get_questions(user: User = Depends(get_current_user)):
    doc = await QuestionDeck.find_one(QuestionDeck.owner_id == str(user.id))
    return {"questions": doc.questions if doc else []}


@router.put("/questions")
async def put_questions(body: QuestionsIn, user: User = Depends(get_current_user)):
    doc = await QuestionDeck.find_one(QuestionDeck.owner_id == str(user.id))
    if doc:
        doc.questions = body.questions
        await doc.save()
    else:
        await QuestionDeck(owner_id=str(user.id), questions=body.questions).insert()
    return {"ok": True}
