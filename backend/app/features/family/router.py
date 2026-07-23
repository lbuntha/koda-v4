"""Parent-facing management of their own kids (students)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ...models.user import User
from ...models.student import Student
from ...core.deps import get_current_parent
from ...core.security import hash_secret
from .schemas import ChildIn, ChildUpdate, ChildOut

router = APIRouter(prefix="/family", tags=["family"])


def _out(s: Student) -> ChildOut:
    return ChildOut(id=str(s.id), name=s.name, avatar=s.avatar, has_pin=s.pin_hash is not None)


async def _own_child_or_404(student_id: str, parent: User) -> Student:
    try:
        student = await Student.get(PydanticObjectId(student_id))
    except Exception:
        student = None
    if not student or str(parent.id) not in student.guardian_parent_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return student


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


@router.patch("/children/{student_id}", response_model=ChildOut)
async def update_child(student_id: str, body: ChildUpdate, parent: User = Depends(get_current_parent)):
    student = await _own_child_or_404(student_id, parent)
    if body.name is not None:
        student.name = body.name
    if body.avatar is not None:
        student.avatar = body.avatar
    if body.pin is not None:
        student.pin_hash = hash_secret(body.pin)
    await student.save()
    return _out(student)


@router.delete("/children/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_child(student_id: str, parent: User = Depends(get_current_parent)):
    student = await _own_child_or_404(student_id, parent)
    await student.delete()
