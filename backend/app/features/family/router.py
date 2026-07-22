"""Parent-facing management of their own kids (students)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ...models.user import User
from ...models.student import Student
from ...core.deps import get_current_parent
from ...core.security import hash_secret
from .schemas import ChildIn, ChildOut

router = APIRouter(prefix="/family", tags=["family"])


def _out(s: Student) -> ChildOut:
    return ChildOut(id=str(s.id), name=s.name, avatar=s.avatar, has_pin=s.pin_hash is not None)


@router.get("/children", response_model=list[ChildOut])
async def list_children(parent: User = Depends(get_current_parent)):
    kids = await Student.find(Student.guardian_parent_ids == str(parent.id)).to_list()
    return [_out(s) for s in kids]


@router.post("/children", response_model=ChildOut, status_code=status.HTTP_201_CREATED)
async def add_child(body: ChildIn, parent: User = Depends(get_current_parent)):
    student = Student(
        name=body.name,
        avatar=body.avatar,
        pin_hash=hash_secret(body.pin) if body.pin else None,
        guardian_parent_ids=[str(parent.id)],
    )
    await student.insert()
    return _out(student)


@router.delete("/children/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_child(student_id: str, parent: User = Depends(get_current_parent)):
    try:
        student = await Student.get(PydanticObjectId(student_id))
    except Exception:
        student = None
    if not student or str(parent.id) not in student.guardian_parent_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    await student.delete()
